// src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const homeRoutes = require('./homeRoutes');
const signupRoutes = require('./signupRoutes');

// Define route mountpoints
router.use('/auth', authRoutes);
router.use('/home', homeRoutes);
router.use('/signup', signupRoutes);


module.exports = router;