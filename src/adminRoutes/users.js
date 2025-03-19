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

  router.delete('/delete-user/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
      // Create a transaction to safely delete all related user data
      const transactionQuery = `
        BEGIN TRANSACTION;
        -- First, delete from scan_history which depends on rice_leaf_scan
        DELETE FROM dbo.scan_history
        WHERE rice_leaf_scan_id IN (SELECT rice_leaf_scan_id FROM dbo.rice_leaf_scan WHERE user_id = @userId);
        
        -- Then delete from rice_leaf_scan which depends on user_credentials
        DELETE FROM dbo.rice_leaf_scan
        WHERE user_id = @userId;
        
        -- Delete from user_notifications which depends on user_credentials
        DELETE FROM dbo.user_notifications
        WHERE user_id = @userId;
        
        -- Delete from user_profiles which depends on user_credentials and user_address
        DELETE FROM dbo.user_profiles 
        WHERE user_id = @userId;
        
        -- Finally delete from user_credentials
        DELETE FROM dbo.user_credentials 
        WHERE user_id = @userId;
        COMMIT TRANSACTION;
      `;
      
      const params = [
        { name: 'userId', type: TYPES.Int, value: parseInt(userId) }
      ];
      
      await database.executeQuery(transactionQuery, params);
      
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