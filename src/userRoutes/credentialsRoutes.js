// src/userRoutes/credentialsRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const bcrypt = require('bcrypt');
const { TYPES } = require('tedious');
const {transporter, otpStorage} = require('../services');
const { generateVerificationCode } = require('../utils');

// Change Password
router.post('/change-password', async (req, res) => {
    const { user_id, currentPassword, newPassword } = req.body;

    if (!user_id || !currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    try {
        const verifyQuery = `
            SELECT password 
            FROM user_credentials 
            WHERE user_id = @param0
        `;

        const verifyParams = [
            { type: TYPES.Int, value: parseInt(user_id, 10) }  
        ];

        const results = await database.executeQuery(verifyQuery, verifyParams);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const storedHash = results[0][0].value;
        
        if (!storedHash) {
            return res.status(400).json({
                success: false,
                message: 'Password not set for this user'
            });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword.trim(), storedHash);

        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword.trim(), salt);

        // Ensure the hash length doesn't exceed varchar(255)
        if (newPasswordHash.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Generated password hash is too long'
            });
        }

        // Update password
        const updateQuery = `
            UPDATE user_credentials 
            SET password = @param1, 
                updated_at = GETDATE()
            WHERE user_id = @param0
        `;

        const updateParams = [
            { type: TYPES.Int, value: parseInt(user_id, 10) },
            { type: TYPES.VarChar, value: newPasswordHash }
        ];

        await database.executeQuery(updateQuery, updateParams);

        return res.status(200).json({
            success: true,
            message: 'Password successfully updated'
        });

    } catch (error) {
        console.error('Password change error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during password change'
        });
    }
});

// Verify Email
router.post('/verify-email-change', async (req, res) => {
    const { user_id, password, newEmail } = req.body;

    try {
        // Verify if email already exists
        const emailCheckQuery = `
            SELECT email 
            FROM user_profiles 
            WHERE email = @param0 
        `;
        
        const emailCheckParams = [
            { type: TYPES.VarChar, value: newEmail.trim() }
        ];

        const emailResults = await database.executeQuery(emailCheckQuery, emailCheckParams);
        
        if (emailResults && emailResults.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use'
            });
        }

        // Verify current password
        const verifyQuery = `
            SELECT uc.password, up.email
            FROM user_credentials uc
            JOIN user_profiles up ON uc.user_id = up.user_id
            WHERE uc.user_id = @param0
        `;

        const verifyParams = [
            { type: TYPES.Int, value: parseInt(user_id, 10) }
        ];

        const results = await database.executeQuery(verifyQuery, verifyParams);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const storedHash = results[0][0].value;
        if (!storedHash) {
            return res.status(400).json({
                success: false,
                message: 'Password not set for this user'
            });
        }

        const isPasswordValid = await bcrypt.compare(password.trim(), storedHash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Generate and store OTP
        const otp = generateVerificationCode();
        otpStorage.set(user_id.toString(), {
            otp,
            newEmail: newEmail.trim(),
            timestamp: Date.now()
        });

        // Send OTP email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: newEmail.trim(),
            subject: 'Email Change Verification',
            text: `Your OTP for email change is: ${otp}. This code will expire in 10 minutes.`
        });

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error) {
        console.error('Email change verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during verification'
        });
    }
});

// Change Email
router.post('/confirm-email-change', async (req, res) => {

    const { user_id, otp } = req.body;

    try {

        const storedData = otpStorage.get(user_id.toString());

        if (!storedData) {
            console.log('No OTP data found');
            return res.status(400).json({
                success: false,
                message: 'No OTP request found'
            });
        }

        // Check if OTP is expired (10 minutes)
        const timeElapsed = Date.now() - storedData.timestamp;
        const isExpired = timeElapsed > 10 * 60 * 1000;

        if (isExpired) {
            console.log('OTP expired');
            otpStorage.delete(user_id.toString());
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        const otpMatches = storedData.otp === otp;

        if (!otpMatches) {
            console.log('Invalid OTP provided');
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Update email
        const updateQuery = `
            UPDATE user_profiles 
            SET email = @param1,
                updated_at = GETDATE()
            WHERE user_id = @param0
        `;

        const updateParams = [
            { type: TYPES.Int, value: user_id },
            { type: TYPES.VarChar, value: storedData.newEmail }
        ];

        await database.executeQuery(updateQuery, updateParams);
        console.log('Email updated successfully');

        // Clear OTP data
        otpStorage.delete(user_id.toString());

        return res.status(200).json({
            success: true,
            message: 'Email updated successfully'
        });

    } catch (error) {
        console.error('Email change error:', {
            user_id,
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            success: false,
            message: 'Internal server error during email change'
        });
    }
});

// Delete Account
router.post('/delete-account', async (req, res) => {
    const { user_id, password } = req.body;

    if (!user_id || !password) {
        return res.status(400).json({
            success: false,
            message: 'User ID and password are required'
        });
    }

    try {
        // First verify the password
        const verifyQuery = `
            SELECT password 
            FROM user_credentials 
            WHERE user_id = @param0
        `;

        const verifyParams = [
            { type: TYPES.Int, value: parseInt(user_id, 10) }
        ];

        const results = await database.executeQuery(verifyQuery, verifyParams);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const storedHash = results[0][0].value;
        
        if (!storedHash) {
            return res.status(400).json({
                success: false,
                message: 'Password not set for this user'
            });
        }

        const isPasswordValid = await bcrypt.compare(password.trim(), storedHash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Execute the deletion transaction
        const deleteQuery = `
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
            -- Delete from user_profiles which depends on user_credentials and user_address
            DELETE FROM dbo.user_profiles 
            WHERE user_id = @param0;
            -- Finally delete from user_credentials
            DELETE FROM dbo.user_credentials 
            WHERE user_id = @param0;
            COMMIT TRANSACTION;
        `;

        const deleteParams = [
            { type: TYPES.Int, value: parseInt(user_id, 10) }
        ];

        await database.executeQuery(deleteQuery, deleteParams);

        return res.status(200).json({
            success: true,
            message: 'Account successfully deleted'
        });

    } catch (error) {
        console.error('Account deletion error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during account deletion'
        });
    }
});

module.exports = router;