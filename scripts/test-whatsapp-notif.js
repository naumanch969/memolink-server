
const mongoose = require('mongoose');
const { notificationDispatcher } = require('../src/features/notification/notification.dispatcher');
const { User } = require('../src/features/auth/auth.model');
require('dotenv').config();

async function testNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = '68d27424986236a792e79d8b'; // naumanch969@gmail.com
    
    console.log('Dispatching manual WhatsApp notification...');
    const notification = await notificationDispatcher.dispatch({
      userId,
      type: 'SYSTEM',
      title: 'Manual Test',
      message: '✅ This is a manual test of the WhatsApp notification system.',
      actionUrl: '/dashboard'
    });
    
    console.log('Notification dispatched:', notification._id);
    console.log('WhatsApp Status:', notification.whatsappStatus);
    console.log('WhatsApp ID:', notification.whatsappId);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNotification();
