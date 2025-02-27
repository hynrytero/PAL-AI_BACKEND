// src/routes/forgotPasswordRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const bcrypt = require('bcrypt');
const { TYPES } = require('tedious');
const {transporter, passwordResetCodes} = require('../services');
const { generateVerificationCode } = require('../utils');

// Validate Email
router.post("/verify-email", async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email exists in database
        const emailQuery = `
            SELECT user_id 
            FROM user_profiles 
            WHERE email = @param0
        `;
        const emailParams = [{ type: TYPES.NVarChar, value: email }];
        const existingUser = await database.executeQuery(emailQuery, emailParams);

        if (existingUser.length === 0) {
            return res.status(404).json({
                message: "No account found with this email address"
            });
        }

        // Generate OTP
        const resetCode = generateVerificationCode(); 
        const codeExpiry = new Date();
        codeExpiry.setMinutes(codeExpiry.getMinutes() + 15); 

        // Store password reset details
        passwordResetCodes.set(email, {
            resetCode,
            codeExpiry,
            userId: existingUser[0][0].value 
        });

        // Send reset code via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Code',
            html: `
                <h1>Password Reset Request</h1>
                <p>Your password reset code is:</p>
                <h2>${resetCode}</h2>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this password reset, please ignore this email and ensure your account is secure.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            message: "Password reset code sent to your email",
            email: email
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ 
            message: "Server error during password reset request",
            error: err.message 
        });
    }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Validate input
        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        // Check if there's a valid reset code
        const resetData = passwordResetCodes.get(email);
        if (!resetData) {
            return res.status(400).json({
                message: "No password reset request found. Please request a new OTP."
            });
        }

        // Validate OTP and expiry
        if (resetData.resetCode !== otp) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        if (new Date() > resetData.codeExpiry) {
            passwordResetCodes.delete(email);
            return res.status(400).json({
                message: "OTP has expired. Please request a new one."
            });
        }

        res.status(200).json({
            message: "OTP verified successfully",
            userId: resetData.userId
        });

    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(500).json({
            message: "Server error during OTP verification",
            error: err.message
        });
    }
});

// Resend Password Reset OTP Endpoint
router.post("/resend-password-otp", async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email exists in database
        const emailQuery = `
            SELECT user_id 
            FROM user_profiles 
            WHERE email = @param0
        `;
        const emailParams = [{ type: TYPES.NVarChar, value: email }];
        const existingUser = await database.executeQuery(emailQuery, emailParams);

        if (existingUser.length === 0) {
            return res.status(404).json({
                message: "No account found with this email address"
            });
        }

        // Generate new OTP
        const resetCode = generateVerificationCode();
        const codeExpiry = new Date();
        codeExpiry.setMinutes(codeExpiry.getMinutes() + 15);

        // Update stored data with new code
        passwordResetCodes.set(email, {
            resetCode,
            codeExpiry,
            userId: existingUser[0][0].value
        });

        // Send new OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'New Password Reset Code',
            html: `
                <h1>Password Reset Request</h1>
                <p>Your new password reset code is:</p>
                <h2>${resetCode}</h2>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this password reset, please ignore this email and ensure your account is secure.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            message: "New password reset code sent to your email",
            email: email
        });

    } catch (err) {
        console.error('Resend password OTP error:', err);
        res.status(500).json({
            message: "Server error during OTP resend",
            error: err.message
        });
    }
});

// Change Password
router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
    }

    try {
        const getUserQuery = `
            SELECT user_id 
            FROM user_profiles 
            WHERE email = @param0`;

        const userResults = await database.executeQuery(getUserQuery, [
            { type: TYPES.VarChar, value: email }
        ]);

        if (!userResults || userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResults[0][0].value;

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const updatePasswordQuery = `
            UPDATE user_credentials 
            SET password = @param0,
                updated_at = GETDATE()
            WHERE user_id = @param1`;

        await database.executeQuery(updatePasswordQuery, [
            { type: TYPES.VarChar, value: hashedPassword },
            { type: TYPES.Int, value: userId }
        ]);

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password reset error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            query: error.query
        });
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

module.exports = router;