// src/adminRoutes/notifications.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const database = require('../db/connection');
const { TYPES } = require('tedious');
const { bucketNotification } = require('../services');

router.get('/fetch-user', async (req, res) => {
  try {
    const query = `
      SELECT
        up.user_profiles_id,
        up.user_id,
        up.firstname,
        up.lastname,
        up.gender,
        up.mobile_number,
        up.email,
        up.profile_image,
        uc.push_token
      FROM user_profiles up
      LEFT JOIN user_credentials uc ON up.user_id = uc.user_id
      ORDER BY up.created_at DESC
    `;
    
    const results = await database.executeQuery(query, []);
    
    const formattedResults = results.map(row => ({
      user_profiles_id: row[0].value,
      user_id: row[1].value,
      firstname: row[2].value || '',
      lastname: row[3].value || '',
      gender: row[4].value || '',
      mobile_number: row[5].value || '',
      email: row[6].value || '',
      profile_image: row[7].value || null,
      push_token: row[8].value || null
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

// Upload notification image 
router.post('/upload', multer().single('image'), async (req, res) => {
  try {
      const file = req.file;
      const fileName = `${Date.now()}-${file.originalname}`;
      
      const blob = bucketNotification.file(fileName);
      const blobStream = blob.createWriteStream();

      blobStream.on('finish', async () => {
          const publicUrl = `https://storage.googleapis.com/${bucketNotification.name}/${fileName}`;
          res.status(200).json({ imageUrl: publicUrl });
      });

      blobStream.on('error', (err) => {
          res.status(500).json({ error: 'Upload failed', details: err.message });
      });

      blobStream.end(file.buffer);
  } catch (error) {
      res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

module.exports = router;