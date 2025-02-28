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

// Store notification for a user
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

module.exports = router;