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
        rls.user_id,
        rls.rice_leaf_disease_id,
        rls.scan_image,
        rls.disease_confidence_score,
        rls.created_at,
        up.firstname,
        up.lastname,
        up.email,
        up.profile_image
      FROM 
        rice_leaf_scan rls
      LEFT JOIN
        user_profiles up ON rls.user_id = up.user_id
      WHERE 
        rls.rice_leaf_disease_id != @param0
      ORDER BY
        rls.created_at DESC
    `;

    // Parameters using your custom format
    const params = [
      { type: TYPES.Int, value: 3 }
    ];

    // Execute query using your connection pool
    const results = await database.executeQuery(query, params);

    // Process the results to convert from column format to object format
    const formattedResults = results.map(row => {
      const formattedRow = {};
      row.forEach(column => {
        formattedRow[column.metadata.colName] = column.value;
      });
      return formattedRow;
    });

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