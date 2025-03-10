// src/middleware/index.js
const errorHandler = require('./errorHandler');
const requestLimiter = require('./rateLimit');
const apiKeyAuth = require(`./apiKey`);

module.exports = {
  errorHandler,
  requestLimiter,
  apiKeyAuth
};