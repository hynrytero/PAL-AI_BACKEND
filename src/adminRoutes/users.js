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
        up.mobile_number,
        up.address_id,
        up.email,
        up.profile_image,
        up.created_at
      FROM user_profiles up
      ORDER BY up.created_at DESC
    `;

    const results = await database.executeQuery(query, []);

    const formattedResults = results.map(row => ({
      user_id: row[0].value,
      firstname: row[1].value || '',
      lastname: row[2].value || '',
      gender: row[3].value || '',
      birthdate: row[4].value,
      mobile_number: row[5].value || '',
      address_id: row[6].value,
      email: row[7].value || '',
      profile_image: row[8].value || null,
      created_at: row[9].value
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
    // Start a transaction
    await database.executeQuery('BEGIN TRANSACTION;', []);

    // Execute each statement separately with parameters
    const deleteQueries = [
      `DELETE FROM dbo.scan_history 
       WHERE rice_leaf_scan_id IN (SELECT rice_leaf_scan_id FROM dbo.rice_leaf_scan WHERE user_id = @userId);`,
      
      `DELETE FROM dbo.rice_leaf_scan 
       WHERE user_id = @userId;`,
      
      `DELETE FROM dbo.user_notifications 
       WHERE user_id = @userId;`,
      
      `DELETE FROM dbo.user_profiles 
       WHERE user_id = @userId;`,
      
      `DELETE FROM dbo.user_credentials 
       WHERE user_id = @userId;`
    ];

    const params = [
      { name: 'userId', type: TYPES.Int, value: parseInt(userId) }
    ];

    // Execute each query in the transaction
    for (const query of deleteQueries) {
      await database.executeQuery(query, params);
    }

    // Commit the transaction
    await database.executeQuery('COMMIT TRANSACTION;', []);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    // Try to rollback transaction if possible
    try {
      await database.executeQuery('IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;', []);
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;