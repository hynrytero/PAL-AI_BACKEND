// src/middleware/apiKey.js
const config = require('../config');

const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.Auth.apiKey) {
    console.log('Config structure:', JSON.stringify(config, null, 2));
    console.log(config.development.apiKey);
    return res.status(401).json({ message: 'Invalid API key' });
  }
  
  next();
};

module.exports = apiKeyAuth;