// src/adminRoutes/reports.js
const express = require('express');
const { TYPES } = require('tedious');
const router = express.Router();
const database = require('../db/connection'); 

router.get('/rice-leaf-scans', async (req, res) => {
  try {
    const query = `
      SELECT
        rls.rice_leaf_scan_id,
        rls.scan_image,
        rls.disease_confidence_score,
        rls.created_at,
        rld.rice_leaf_disease,
        rld.description as disease_description,
        lpt.treatment as practice_treatment,
        lpt.description as treatment_description,
        rpm.rice_plant_medicine,
        rpm.description as medicine_description,
        rls.user_id,
        up.firstname,
        up.lastname
      FROM rice_leaf_scan rls
      JOIN rice_leaf_disease rld ON rls.rice_leaf_disease_id = rld.rice_leaf_disease_id
      LEFT JOIN local_practice_treatment lpt ON rld.rice_leaf_disease_id = lpt.rice_leaf_disease_id
      LEFT JOIN rice_plant_medicine rpm ON rld.rice_leaf_disease_id = rpm.rice_leaf_disease_id
      LEFT JOIN user_profiles up ON rls.user_id = up.user_id
      WHERE rls.rice_leaf_disease_id != @param0
      ORDER BY rls.created_at DESC
    `;
    
    // Parameters using your custom format
    const params = [
      { type: TYPES.Int, value: 3 }
    ];
    
    // Execute query using your connection pool
    const results = await database.executeQuery(query, params);
    
    // Format the results
    const formattedResults = results.map(row => ({
      rice_leaf_scan_id: row[0].value,
      scan_image: row[1].value,
      disease_confidence_score: row[2].value,
      created_at: row[3].value,
      rice_leaf_disease: row[4].value,
      disease_description: row[5].value || 'No disease description available',
      practice_treatment: row[6].value || 'No practice treatment available',
      treatment_description: row[7].value || 'No treatment description available',
      rice_plant_medicine: row[8].value || 'No medicine available',
      medicine_description: row[9].value || 'No medicine information available',
      firstname: row[11].value || '',
      lastname: row[12].value || ''
    }));
    
    // Return the results
    res.status(200).json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching rice leaf scan data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;