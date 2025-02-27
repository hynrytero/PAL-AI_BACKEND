// src/index.js
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const config = require('./config');
const routes = require('./routes');
const { requestLimiter } = require('./middleware/rateLimit');

// Create Express app
const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});

// Middleware
app.use(bodyParser.json());
app.use(requestLimiter);


// Routes
app.use('/', routes);


// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  // Close connections and clean up
  process.exit(0);
});