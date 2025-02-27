const express = require('express');
const multer = require('multer');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler, requestLimiter } = require('./middleware');

// Create Express app
const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLimiter);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
});


// Routes
app.use('/', routes);
app.use(errorHandler);

// Start server
const PORT = config.server.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});



