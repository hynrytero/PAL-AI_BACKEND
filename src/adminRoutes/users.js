// src/adminRoutes/users.js
const express = require('express');
const { TYPES } = require('tedious');
const router = express.Router();
const database = require('../db/connection');

router.get('/fetch-user', async (req, res) => {
  try {
    const query = `
      SELECT
        up.user_id,
        up.firstname,
        up.lastname,
        up.gender,
        up.birthdate,
        up.years_experience,
        up.mobile_number,
        up.email,
        up.profile_image,
        up.created_at,
        ua.region,
        ua.province,
        ua.city,
        ua.barangay
      FROM user_profiles up
      LEFT JOIN user_address ua ON up.address_id = ua.address_id
      ORDER BY up.created_at DESC
    `;

    const results = await database.executeQuery(query, []);

    const formattedResults = results.map(row => ({
      user_id: row[0].value,
      firstname: row[1].value || '',
      lastname: row[2].value || '',
      gender: row[3].value || '',
      birthdate: row[4].value,
      years_experience: row[5].value || 0,
      mobile_number: row[6].value || '',
      email: row[7].value || '',
      profile_image: row[8].value || null,
      created_at: row[9].value,
      region: row[10].value || '',
      province: row[11].value || '',
      city: row[12].value || '',
      barangay: row[13].value || ''
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

router.delete('/delete-user/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Execute the deletion transaction in a single query
    const deleteQuery = `
      BEGIN TRY
        BEGIN TRANSACTION;
        
        -- First, delete from scan_history which depends on rice_leaf_scan
        DELETE FROM dbo.scan_history
        WHERE rice_leaf_scan_id IN (SELECT rice_leaf_scan_id FROM dbo.rice_leaf_scan WHERE user_id = @param0);
        
        -- Then delete from rice_leaf_scan which depends on user_credentials
        DELETE FROM dbo.rice_leaf_scan
        WHERE user_id = @param0;
        
        -- Delete from user_notifications which depends on user_credentials
        DELETE FROM dbo.user_notifications
        WHERE user_id = @param0;
        
        -- Delete from user_profiles which depends on user_credentials
        DELETE FROM dbo.user_profiles 
        WHERE user_id = @param0;
        
        -- Finally delete from user_credentials
        DELETE FROM dbo.user_credentials 
        WHERE user_id = @param0;
        
        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `;

    const params = [
      { type: TYPES.Int, value: parseInt(userId, 10) }
    ];

    await database.executeQuery(deleteQuery, params);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;