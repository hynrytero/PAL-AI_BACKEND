// src/middleware/index.js
const errorHandler = require('./errorHandler');
const requestLimiter = require('./rateLimit');

module.exports = {
  errorHandler,
  requestLimiter,
};