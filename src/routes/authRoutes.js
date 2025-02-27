// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const bcrypt = require('bcrypt');
const { TYPES } = require('tedious');

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

module.exports = router;