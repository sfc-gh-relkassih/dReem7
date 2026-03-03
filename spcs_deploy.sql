-- Run this AFTER pushing the Docker image to the registry

CREATE SERVICE IF NOT EXISTS TEMP.RELKASSIH_GLOBE.GLOBE_SERVICE
  IN COMPUTE POOL SUPPORT_POOL_SMALL
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1
  EXTERNAL_ACCESS_INTEGRATIONS = (ALLOW_ALL_EAI)
  FROM SPECIFICATION $$
  spec:
    containers:
      - name: globe
        image: /temp/relkassih_globe/globe_images/globe-status:latest
        env:
          SNOWFLAKE_WAREHOUSE: SNOWADHOC
        resources:
          requests:
            cpu: 0.5
            memory: 512M
          limits:
            cpu: 1
            memory: 1G
    endpoints:
      - name: globe-ui
        port: 8080
        public: true
  $$;

-- Check service status
SELECT SYSTEM$GET_SERVICE_STATUS('TEMP.RELKASSIH_GLOBE.GLOBE_SERVICE');

-- Get the public URL
SHOW ENDPOINTS IN SERVICE TEMP.RELKASSIH_GLOBE.GLOBE_SERVICE;

-- Grant access to other roles (adjust role name as needed)
GRANT USAGE ON SERVICE TEMP.RELKASSIH_GLOBE.GLOBE_SERVICE TO ROLE TECHNICAL_ACCOUNT_MANAGER;
