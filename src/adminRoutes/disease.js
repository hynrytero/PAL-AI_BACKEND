// src/routes/diseases.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { bucketMedicine } = require('../services');
const multer = require('multer');
const path = require('path');
const { TYPES } = require('tedious');

// Configure multer for temporary file storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: function (req, file, cb) {
    const allowedFileTypes = /jpeg|jpg|png|gif/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only!');
    }
  }
});

// Utility function to upload file to Google Cloud Storage
const uploadToGCS = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const filename = `medicine-${Date.now()}${path.extname(file.originalname)}`;
    const blob = bucketMedicine.file(filename);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype
      }
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      // Construct public URL
      const publicUrl = `https://storage.googleapis.com/${bucketMedicine.name}/${filename}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

// Get all diseases
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        rice_leaf_disease_id, 
        rice_leaf_disease, 
        description
      FROM rice_leaf_disease
    `;
    
    const results = await database.executeQuery(query, []);
    
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No diseases found'
      });
    }

    const formattedResults = results.map(row => {
      const diseaseRow = {};
      row.forEach(column => {
        diseaseRow[column.metadata.colName] = column.value;
      });
      return {
        disease_id: diseaseRow.rice_leaf_disease_id,
        name: diseaseRow.rice_leaf_disease,
        description: diseaseRow.description || ''
      };
    });
    
    res.status(200).json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching diseases',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add new medicine
router.post('/new-medicine', upload.single('image'), async (req, res) => {
  try {
    const { 
      rice_leaf_disease_id, 
      rice_plant_medicine, 
      description 
    } = req.body;

    // Validate required fields
    if (!rice_plant_medicine) {
      return res.status(400).json({
        success: false,
        message: 'Medicine name is required'
      });
    }

    // Prepare parameters for query
    const params = [
      {
        type: TYPES.Int,
        value: rice_leaf_disease_id ? parseInt(rice_leaf_disease_id, 10) : null
      },
      {
        type: TYPES.NVarChar,
        value: rice_plant_medicine
      },
      {
        type: TYPES.NVarChar,
        value: description || ''
      }
    ];

    // Upload image to Google Cloud Storage if present
    let imagePath = null;
    if (req.file) {
      try {
        imagePath = await uploadToGCS(req.file);
        params.push({
          type: TYPES.NVarChar,
          value: imagePath
        });
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload image'
        });
      }
    } else {
      params.push({
        type: TYPES.NVarChar,
        value: null
      });
    }

    // Prepare SQL query
    const query = `
      INSERT INTO rice_plant_medicine 
      (rice_leaf_disease_id, rice_plant_medicine, description, image) 
      VALUES (@param0, @param1, @param2, @param3);
      
      SELECT SCOPE_IDENTITY() as insertId;
    `;

    // Execute query
    const result = await database.executeQuery(query, params);

    // Get the inserted ID
    const insertedId = result[0][0].value;

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      medicineId: insertedId,
      data: {
        rice_leaf_disease_id,
        rice_plant_medicine,
        description,
        image: imagePath
      }
    });
  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

//edit medicine
router.put('/edit/:medicineId', upload.single('image'), async (req, res) => {
  try {
    const medicineId = parseInt(req.params.medicineId);
    const { 
      rice_leaf_disease_id, 
      rice_plant_medicine, 
      description 
    } = req.body;

    // Validate required fields
    if (!medicineId && (!rice_leaf_disease_id && !rice_plant_medicine && !description && !req.file)) {
      return res.status(400).json({
        success: false,
        message: 'Medicine ID and at least one update field are required'
      });
    }

    // Construct dynamic update query
    const updateFields = [];
    const params = [];
    let paramCounter = 0;

    if (rice_leaf_disease_id) {
      updateFields.push(`rice_leaf_disease_id = @param${paramCounter}`);
      params.push({ type: TYPES.Int, value: parseInt(rice_leaf_disease_id) });
      paramCounter++;
    }

    if (rice_plant_medicine) {
      updateFields.push(`rice_plant_medicine = @param${paramCounter}`);
      params.push({ type: TYPES.VarChar, value: rice_plant_medicine });
      paramCounter++;
    }

    if (description !== undefined) {
      updateFields.push(`description = @param${paramCounter}`);
      params.push({ type: TYPES.VarChar, value: description });
      paramCounter++;
    }

    // Handle image update
    if (req.file) {
      updateFields.push(`image = @param${paramCounter}`);
      params.push({ 
        type: TYPES.VarBinary, 
        value: req.file.buffer 
      });
      paramCounter++;
    }

    // Add medicine ID as the last parameter
    params.push({ type: TYPES.Int, value: medicineId });

    const query = `
      UPDATE rice_plant_medicine
      SET ${updateFields.join(', ')}
      WHERE medicine_id = @param${paramCounter};

      SELECT 
        medicine_id, 
        rice_leaf_disease_id, 
        rice_plant_medicine, 
        description,
        CASE WHEN image IS NOT NULL THEN 'Image uploaded' ELSE NULL END as image_status
      FROM rice_plant_medicine
      WHERE medicine_id = @param${paramCounter};
    `;
    
    const results = await database.executeQuery(query, params);
    
    // Check if any rows were updated
    if (results.length === 0 || !results[0]) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found or no changes made'
      });
    }

    // Return the updated medicine details
    const updatedMedicine = {
      medicine_id: results[0][0].value,
      rice_leaf_disease_id: results[0][1].value,
      rice_plant_medicine: results[0][2].value,
      description: results[0][3].value || null,
      image_status: results[0][4].value
    };

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: updatedMedicine
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete medicine/treatment with image
router.delete('/delete/:medicineId', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.medicineId);

    // Validate medicine ID
    if (!medicineId) {
      return res.status(400).json({
        success: false,
        message: 'Medicine ID is required'
      });
    }

    // Prepare delete query
    const query = `
      DELETE FROM rice_plant_medicine
      WHERE medicine_id = @param0;

      SELECT @@ROWCOUNT AS deleted_count;
    `;
    
    const params = [
      { type: TYPES.Int, value: medicineId }
    ];
    
    const results = await database.executeQuery(query, params);
    // Check if any rows were deleted
    const deletedCount = results[0][0].value;
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Medicine deleted successfully',
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting medicine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;