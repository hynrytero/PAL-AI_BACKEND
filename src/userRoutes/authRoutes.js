// src/userRoutes/authRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const bcrypt = require('bcrypt');
const { TYPES } = require('tedious');
const { Expo } = require('expo-server-sdk');

// Login Enpoint
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        if (!identifier || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const query = `
            SELECT 
                uc.user_id,
                uc.username,
                uc.password,
                uc.role_id,
                up.email
            FROM user_credentials uc
            LEFT JOIN user_profiles up ON uc.user_id = up.user_id
            WHERE uc.username = @param0 OR up.email = @param0
        `;
        
        const params = [
            { type: TYPES.NVarChar, value: identifier.trim() }
        ];
        
        const result = await database.executeQuery(query, params);
        console.log("Database query result:", result ? "Found user" : "No user found");
        
        if (!result || !result[0]) {
            console.log("User not found in database");
            return res.status(400).json({ message: "Invalid credentials" });
        }
        
        const user = {
            id: result[0][0].value,
            username: result[0][1].value,
            password: result[0][2].value,
            roleId: result[0][3].value,
            email: result[0][4].value
        };
        console.log("User found, attempting password match");
        
        // Trim password before comparison
        const isMatch = await bcrypt.compare(password.trim(), user.password);
        console.log("Password match result:", isMatch);
        
        if (!isMatch) {
            console.log("Password doesn't match");
            return res.status(400).json({ message: "Invalid credentials" });
        }
        
        res.json({
            message: "Login successful",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                roleId: user.roleId
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: "An error occurred during login" });
    }
});

// Register Push Token for Notif
router.post('/pushToken', async (req, res) => {
    const { token, user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!token || !Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }
  
    try {
      // First check if user exists and what their current token is
      const checkQuery = `
        SELECT push_token
        FROM user_credentials 
        WHERE user_id = @param0
      `;
      
      const checkParams = [
        { type: TYPES.Int, value: user_id }
      ];
      
      const results = await database.executeQuery(checkQuery, checkParams);
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get current token (might be null)
      const currentToken = results[0].push_token ? results[0].push_token.value : null;
      
      // If token is the same, no need to update
      if (currentToken === token) {
        return res.status(200).json({ message: 'Token already registered for this user' });
      }
      
      // Update token regardless of whether it was null or had a different value
      const updateQuery = `
        UPDATE user_credentials 
        SET push_token = @param0
        WHERE user_id = @param1
      `;
      
      const updateParams = [
        { type: TYPES.VarChar, value: token },
        { type: TYPES.Int, value: user_id }
      ];
      
      await database.executeQuery(updateQuery, updateParams);
      
      res.status(200).json({ 
        message: currentToken ? 'Push token updated successfully' : 'Push token registered successfully' 
      });
    } catch (error) {
      console.error('Error registering/updating token:', error);
      res.status(500).json({ error: 'Failed to register/update token' });
    }
});

module.exports = router;