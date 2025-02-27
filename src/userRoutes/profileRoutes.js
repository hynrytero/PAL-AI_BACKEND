// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const database = require('../db/connection');
const { TYPES } = require('tedious');
const { bucketProfile } = require('../services');

// Fetch Profile Info
router.get('/fetch-profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const query = `
            SELECT 
                user_profiles_id,
                user_id,
                firstname,
                lastname,
                birthdate,
                gender,
                mobile_number,
                address_id,
                email,
                profile_image,
                created_at,
                updated_at
            FROM user_profiles
            WHERE user_id = @param0
        `;
        
        const params = [
            {
                type: TYPES.Int,
                value: parseInt(userId, 10)
            }
        ];

        //console.log("Executing Query:", query);
        //console.log("Parameters:", params);

        const results = await database.executeQuery(query, params);

        if (results.length > 0) {
            const userProfile = {};
            results[0].forEach(column => {
                userProfile[column.metadata.colName] = column.value;
            });

            res.json({
                success: true,
                data: {
                    firstname: userProfile.firstname,
                    lastname: userProfile.lastname,
                    email: userProfile.email,
                    contactNumber: userProfile.mobile_number,
                    birthdate: userProfile.birthdate,
                    gender: userProfile.gender,
                    image: userProfile.profile_image
                }
            });
        } else {
            res.status(404).json({ success: false, message: 'User profile not found' });
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
    }
});

// Upload Profile Picture
router.post('/upload-profile', multer().single('image'), async (req, res) => {
    try {
        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname}`;
        
        const blob = bucketProfile.file(fileName);
        const blobStream = blob.createWriteStream();

        blobStream.on('finish', async () => {
            const publicUrl = `https://storage.googleapis.com/${bucketProfile.name}/${fileName}`;
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

// Update Profile
router.put('/update', async (req, res) => {
    try {
        const { userId, firstname, lastname, birthdate, contactNumber, image } = req.body;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Construct update query with only provided fields
        let updateFields = [];
        let params = [
            { type: TYPES.Int, value: parseInt(userId, 10) }
        ];
        let paramIndex = 1;

        if (firstname) {
            updateFields.push(`firstname = @param${paramIndex}`);
            params.push({ type: TYPES.NVarChar, value: firstname });
            paramIndex++;
        }

        if (lastname) {
            updateFields.push(`lastname = @param${paramIndex}`);
            params.push({ type: TYPES.NVarChar, value: lastname });
            paramIndex++;
        }

        if (birthdate) {
            updateFields.push(`birthdate = @param${paramIndex}`);
            params.push({ type: TYPES.Date, value: new Date(birthdate) });
            paramIndex++;
        }

        if (contactNumber) {
            updateFields.push(`mobile_number = @param${paramIndex}`);
            params.push({ type: TYPES.NVarChar, value: contactNumber });
            paramIndex++;
        }

        if (image) {
            updateFields.push(`profile_image = @param${paramIndex}`);
            params.push({ type: TYPES.NVarChar, value: image });
            paramIndex++;
        }

        updateFields.push(`updated_at = GETDATE()`);

        const updateQuery = `
            UPDATE user_profiles 
            SET ${updateFields.join(', ')}
            WHERE user_id = @param0;
            
            SELECT @@ROWCOUNT as affected;
        `;

        const result = await database.executeQuery(updateQuery, params);
        const rowsAffected = result[0][0].value;

        if (rowsAffected > 0) {
            res.json({
                success: true,
                message: 'Profile updated successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

module.exports = router;