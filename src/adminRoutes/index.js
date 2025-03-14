// src/adminRoutes/index.js
const express = require('express');
const router = express.Router();

// Import route modules.
const reportRoutes = require('./reports');
const userRoutes = require('./users');
const notificationRoutes = require('./notifications');


// Define route mountpoints.
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/notif', notificationRoutes);


module.exports = router;