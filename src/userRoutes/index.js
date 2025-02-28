// src/userRoutes/index.js
const express = require('express');
const router = express.Router();

// Import route modules.
const authRoutes = require('./authRoutes');
const homeRoutes = require('./homeRoutes');
const signupRoutes = require('./signupRoutes');
const forgotPasswordRoutes = require('./forgotPasswordRoutes');
const profileRoutes = require('./profileRoutes');
const historyRoutes = require('./historyRoutes');
const credentialsRoutes = require('./credentialsRoutes');
const notificationsRoutes = require('./notificationsRoutes');
const scanRoutes = require('./scanRoutes');
const pushNotificationRoutes = require('./pushNotificationRoutes');

// Define route mountpoints.
router.use('/auth', authRoutes);
router.use('/home', homeRoutes);
router.use('/signup', signupRoutes);
router.use('/forgotpassword', forgotPasswordRoutes);
router.use('/profile', profileRoutes);
router.use('/history', historyRoutes);
router.use('/credentials', credentialsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/scan', scanRoutes);
router.use('/push-notify', pushNotificationRoutes);

module.exports = router;