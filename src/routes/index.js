const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const homeRoutes = require('./homeRoutes');

// Define route mountpoints
router.use('/auth', authRoutes);
router.use('/home', homeRoutes);


module.exports = router;