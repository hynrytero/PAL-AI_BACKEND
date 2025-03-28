// src/userRoutes/historyRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious');

router.get('/scan-history/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Fetching scans for userId:', userId);
        
        // Single optimized query that gets all required data
        const query = `
            SELECT 
                rls.rice_leaf_scan_id,
                rls.scan_image,
                rls.disease_confidence_score,
                rls.created_at,
                rld.rice_leaf_disease,
                rld.description as disease_description,
                (
                    SELECT 
                        treatment_id as id,
                        treatment as name,
                        description
                    FROM local_practice_treatment pt
                    WHERE pt.rice_leaf_disease_id = rld.rice_leaf_disease_id
                    FOR JSON PATH
                ) as treatments,
                (
                    SELECT 
                        medicine_id as id,
                        rice_plant_medicine as name,
                        description,
                        image
                    FROM rice_plant_medicine rpm
                    WHERE rpm.rice_leaf_disease_id = rld.rice_leaf_disease_id
                    FOR JSON PATH
                ) as medicines
            FROM rice_leaf_scan rls
            JOIN rice_leaf_disease rld ON rls.rice_leaf_disease_id = rld.rice_leaf_disease_id
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
            disease_description: row[5].value || 'No disease description available',
            treatments: row[6].value || [],
            medicines: row[7].value || []
        }));

        res.json(formattedResults);
    } catch (error) {
        console.error('Error fetching scan history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch scan history',
            details: error.message
        });
    }
});

module.exports = router;