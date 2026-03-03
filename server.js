// Express server to proxy Snowflake query results
// Supports SPCS OAuth token auth and env var password auth (local dev)

import express from 'express';
import snowflake from 'snowflake-sdk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// create a connection with auto-reconnect
let conn = null;

function getSfConfig() {
  const tokenPath = '/snowflake/session/token';
  // SPCS OAuth token auth
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf-8').trim();
    console.log('Using SPCS OAuth token authentication');
    return {
      accessUrl: `https://${process.env.SNOWFLAKE_HOST}`,
      account: process.env.SNOWFLAKE_ACCOUNT,
      authenticator: 'OAUTH',
      token: token,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'SNOWADHOC',
      clientSessionKeepAlive: true
    };
  }
  // Local dev: env var password auth
  console.log('Using password authentication');
  return {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'SNOWADHOC',
    clientSessionKeepAlive: true
  };
}

function connectToSnowflake() {
  return new Promise((resolve, reject) => {
    const sfConfig = getSfConfig();
    conn = snowflake.createConnection(sfConfig);
    conn.connect((err) => {
      if (err) {
        console.error('Unable to connect to Snowflake:', err);
        reject(err);
      } else {
        console.log('Successfully connected to Snowflake');
        resolve(conn);
      }
    });
  });
}

function executeWithReconnect(sql, res) {
  conn.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      if (err) {
        console.warn('Query failed, reconnecting...', err.message);
        connectToSnowflake().then(() => {
          conn.execute({
            sqlText: sql,
            complete: (err2, stmt2, rows2) => {
              if (err2) {
                console.error('Query failed after reconnect:', err2);
                res.status(500).json({ error: 'query failed' });
              } else {
                res.json(rows2);
              }
            }
          });
        }).catch(() => {
          res.status(500).json({ error: 'reconnect failed' });
        });
      } else {
        res.json(rows);
      }
    }
  });
}

const sfConfig = getSfConfig();
if (sfConfig.token || (sfConfig.account && sfConfig.username && sfConfig.password)) {
  connectToSnowflake().catch(() => {});
} else {
  console.warn('Snowflake credentials not set. /accounts endpoint will not work.');
}

// allow cross-origin for local dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/accounts', (req, res) => {
  if (!conn) {
    return res.status(503).json({ error: 'Snowflake connection not available' });
  }
  const sql = `select cloud, deployment, count(account_id) as count_of_accounts
               from temp.tam.accounts_detail_dt
               group by cloud, deployment
               order by cloud, deployment, count_of_accounts`;
  executeWithReconnect(sql, res);
});

// serve static files from example/world-population
app.use('/', express.static(__dirname + '/example/world-population'));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});