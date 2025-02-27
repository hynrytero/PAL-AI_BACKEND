// src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const homeRoutes = require('./homeRoutes');
const signupRoutes = require('./signupRoutes');
const forgotPasswordRoutes = require('./forgotPasswordRoutes');
const profileRoutes = require('./profileRoutes');
const historyRoutes = require('./historyRoutes');

// Define route mountpoints
router.use('/auth', authRoutes);
router.use('/home', homeRoutes);
router.use('/signup', signupRoutes);
router.use('/forgotpassword', forgotPasswordRoutes);
router.use('/profile', profileRoutes);
router.use('/history', historyRoutes);


module.exports = router;