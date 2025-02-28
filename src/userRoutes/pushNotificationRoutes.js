const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const db = require('../db/connection'); 
const expo = new Expo();

// Send notification to a specific user by user_id
router.post('/notify', async (req, res) => {
    const { user_id, title, body, data } = req.body;
  
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
  
    try {
      // Get the user's push token from database using user_id
      const user = await db.query('SELECT push_token FROM user_credentials WHERE user_id = ?', [user_id]);
      
      if (!user || user.length === 0 || !user[0].push_token) {
        return res.status(404).json({ 
          error: 'User not found or has no push token registered',
          pushedToDevice: false
        });
      }
      
      const token = user[0].push_token;
      
      if (Expo.isExpoPushToken(token)) {
        const messages = [{
          to: token,
          sound: 'default',
          title: title || 'New Notification',
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
      const users = await db.query('SELECT push_token FROM user_credentials WHERE push_token IS NOT NULL');
      
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'No users with push tokens found' });
      }
      
      const tokens = users.map(user => user.push_token);
      const validTokens = tokens.filter(token => token && Expo.isExpoPushToken(token));
      
      if (validTokens.length === 0) {
        return res.status(400).json({ error: 'No valid push tokens found in database' });
      }
  
      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: title || 'Broadcast Notification',
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
      console.error('Error sending broadcast:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

module.exports = router;