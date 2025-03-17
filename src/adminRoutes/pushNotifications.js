// src/adminRoutes/pushNotification.js
const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const { TYPES } = require('tedious'); 
const database = require('../db/connection');
const expo = new Expo();

// Send notification to a specific user by user_id
router.post('/notify', async (req, res) => {
    const { user_id, title, body, data } = req.body;
  
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
  
    try {
      // Get the user's push token from database using user_id
      const userResult = await database.executeQuery(
        'SELECT push_token FROM user_credentials WHERE user_id = @param0', 
        [{ type: TYPES.Int, value: user_id }] 
      );
      
      if (!userResult || userResult.length === 0 || !userResult[0][0].value) {
        return res.status(404).json({ 
          error: 'User not found or has no push token registered',
          pushedToDevice: false
        });
      }
      
      const token = userResult[0][0].value;
      
      if (Expo.isExpoPushToken(token)) {
        // Swap title and notification type for push notification
        const notificationTitle = data?.type || 'General';
        const notificationSubtitle = title || 'New Notification';
        
        const messages = [{
          to: token,
          sound: 'default',
          title: notificationTitle.charAt(0).toUpperCase() + notificationTitle.slice(1),
          subtitle: notificationSubtitle,
          body: body || 'You have a new notification',
          data: data || {}
        }];
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (let chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error('Error sending chunk:', error);
          }
        }
        
        res.status(200).json({ 
          message: 'Notification sent successfully',
          pushedToDevice: true,
          tickets 
        });
      } else {
        res.status(400).json({ 
          error: 'Invalid push token stored for user',
          pushedToDevice: false
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Broadcast notification to all users with registered push tokens
router.post('/broadcast', async (req, res) => {
    const { title, body, data } = req.body;
  
    try {
      // Get all valid push tokens from the database
      const usersResult = await database.executeQuery(
        'SELECT push_token FROM user_credentials WHERE push_token IS NOT NULL',
        [] 
      );
      
      if (!usersResult || usersResult.length === 0) {
        return res.status(404).json({ error: 'No users with push tokens found' });
      }
      
      const tokens = usersResult.map(user => user[0].value);
      const validTokens = tokens.filter(token => token && Expo.isExpoPushToken(token));
      
      if (validTokens.length === 0) {
        return res.status(400).json({ error: 'No valid push tokens found in database' });
      }
  
      // Swap title and notification type for push notification
      const notificationTitle = data?.type || 'Broadcast';
      const notificationSubtitle = title || 'Broadcast Notification';
      
      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: notificationTitle.charAt(0).toUpperCase() + notificationTitle.slice(1),
        subtitle: notificationSubtitle,
        body: body || 'You have a new broadcast notification',
        data: data || {}
      }));
  
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      let failedDeliveries = 0;
  
      for (let chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending chunk:', error);
          failedDeliveries += chunk.length;
        }
      }
  
      res.status(200).json({ 
        message: `Broadcast sent successfully to ${validTokens.length - failedDeliveries} of ${validTokens.length} users`,
        successCount: validTokens.length - failedDeliveries,
        failedCount: failedDeliveries,
        tokenCount: validTokens.length,
        tickets 
      });
    } catch (error) {
      console.error('Error broadcasting:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

module.exports = router;