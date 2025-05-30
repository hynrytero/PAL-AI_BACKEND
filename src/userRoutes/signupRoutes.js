// src/userRoutes/signupRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const bcrypt = require('bcrypt');
const { TYPES } = require('tedious');
const {transporter, verificationCodes} = require('../services');
const { generateVerificationCode } = require('../utils');

// Pre-signup process
router.post("/pre-signup", async (req, res) => {
    try {
        const { username, email, password, firstname, lastname, birthdate, gender, mobilenumber, yearsOfExperience, region, province, city, barangay } = req.body;

        // Check if email already exists
        const emailQuery = `
            SELECT 1 FROM user_profiles 
            WHERE email = @param0
        `;
        const emailParams = [{ type: TYPES.NVarChar, value: email }];
        const existingEmail = await database.executeQuery(emailQuery, emailParams);
        if (existingEmail.length > 0) {
            return res.status(409).json({
                message: "Email already in use"
            });
        }

        // Generate verification code
        const verificationCode = generateVerificationCode();
        const codeExpiry = new Date();
        codeExpiry.setMinutes(codeExpiry.getMinutes() + 15); 

        // Store temporary registration details and verification code
        const tempRegData = {
            username,
            email,
            password,
            firstname,
            lastname,
            birthdate,  
            gender,
            mobilenumber,
            yearsOfExperience,
            region,
            province,
            city,
            barangay,
            verificationCode,
            codeExpiry
        };
        verificationCodes.set(email, tempRegData);

        // Debug logging for tempRegData (without sensitive info)
        console.log('Temp registration data for debugging:', {
            ...tempRegData,
            password: '[REDACTED]' // Don't log the actual password
        });

        // Send verification code via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Verification Code',
            html: `
                <h1>Email Verification</h1>
                <p>Your verification code is:</p>
                <h2>${verificationCode}</h2>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this verification, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            message: "Verification code sent to your email",
            email: email
        });

    } catch (err) {
        console.error('Pre-signup error:', err);
        res.status(500).json({ 
            message: "Server error during pre-registration",
            error: err.message 
        });
    }
});

// Complete Signup with Verification Code
router.post("/complete-signup", async (req, res) => {
    try {
        const { email, verificationCode } = req.body;

        // Retrieve stored registration data
        const tempRegData = verificationCodes.get(email);

        // Validate verification code
        if (!tempRegData || 
            tempRegData.verificationCode !== verificationCode || 
            new Date() > tempRegData.codeExpiry
        ) {
            return res.status(400).json({ 
                message: "Invalid or expired verification code" 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempRegData.password.trim(), salt);

        const DEFAULT_ROLE_ID = 1;

        // Start a transaction to insert user credentials, profile, and address
        const registrationQuery = `
        BEGIN TRANSACTION;
        
        INSERT INTO user_credentials (username, role_id, password)
        VALUES (@param0, @param1, @param2);

        DECLARE @newUserId INT = SCOPE_IDENTITY();
        
        INSERT INTO user_address (region, province, city, barangay)
        VALUES (@param3, @param4, @param5, @param6);

        DECLARE @newAddressId INT = SCOPE_IDENTITY();

        INSERT INTO user_profiles (
            user_id, address_id, firstname, lastname, birthdate, gender, email, mobile_number, years_experience
        ) VALUES (
            @newUserId, @newAddressId, @param7, @param8, @param9, @param10, @param11, @param12, @param13
        );
        
        COMMIT TRANSACTION;
        
        SELECT @newUserId AS userId;
    `;

    const registrationParams = [
        { type: TYPES.NVarChar, value: tempRegData.username },
        { type: TYPES.Int, value: DEFAULT_ROLE_ID },
        { type: TYPES.NVarChar, value: hashedPassword },
        { type: TYPES.NVarChar, value: tempRegData.region },
        { type: TYPES.NVarChar, value: tempRegData.province },
        { type: TYPES.NVarChar, value: tempRegData.city },
        { type: TYPES.NVarChar, value: tempRegData.barangay },
        { type: TYPES.NVarChar, value: tempRegData.firstname },
        { type: TYPES.NVarChar, value: tempRegData.lastname },
        { type: TYPES.Date, value: new Date(tempRegData.birthdate) },
        { type: TYPES.NVarChar, value: tempRegData.gender },
        { type: TYPES.NVarChar, value: email },
        { type: TYPES.NVarChar, value: tempRegData.mobilenumber },
        { type: TYPES.Int, value: tempRegData.yearsOfExperience }
    ];

        const userResult = await database.executeQuery(registrationQuery, registrationParams);
        const userId = userResult[0][0].value;

        // Remove verification code from storage
        verificationCodes.delete(email);

        res.status(201).json({ 
            message: "Registration completed successfully", 
            userId 
        });

    } catch (err) {
        console.error('Complete signup error:', err);
        res.status(500).json({ 
            message: "Server error during registration",
            error: err.message 
        });
    }
});

// Resend Verification Code Endpoint
router.post("/resend-verification-code", async (req, res) => {
    try {
        const { email } = req.body;

        // Check if there's an existing pre-registration for this email
        const tempRegData = verificationCodes.get(email);

        if (!tempRegData) {
            return res.status(400).json({ 
                message: "No pending registration found. Please start the signup process again." 
            });
        }

        // Generate new verification code
        const verificationCode = generateVerificationCode();
        const codeExpiry = new Date();
        codeExpiry.setMinutes(codeExpiry.getMinutes() + 15);

        // Update stored data with new code
        tempRegData.verificationCode = verificationCode;
        tempRegData.codeExpiry = codeExpiry;
        verificationCodes.set(email, tempRegData);

        // Send new verification code via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your New Verification Code',
            html: `
                <h1>Email Verification</h1>
                <p>Your new verification code is:</p>
                <h2>${verificationCode}</h2>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this verification, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ 
            message: "New verification code sent to your email",
            email: email 
        });

    } catch (err) {
        console.error('Resend verification code error:', err);
        res.status(500).json({ 
            message: "Server error", 
            error: err.message 
        });
    }
});

module.exports = router;