// src/userRoutes/scaRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const database = require('../db/connection');
const { TYPES } = require('tedious');
const { bucketScan } = require('../services');

// Upload scanned image endpoint
router.post('/upload', multer().single('image'), async (req, res) => {
    try {
        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname}`;
        
        const blob = bucketScan.file(fileName);
        const blobStream = blob.createWriteStream();

        blobStream.on('finish', async () => {
            const publicUrl = `https://storage.googleapis.com/${bucketScan.name}/${fileName}`;
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

// Save scanned image endpoint
router.post("/save", async (req, res) => {
    try {
        const { user_profile_id, disease_prediction, disease_prediction_score, scan_image } = req.body;
        
        const missingFields = [];

        if (!scan_image) missingFields.push('scan_image');
        if (!user_profile_id) missingFields.push('user_profile_id');
        if (disease_prediction_score === null || disease_prediction_score === undefined) 
        {
            missingFields.push('disease_prediction_score');
        }
        if (disease_prediction === null || disease_prediction === undefined) 
        {
            missingFields.push('disease_prediction');
        }

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                message: "Missing required fields", 
                missingFields: missingFields 
            });
        }

        // Query to insert leaf scan
        const leafScanQuery = `
            INSERT INTO rice_leaf_scan (
                user_id,
                rice_leaf_disease_id,
                disease_confidence_score,
                created_at,
                scan_image
            ) 
            VALUES (@param0, @param1, @param2, GETDATE(), @param3);
            SELECT SCOPE_IDENTITY() as rice_leaf_scan_id;
        `;

        const leafScanParams = [
            { type: TYPES.VarChar, value: user_profile_id.toString() },
            { type: TYPES.Int, value: parseInt(disease_prediction, 10) },
            { type: TYPES.Float, value: parseFloat(disease_prediction_score) },
            { type: TYPES.VarChar, value: scan_image }
        ];

        try {
            // Execute leaf scan insertion
            const leafScanResult = await database.executeQuery(leafScanQuery, leafScanParams);
            const rice_leaf_scan_id = leafScanResult[0][0].value;

            // Insert into scan history
            const scanHistoryQuery = `
                INSERT INTO scan_history (
                    rice_leaf_scan_id,
                    date_captured
                ) VALUES (@param0, GETDATE())
            `;

            const scanHistoryParams = [
                { type: TYPES.Int, value: rice_leaf_scan_id }
            ];

            await database.executeQuery(scanHistoryQuery, scanHistoryParams);

            res.status(201).json({ 
                message: "Scan data saved successfully",
                rice_leaf_scan_id: rice_leaf_scan_id
            });

        } catch (error) {
            console.error('Detailed error:', error);
            res.status(500).json({ 
                message: "Server error during scan data saving",
                error: error.message
            });
        }
    } catch (err) {
        console.error('Detailed error:', err);
        res.status(500).json({ 
            message: "Server error during scan data saving",
            error: err.message
        });
    } 
});

// Disease Info Endpoint
router.get('/disease-info/:classNumber', async (req, res) => {
    try {
        const { classNumber } = req.params;
        
        const query = `
            SELECT 
              rld.rice_leaf_disease,
              rld.description as disease_description,
              rld.medicine_id,
              rld.treatment_id,
              lpt.treatment,
              lpt.description as treatment_description,
              rpm.rice_plant_medicine,
              rpm.description as medicine_description
            FROM 
              rice_leaf_disease rld
            LEFT JOIN 
              local_practice_treatment lpt ON rld.treatment_id = lpt.treatment_id
            LEFT JOIN 
              rice_plant_medicine rpm ON rld.medicine_id = rpm.medicine_id
            WHERE 
              rld.rice_leaf_disease_id = @param0
        `;
        
        const params = [
            { type: TYPES.Int, value: parseInt(classNumber, 10) }
        ];
        
        const result = await database.executeQuery(query, params);
        
        if (result.length === 0) {
            return res.status(404).json({ 
                error: 'No disease information found for the given class number' 
            });
        }
        
        // Convert Tedious result to a more readable object
        const diseaseInfo = {
            rice_leaf_disease: result[0][0].value,
            disease_description: result[0][1].value,
            medicine_id: result[0][2].value,
            treatment_id: result[0][3].value,
            treatment: result[0][4].value,
            treatment_description: result[0][5].value,
            rice_plant_medicine: result[0][6].value,
            medicine_description: result[0][7].value
        };
        
        res.json(diseaseInfo);
    } catch (error) {
        console.error('Error fetching disease information:', error);
        res.status(500).json({ 
            error: 'Internal server error while fetching disease information',
            details: error.message
        });
    }
});

module.exports = router;