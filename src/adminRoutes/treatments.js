// src/routes/treatments.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');

// Get all treatments/medicines
router.get('/', async (req, res) => {
    try {
      const query = `
        SELECT 
          medicine_id, 
          rice_plant_medicine, 
          description,
          image
        FROM rice_plant_medicine
      `;
  
      const results = await database.executeQuery(query, []);
  
      const formattedResults = results.map(row => ({
        medicine_id: row.medicine_id,
        name: row.rice_plant_medicine,
        description: row.description || '',
        image: row.image ? row.image.toString('base64') : null 
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
router.get('/:id', async (req, res) => {
    try {
      const query = `
        SELECT 
          medicine_id, 
          rice_plant_medicine, 
          description,
          image
        FROM rice_plant_medicine
        WHERE medicine_id = ?
      `;
  
      const results = await database.executeQuery(query, [req.params.id]);
  
      if (!results || results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Treatment not found'
        });
      }
  
      const treatment = {
        medicine_id: results[0].medicine_id,
        name: results[0].rice_plant_medicine,
        description: results[0].description || '',
        image: results[0].image ? results[0].image.toString('base64') : null // Convert binary image to Base64
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