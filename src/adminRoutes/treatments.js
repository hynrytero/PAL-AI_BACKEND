const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious'); 

// Get all treatments/medicines
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        medicine_id, 
        rice_plant_medicine, 
        description,
        image,
        rice_leaf_disease_id
      FROM rice_plant_medicine
    `;
    
    const results = await database.executeQuery(query,[]);
    
    const formattedResults = results.map(row => ({
      medicine_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      image: row[3].value || null,
      rld_id: row[4].value
    }));

    res.status(200).json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get treatment details by id
router.get('/fetch/:id', async (req, res) => {
  try {
    const query = `
      SELECT  
        rp.medicine_id,
        rp.rice_plant_medicine as name, 
        rp.description, 
        rp.image,
        rld.rice_leaf_disease_id,
        rld.rice_leaf_disease as disease_name,
        rld.description as disease_description
      FROM rice_plant_medicine rp
      JOIN rice_leaf_disease rld ON rp.rice_leaf_disease_id = rld.rice_leaf_disease_id
      WHERE rp.medicine_id = @param0
    `;
    
    const params = [
      { type: TYPES.Int, value: parseInt(req.params.id) }
    ];
    
    const results = await database.executeQuery(query, params);
    
    if (results.length === 0 || !results[0]) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }
    
    const treatment = {
      medicine_id: results[0][0].value,
      name: results[0][1].value,
      description: results[0][2].value || '',
      image: results[0][3].value ? 
        `data:image/jpeg;base64,${results[0][3].value.toString('base64')}` : 
        null,
      disease: {
        disease_id: results[0][4].value,
        name: results[0][5].value,
        description: results[0][6].value || ''
      }
    };
    
    res.status(200).json({
      success: true,
      data: treatment
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatment details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get treatments by disease ID
router.get('/by-disease/:diseaseId', async (req, res) => {
  try {
    const query = `
      SELECT 
        pt.treatment_id, 
        pt.treatment as name, 
        pt.description,
        rld.rice_leaf_disease_id,
        rld.rice_leaf_disease as disease_name
      FROM local_practice_treatment pt
      JOIN rice_leaf_disease rld ON pt.rice_leaf_disease_id = rld.rice_leaf_disease_id
      WHERE pt.rice_leaf_disease_id = @param0
    `;
    
    const params = [
      { type: TYPES.Int, value: parseInt(req.params.diseaseId) }
    ];
    
    const results = await database.executeQuery(query, params);
    
    const formattedResults = results.map(row => ({
      treatment_id: row[0].value,
      name: row[1].value,
      description: row[2].value || '',
      rice_leaf_disease_id: row[3].value,
      disease_name: row[4].value
    }));

    res.status(200).json({
      success: true,
      count: formattedResults.length,
      data: formattedResults
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatments by disease',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add treatments
router.post('/add', async (req, res) => {
  try {
    const { 
      rice_leaf_disease_id, 
      treatment, 
      description 
    } = req.body;

    // Validate required fields
    if (!rice_leaf_disease_id || !treatment) {
      return res.status(400).json({
        success: false,
        message: 'Disease ID and treatment name are required'
      });
    }

    const query = `
      INSERT INTO local_practice_treatment 
      (rice_leaf_disease_id, treatment, description)
      VALUES (@param0, @param1, @param2);
      
      SELECT SCOPE_IDENTITY() AS new_treatment_id;
    `;
    
    const params = [
      { type: TYPES.Int, value: parseInt(rice_leaf_disease_id) },
      { type: TYPES.VarChar, value: treatment },
      { type: TYPES.VarChar, value: description || null }
    ];
    
    const results = await database.executeQuery(query, params);
    
    // The new treatment ID will be in the first row, first column
    const newTreatmentId = results[0][0].value;

    res.status(201).json({
      success: true,
      message: 'Treatment added successfully',
      data: {
        treatment_id: newTreatmentId,
        rice_leaf_disease_id,
        treatment,
        description
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Edit existing treatment
router.put('/edit/:treatmentId', async (req, res) => {
  try {
    const treatmentId = parseInt(req.params.treatmentId);
    const { 
      rice_leaf_disease_id, 
      treatment, 
      description 
    } = req.body;

    // Validate required fields
    if (!treatmentId || (!rice_leaf_disease_id && !treatment && !description)) {
      return res.status(400).json({
        success: false,
        message: 'Treatment ID and at least one update field are required'
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

    if (treatment) {
      updateFields.push(`treatment = @param${paramCounter}`);
      params.push({ type: TYPES.VarChar, value: treatment });
      paramCounter++;
    }

    if (description !== undefined) {
      updateFields.push(`description = @param${paramCounter}`);
      params.push({ type: TYPES.VarChar, value: description });
      paramCounter++;
    }

    // Add treatment ID as the last parameter
    params.push({ type: TYPES.Int, value: treatmentId });

    const query = `
      UPDATE local_practice_treatment
      SET ${updateFields.join(', ')}
      WHERE treatment_id = @param${paramCounter};

      SELECT 
        treatment_id, 
        rice_leaf_disease_id, 
        treatment, 
        description
      FROM local_practice_treatment
      WHERE treatment_id = @param${paramCounter};
    `;
    
    const results = await database.executeQuery(query, params);
    
    // Check if any rows were updated
    if (results.length === 0 || !results[0]) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found or no changes made'
      });
    }

    // Return the updated treatment details
    const updatedTreatment = {
      treatment_id: results[0][0].value,
      rice_leaf_disease_id: results[0][1].value,
      treatment: results[0][2].value,
      description: results[0][3].value || null
    };

    res.status(200).json({
      success: true,
      message: 'Treatment updated successfully',
      data: updatedTreatment
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete existing treatment
router.delete('/delete/:treatmentId', async (req, res) => {
  try {
    const treatmentId = parseInt(req.params.treatmentId);

    // Validate treatment ID
    if (!treatmentId) {
      return res.status(400).json({
        success: false,
        message: 'Treatment ID is required'
      });
    }

    const query = `
      DELETE FROM local_practice_treatment
      WHERE treatment_id = @param0;

      SELECT @@ROWCOUNT AS deleted_count;
    `;
    
    const params = [
      { type: TYPES.Int, value: treatmentId }
    ];
    
    const results = await database.executeQuery(query, params);
    
    // Check if any rows were deleted
    const deletedCount = results[0][0].value;
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Treatment deleted successfully',
      data: {
        treatment_id: treatmentId,
        deleted_count: deletedCount
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting treatment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;