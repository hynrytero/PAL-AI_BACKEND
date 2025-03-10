// src/config/index.js
require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 8080
  },
  database: {
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    maxPoolSize: 10,
  },
  storage: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    bucketScan: process.env.BUCKET_NAME_SCAN,
    bucketProfile: process.env.BUCKET_NAME_PROFILE
  },
  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD
  },
  development: {
     status: process.env.NODE_ENV,
     apiKey: process.env.API_KEY 
  }
};