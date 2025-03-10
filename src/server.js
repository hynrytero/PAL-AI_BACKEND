// src/server.js
const express = require('express');
const cors = require('cors');
const config = require('./config');
const userRoutes = require('./userRoutes');
const { errorHandler, requestLimiter,apiKeyAuth } = require('./middleware');

// Check environment
const isDevelopment = config.development.status === 'development';
console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

// Create Express app
const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLimiter);

if (isDevelopment) {
  app.use((req, res, next) => {
    req.isDevelopment = true;
    next();
  });
}

// Routes
app.use('/', apiKeyAuth, userRoutes);

app.use(errorHandler);

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (isDevelopment) {
    console.log('Using local database connection settings');
  } else {
    console.log('Using Google Cloud SQL connector');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});