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
        
        // Query to get disease information
        const diseaseQuery = `
            SELECT 
              rice_leaf_disease,
              description as disease_description
            FROM 
              rice_leaf_disease
            WHERE 
              rice_leaf_disease_id = @param0
        `;
        
        // Query to get treatments
        const treatmentsQuery = `
            SELECT 
              treatment_id,
              treatment,
              description as treatment_description
            FROM 
              local_practice_treatment
            WHERE 
              rice_leaf_disease_id = @param0
        `;
        
        // Query to get medicines
        const medicinesQuery = `
            SELECT 
              medicine_id,
              rice_plant_medicine,
              description as medicine_description,
              image as medicine_image
            FROM 
              rice_plant_medicine
            WHERE 
              rice_leaf_disease_id = @param0
        `;
        
        const params = [
            { type: TYPES.Int, value: parseInt(classNumber, 10) }
        ];
        
        // Execute all queries
        const [diseaseResult, treatmentsResult, medicinesResult] = await Promise.all([
            database.executeQuery(diseaseQuery, params),
            database.executeQuery(treatmentsQuery, params),
            database.executeQuery(medicinesQuery, params)
        ]);
        
        if (diseaseResult.length === 0) {
            return res.status(404).json({ 
                error: 'No disease information found for the given class number' 
            });
        }
        
        // Convert results to more readable objects
        const diseaseInfo = {
            rice_leaf_disease: diseaseResult[0][0].value,
            disease_description: diseaseResult[0][1].value,
            treatments: treatmentsResult.map(row => ({
                id: row[0].value,
                name: row[1].value,
                description: row[2].value
            })),
            medicines: medicinesResult.map(row => ({
                id: row[0].value,
                name: row[1].value,
                description: row[2].value,
                image: row[3].value
            }))
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