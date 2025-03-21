// src/userRoutes/notificationsRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../db/connection');
const { TYPES } = require('tedious');

// Fetch notifications for a user 
router.get('/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    try {
      // Note the square brackets around 'read' to escape the reserved keyword
      const query = `
        SELECT notification_id, title, body, icon, icon_bg_color as iconBgColor,
        type, data, timestamp, [read]
        FROM user_notifications
        WHERE user_id = @param0
        ORDER BY timestamp DESC
      `;
      
      const params = [
        { type: TYPES.Int, value: userId }
      ];
      
      const results = await database.executeQuery(query, params);
      
      const notifications = results.map(rowColumns => {
        const row = {};
        rowColumns.forEach(column => {
          row[column.metadata.colName] = column;
        });
        
        return {
          id: row.notification_id.value,
          title: row.title.value,
          subtitle: row.body ? row.body.value : '',
          icon: row.icon ? row.icon.value : 'bell',
          iconBgColor: row.iconBgColor ? row.iconBgColor.value : 'gray',
          iconColor: "white",
          type: row.type ? row.type.value : 'general',
          timestamp: row.timestamp ? new Date(row.timestamp.value).getTime() : Date.now(),
          read: row['read'] ? row['read'].value === true : false,
          data: row.data && row.data.value ? JSON.parse(row.data.value) : {}
        };
      });
      
      res.status(200).json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
    }
  });

// Mark all notifications as read or unread for a user
router.put('/notifications-all/:userId/:status', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const status = req.params.status; // 'read-all' or 'unread-all'
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (status !== 'read-all' && status !== 'unread-all') {
      return res.status(400).json({ error: 'Invalid status parameter. Use read-all or unread-all' });
    }
    
    try {
      const readValue = status === 'read-all' ? 1 : 0;
      
      const query = `
        UPDATE user_notifications
        SET [read] = @param1
        WHERE user_id = @param0
      `;
      
      const params = [
        { type: TYPES.Int, value: userId },
        { type: TYPES.Bit, value: readValue }
      ];
      
      await database.executeQuery(query, params);
      
      const message = status === 'read-all' ? 
        'All notifications marked as read' : 
        'All notifications marked as unread';
      
      res.status(200).json({ message });
    } catch (error) {
      console.error(`Error marking all notifications as ${status === 'read-all' ? 'read' : 'unread'}:`, error);
      res.status(500).json({ 
        error: `Failed to mark all notifications as ${status === 'read-all' ? 'read' : 'unread'}`, 
        details: error.message 
      });
    }
});

// Mark notification as read or unread
router.put('/notifications-user/:notificationId/:status', async (req, res) => {
    const notificationId = parseInt(req.params.notificationId, 10);
    const status = req.params.status; // 'read' or 'unread'
    
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    
    if (status !== 'read' && status !== 'unread') {
      return res.status(400).json({ error: 'Invalid status parameter. Use read or unread' });
    }
    
    try {
      const readValue = status === 'read' ? 1 : 0;
      
      const query = `
        UPDATE user_notifications
        SET [read] = @param1
        WHERE notification_id = @param0
      `;
      
      const params = [
        { type: TYPES.Int, value: notificationId },
        { type: TYPES.Bit, value: readValue }
      ];
      
      await database.executeQuery(query, params);
      
      const message = status === 'read' ? 
        'Notification marked as read' : 
        'Notification marked as unread';
      
      res.status(200).json({ message });
    } catch (error) {
      console.error(`Error marking notification as ${status}:`, error);
      res.status(500).json({ 
        error: `Failed to mark notification as ${status}`, 
        details: error.message 
      });
    }
});

// Store notification for a user -admin
router.post('/store-notification', async (req, res) => {
    const { user_id, title, body, data, icon, icon_bg_color, type } = req.body;
  
    if (!user_id || !title) {
      return res.status(400).json({ error: 'User ID and title are required' });
    }
  
    try {
      const query = `
        INSERT INTO user_notifications (user_id, title, body, icon, icon_bg_color, type, data)
        VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6)
      `;
      
      const params = [
        { type: TYPES.Int, value: user_id },
        { type: TYPES.NVarChar, value: title },
        { type: TYPES.NVarChar, value: body || '' },
        { type: TYPES.NVarChar, value: icon || 'bell' },
        { type: TYPES.NVarChar, value: icon_bg_color || 'gray' },
        { type: TYPES.NVarChar, value: type || 'general' },
        { type: TYPES.NVarChar, value: data ? JSON.stringify(data) : null }
      ];
      
      await database.executeQuery(query, params);
      
      res.status(200).json({ message: 'Notification stored successfully' });
    } catch (error) {
      console.error('Error storing notification:', error);
      res.status(500).json({ error: 'Failed to store notification' });
    }
  });

