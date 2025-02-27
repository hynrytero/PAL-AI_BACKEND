// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', err);
  
    res.status(500).json({
      message: 'Something went wrong',
      error: err.message 
    });
  };
  
  module.exports = errorHandler;
  
  