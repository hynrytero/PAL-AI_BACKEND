const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious');
const axios = require('axios');
const cheerio = require('cheerio');

// Existing route for scan history
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
                    FOR JSON PATH, INCLUDE_NULL_VALUES
                ) as treatments,
                (
                    SELECT 
                        medicine_id as id,
                        rice_plant_medicine as name,
                        description,
                        image
                    FROM rice_plant_medicine rpm
                    WHERE rpm.rice_leaf_disease_id = rld.rice_leaf_disease_id
                    FOR JSON PATH, INCLUDE_NULL_VALUES
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
            treatments: JSON.parse(row[6].value || '[]'),
            medicines: JSON.parse(row[7].value || '[]')
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

// New endpoint for scraping text from a website
router.post('/scrape-text', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log('Scraping text data from:', url);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Initialize object to store sections
        const scrapedContent = {
            whatItDoes: '',
            whyAndWhereItOccurs: '',
            howToIdentify: ''
        };

        // Function to get paragraphs after a heading until the next h2
        const getParagraphsAfterHeading = (heading) => {
            const paragraphs = [];
            let current = heading.next();
            
            while (current.length && !current.is('h2')) {
                if (current.is('p')) {
                    paragraphs.push(current.text().trim());
                }
                current = current.next();
            }
            
            return paragraphs.join('\n\n');
        };

        // Get content for each section
        $('h2').each((_, element) => {
            const heading = $(element);
            const headingText = heading.text().trim().toLowerCase();
            
            if (headingText === 'what it does') {
                scrapedContent.whatItDoes = getParagraphsAfterHeading(heading);
            } else if (headingText === 'why and where it occurs') {
                scrapedContent.whyAndWhereItOccurs = getParagraphsAfterHeading(heading);
            } else if (headingText === 'how to identify') {
                scrapedContent.howToIdentify = getParagraphsAfterHeading(heading);
            }
        });
        
        res.json({ 
            url,
            content: scrapedContent,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error scraping website:', error);
        res.status(500).json({ 
            error: 'Failed to scrape website',
            details: error.message
        });
    }
});

module.exports = router;