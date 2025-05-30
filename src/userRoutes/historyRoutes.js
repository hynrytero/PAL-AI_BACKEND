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
            confidence: (row[2].value * 100).toFixed(2),
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

// endpoint for scraping disease info from a website
router.post('/scrape-text/diseaseInfo', async (req, res) => {
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
            whatItDoes: {
                text: '',
                lists: []
            },
            whyAndWhereItOccurs: {
                text: '',
                lists: []
            },
            howToIdentify: {
                text: '',
                lists: []
            }
        };

        // Function to get paragraphs and lists after a heading until the next h2
        const getContentAfterHeading = (heading) => {
            const content = {
                text: [],
                lists: []
            };
            let current = heading.next();
            
            while (current.length && !current.is('h2')) {
                if (current.is('p')) {
                    content.text.push(current.text().trim());
                }
                if (current.is('ul, ol')) {
                    const listItems = [];
                    current.find('li').each((_, item) => {
                        listItems.push($(item).text().trim());
                    });
                    content.lists.push(listItems);
                }
                current = current.next();
            }
            
            return content;
        };

        // Get content for each section
        $('h2').each((_, element) => {
            const heading = $(element);
            const headingText = heading.text().trim().toLowerCase();
            
            if (headingText === 'what it does') {
                const content = getContentAfterHeading(heading);
                scrapedContent.whatItDoes = {
                    text: content.text.join('\n\n'),
                    lists: content.lists
                };
            } else if (headingText === 'why and where it occurs') {
                const content = getContentAfterHeading(heading);
                scrapedContent.whyAndWhereItOccurs = {
                    text: content.text.join('\n\n'),
                    lists: content.lists
                };
            } else if (headingText === 'how to identify') {
                const content = getContentAfterHeading(heading);
                scrapedContent.howToIdentify = {
                    text: content.text.join('\n\n'),
                    lists: content.lists
                };
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

router.post('/scrape-text/diseaseTreatment', async (req, res) => {
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
            Howtomanage: {
                text: '',
                lists: []
            }
        };

        // Function to get paragraphs and lists after a heading until the next h2
        const getContentAfterHeading = (heading) => {
            const content = {
                text: [],
                lists: []
            };
            let current = heading.next();
            
            while (current.length && !current.is('h2')) {
                if (current.is('p')) {
                    content.text.push(current.text().trim());
                }
                if (current.is('ul, ol')) {
                    const listItems = [];
                    current.find('li').each((_, item) => {
                        listItems.push($(item).text().trim());
                    });
                    content.lists.push(listItems);
                }
                current = current.next();
            }
            
            return content;
        };

        // Get content for each section
        $('h2').each((_, element) => {
            const heading = $(element);
            const headingText = heading.text().trim().toLowerCase();
            
            if (headingText === 'how to manage') {
                const content = getContentAfterHeading(heading);
                scrapedContent.Howtomanage = {
                    text: content.text.join('\n\n'),
                    lists: content.lists
                };
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