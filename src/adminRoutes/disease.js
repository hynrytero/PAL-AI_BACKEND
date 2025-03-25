// src/routes/diseases.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');

// Get all diseases
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        rice_leaf_disease_id, 
        rice_leaf_disease, 
        description
      FROM rice_leaf_disease
    `;
    
    const results = await database.executeQuery(query, []);
    
    const formattedResults = results.map(row => ({
      disease_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
    }));
    
    res.status(200).json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching diseases',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


module.exports = router;