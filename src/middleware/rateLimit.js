// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// Rate Limiter
const requestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30,
    message: 'Too many request attempts, please try again later'
});

module.exports = {
    requestLimiter
};