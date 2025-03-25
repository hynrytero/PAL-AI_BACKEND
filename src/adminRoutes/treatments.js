const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious'); 

// Get all treatments/medicines
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        medicine_id, 
        rice_plant_medicine, 
        description,
        image
      FROM rice_plant_medicine
    `;
    
    const results = await database.executeQuery(query,[]);
    
    const formattedResults = results.map(row => ({
      medicine_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      image: row[3].value || null
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
      message: 'Server error while fetching treatments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get treatment details by id
router.get('/fetch/:id', async (req, res) => {
  try {
    const query = `
      SELECT 
        medicine_id, 
        rice_plant_medicine as name, 
        description, 
        image
      FROM rice_plant_medicine
      WHERE medicine_id = @param0
    `;
    
    const params = [
      { type: TYPES.Int, value: parseInt(req.params.id) }
    ];
    
    const results = await database.executeQuery(query, params);
    
    if (results.length === 0 || !results[0]) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }
    
    const treatment = {
      medicine_id: results[0][0].value,
      name: results[0][1].value,
      description: results[0][2].value || '',
      image: results[0][3].value ? 
        `data:image/jpeg;base64,${results[0][3].value.toString('base64')}` : 
        null
    };
    
    res.status(200).json({
      success: true,
      data: treatment
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatment details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;