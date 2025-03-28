// src/userRoutes/historyRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious');

router.get('/scan-history/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Fetching scans for userId:', userId);
        
        // Query to get scan information with disease details
        const scanQuery = `
            SELECT 
                rls.rice_leaf_scan_id,
                rls.scan_image,
                rls.disease_confidence_score,
                rls.created_at,
                rld.rice_leaf_disease,
                rld.description as disease_description
            FROM rice_leaf_scan rls
            JOIN rice_leaf_disease rld ON rls.rice_leaf_disease_id = rld.rice_leaf_disease_id
            WHERE rls.user_id = @param0
            ORDER BY rls.created_at DESC
        `;

        const params = [
            { type: TYPES.Int, value: parseInt(userId) }
        ];

        const scanResults = await database.executeQuery(scanQuery, params);
        
        // Process each scan result to include treatments and medicines
        const formattedResults = await Promise.all(scanResults.map(async (row) => {
            const diseaseId = row[4].value; // rice_leaf_disease_id
            
            // Get treatments for this disease
            const treatmentsQuery = `
                SELECT 
                    treatment_id,
                    treatment,
                    description as treatment_description
                FROM local_practice_treatment
                WHERE rice_leaf_disease_id = @param0
            `;
            
            // Get medicines for this disease
            const medicinesQuery = `
                SELECT 
                    medicine_id,
                    rice_plant_medicine,
                    description as medicine_description,
                    image as medicine_image
                FROM rice_plant_medicine
                WHERE rice_leaf_disease_id = @param0
            `;
            
            const [treatmentsResult, medicinesResult] = await Promise.all([
                database.executeQuery(treatmentsQuery, [{ type: TYPES.Int, value: diseaseId }]),
                database.executeQuery(medicinesQuery, [{ type: TYPES.Int, value: diseaseId }])
            ]);

            return {
                id: row[0].value,
                image: row[1].value,
                confidence: Math.round(row[2].value * 100),
                date: row[3].value,
                disease: row[4].value,
                disease_description: row[5].value || 'No disease description available',
                treatments: treatmentsResult.map(t => ({
                    id: t[0].value,
                    name: t[1].value,
                    description: t[2].value
                })),
                medicines: medicinesResult.map(m => ({
                    id: m[0].value,
                    name: m[1].value,
                    description: m[2].value,
                    image: m[3].value
                }))
            };
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