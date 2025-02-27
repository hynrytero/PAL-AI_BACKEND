// src/userRoutes/homeRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');

// Home endpoint
router.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Server is running na mga neighbors",
        timestamp: new Date().toISOString()
    });
});

// Check Connection Endpoint
router.get('/check', async (req, res) => {
    try {
        const query = 'SELECT GETUTCDATE() as currentDate';
        const result = await database.executeQuery(query);
        
        const currentDate = result[0][0].value; 

        res.status(200).json({
            status: 'Connected',
            message: 'Database connection successful',
            currentDate: new Date(currentDate).toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'Failed',
            message: 'Database connection error',
            error: err.message
        });
    }
});

module.exports = router;