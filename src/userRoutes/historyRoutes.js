// src/userRoutes/historyRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious');

router.get('/scan-history/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Fetching scans for userId:', userId);
        const query = `
            SELECT 
                rls.rice_leaf_scan_id,
                rls.scan_image,
                rls.disease_confidence_score,
                rls.created_at,
                rld.rice_leaf_disease,
                rld.description as disease_description,
                rpm.rice_plant_medicine,
                rpm.description as medicine_description,
                rpm.image as medicine_image
            FROM rice_leaf_scan rls
            JOIN rice_leaf_disease rld ON rls.rice_leaf_disease_id = rld.rice_leaf_disease_id
            LEFT JOIN rice_plant_medicine rpm ON rld.rice_leaf_disease_id = rpm.rice_leaf_disease_id
            WHERE rls.user_id = @param0
            ORDER BY rls.created_at DESC
        `;

        const params = [
            { type: TYPES.Int, value: parseInt(userId) }
        ];

        const results = await database.executeQuery(query, params);
        
        const formattedResults = results.map(row => ({
            id: row[0].value,
            image: row[1].value,
            confidence: Math.round(row[2].value * 100),
            date: row[3].value,
            disease: row[4].value,
            diseaseDescription: row[5].value || 'No disease description available',
            medicine: row[6].value || 'No medicine name available',
            medicineDescription: row[7].value || 'No medicine information available',
            medicineImage: row[8].value || null
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error('Error fetching scan history:', error);
        res.status(500).json({ error: 'Failed to fetch scan history' });
    }
});

module.exports = router;