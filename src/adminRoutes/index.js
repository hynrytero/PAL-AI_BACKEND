// src/adminRoutes/index.js
const express = require('express');
const router = express.Router();

// Import route modules.
const reportRoutes = require('./reports');

// Define route mountpoints.
router.use('/reports', reportRoutes);

module.exports = router;