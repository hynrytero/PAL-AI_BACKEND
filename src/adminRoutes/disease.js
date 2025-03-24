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
        description,
        medicine_id,
        treatment_id
      FROM rice_leaf_disease
    `;
    
    const results = await database.executeQuery(query, []);
    
    const formattedResults = results.map(row => ({
      disease_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      medicine_id: row[3].value,
      treatment_id: row[4].value
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

// Get diseases with recommended treatments
router.get('/with-treatments', async (req, res) => {
  try {
    const query = `
      SELECT 
        d.rice_leaf_disease_id, 
        d.rice_leaf_disease, 
        d.description as disease_description,
        m.medicine_id,
        m.rice_plant_medicine as treatment_name,
        m.description as treatment_description
      FROM rice_leaf_disease d
      LEFT JOIN rice_plant_medicine m ON d.medicine_id = m.medicine_id
    `;
    
    const results = await database.executeQuery(query, []);
    
    const formattedResults = results.map(row => ({
      disease_id: row[0].value,
      disease_name: row[1].value,
      disease_description: row[2].value || '',
      medicine_id: row[3].value,
      treatment_name: row[4].value,
      treatment_description: row[5].value || ''
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
      message: 'Server error while fetching diseases with treatments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;