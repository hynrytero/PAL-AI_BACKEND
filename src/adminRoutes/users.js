// src/adminRoutes/users.js
const express = require('express');
const { TYPES } = require('tedious');
const router = express.Router();
const database = require('../db/connection'); 

router.get('/fetch-user', async (req, res) => {
    try {
      const query = `
        SELECT
          up.firstname,
          up.lastname,
          up.gender,
          up.birthdate,
          up.mobile_number,
          up.address_id,
          up.email,
          up.profile_image
        FROM user_profiles up
        ORDER BY up.created_at DESC
      `;
      
      const results = await database.executeQuery(query, []);
      
      const formattedResults = results.map(row => ({
        firstname: row[0].value || '',
        lastname: row[1].value || '',
        gender: row[2].value || '',
        birthdate: row[3].value,
        mobile_number: row[4].value || '',
        address_id: row[5].value,
        email: row[6].value || '',
        profile_image: row[7].value || null
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
        message: 'Server error while fetching user data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

module.exports = router;