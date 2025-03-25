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
        image,
        rice_leaf_disease_id
      FROM rice_plant_medicine
    `;
    
    const results = await database.executeQuery(query,[]);
    
    const formattedResults = results.map(row => ({
      medicine_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      image: row[3].value || null,
      rld_id: row[4].value
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
        rp.medicine_id,
        rp.rice_plant_medicine as name, 
        rp.description, 
        rp.image,
        rld.rice_leaf_disease_id,
        rld.rice_leaf_disease as disease_name,
        rld.description as disease_description
      FROM rice_plant_medicine rp
      JOIN rice_leaf_disease rld ON rp.rice_leaf_disease_id = rld.rice_leaf_disease_id
      WHERE rp.medicine_id = @param0
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
        null,
      disease: {
        disease_id: results[0][4].value,
        name: results[0][5].value,
        description: results[0][6].value || ''
      }
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

// Get treatments by disease ID
// Get treatments by disease ID
router.get('/by-disease/:diseaseId', async (req, res) => {
  try {
    const query = `
      SELECT 
        pt.treatment_id, 
        pt.treatment as name, 
        pt.description,
        rld.rice_leaf_disease_id,
        rld.rice_leaf_disease as disease_name
      FROM practice_treatment pt
      JOIN rice_leaf_disease rld ON pt.rice_leaf_disease_id = rld.rice_leaf_disease_id
      WHERE pt.rice_leaf_disease_id = @param0
    `;
    
    const params = [
      { type: TYPES.Int, value: parseInt(req.params.diseaseId) }
    ];
    
    const results = await database.executeQuery(query, params);
    
    const formattedResults = results.map(row => ({
      treatment_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      rice_leaf_disease_id: row[3].value,
      disease_name: row[4].value
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
      message: 'Server error while fetching treatments by disease',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;