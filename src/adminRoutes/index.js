// src/adminRoutes/index.js
const express = require('express');
const router = express.Router();

// Import route modules.
const reportRoutes = require('./reports');
const userRoutes = require('./users');
const notificationRoutes = require('./notifications');
const pushnotificationRoutes = require('./pushNotifications');


// Define route mountpoints.
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/notif', notificationRoutes);
router.use('/push-notify', pushnotificationRoutes);


module.exports = router;