// Store notification for all users - Admin
router.post('/store-notification-all', async (req, res) => {
  const { title, body, data, icon, icon_bg_color, type } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  try {
    // First, get all user IDs from the database
    const getUsersQuery = `SELECT user_id FROM user_profiles`;
    const usersResult = await database.executeQuery(getUsersQuery, []);
    
    // Log the entire result to understand the structure
    console.log('Database result structure:', JSON.stringify(usersResult).substring(0, 500));
    
    // Extract users based on common result patterns
    let users = [];
    if (Array.isArray(usersResult)) {
      users = usersResult; // Most common pattern
    } else if (usersResult && usersResult.recordset) {
      users = usersResult.recordset; // MSSQL pattern
    } else if (usersResult && usersResult.rows) {
      users = usersResult.rows; // PostgreSQL pattern
    }
    
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    
    // Log the first user to understand its structure
    console.log('First user structure:', JSON.stringify(users[0]));
    
    // Prepare the notification insert query
    const insertQuery = `
      INSERT INTO user_notifications (user_id, title, body, icon, icon_bg_color, type, data)
      VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6)
    `;
    
    let successCount = 0;
    
    // Loop through all users and insert the notification for each
    for (const user of users) {
      // Try multiple ways to extract user_id based on common patterns
      let userId = null;
      
      // Try as direct property
      if (user && user.user_id !== undefined) {
        userId = user.user_id;
      } 
      // Try as property with metadata
      else if (user && user.user_id && user.user_id.value !== undefined) {
        userId = user.user_id.value;
      }
      // Try first property if only one exists
      else if (user && Object.keys(user).length === 1) {
        userId = user[Object.keys(user)[0]];
      }
      // Try as array
      else if (Array.isArray(user) && user.length > 0) {
        userId = user[0];
      }
      
      console.log(`User: ${JSON.stringify(user)}, Extracted userId: ${userId}`);
      
      if (!userId) {
        console.log('Skipping user due to null userId');
        continue;
      }
      
      // Handle if userId is still an object
      if (typeof userId === 'object' && userId !== null) {
        // Try common patterns for ID objects
        if (userId.value !== undefined) userId = userId.value;
        else if (userId.id !== undefined) userId = userId.id;
        else if (userId.ID !== undefined) userId = userId.ID;
        else userId = null;
      }
      
      if (!userId) {
        console.log('Skipping user, could not extract valid userId');
        continue;
      }
      
      const params = [
        { type: TYPES.Int, value: userId },
        { type: TYPES.NVarChar, value: title },
        { type: TYPES.NVarChar, value: body || '' },
        { type: TYPES.NVarChar, value: icon || 'bell' },
        { type: TYPES.NVarChar, value: icon_bg_color || 'gray' },
        { type: TYPES.NVarChar, value: type || 'general' },
        { type: TYPES.NVarChar, value: data ? JSON.stringify(data) : null }
      ];
      
      try {
        await database.executeQuery(insertQuery, params);
        successCount++;
        console.log(`Successfully inserted notification for user ${userId}`);
      } catch (innerError) {
        console.error(`Error inserting notification for user ${userId}:`, innerError.message);
      }
    }
    
    res.status(200).json({ 
      message: `Notification stored successfully for ${successCount} users` 
    });
  } catch (error) {
    console.error('Error storing notification for all users:', error);
    res.status(500).json({ 
      error: 'Failed to store notification for all users',
      details: error.message 
    });
  }
});

// Delete a notification
router.delete('/delete/:notificationId', async (req, res) => {
    const notificationId = req.params.notificationId;
    
    try {
      const query = `
        DELETE FROM user_notifications
        WHERE notification_id = @param0
      `;
      
      const params = [
        { type: TYPES.Int, value: notificationId }
      ];
      
      await database.executeQuery(query, params);
      
      res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

// Delete all notifications for a user
router.delete('/delete-all/:userId/clear', async (req, res) => {
    const userId = req.params.userId;
    
    try {
      const query = `
        DELETE FROM user_notifications
        WHERE user_id = @param0
      `;
      
      const params = [
        { type: TYPES.Int, value: userId }
      ];
      
      await database.executeQuery(query, params);
      
      res.status(200).json({ message: 'All notifications cleared' });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({ error: 'Failed to clear notifications' });
    }
  });

// Fetch admin and their push tokens
router.get('/fetch-admin', async (req, res) => {
  try {
    const query = `
      SELECT user_id, push_token
      FROM user_credentials
      WHERE role_id = @param0 AND push_token IS NOT NULL
    `;
    
    const params = [
      { type: TYPES.Int, value: 0 }
    ];
    
    const results = await database.executeQuery(query, params);
    
    const users = results.map(rowColumns => {
      const row = {};
      rowColumns.forEach(column => {
        row[column.metadata.colName] = column;
      });
      
      return {
        userId: row.user_id.value,
        pushToken: row.push_token.value
      };
    });
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users with push tokens:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users with push tokens', 
      details: error.message 
    });
  }
});

module.exports = router;