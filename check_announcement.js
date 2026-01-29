const mongoose = require('mongoose');

async function checkAnnouncement() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink-dev');
        
        const Announcement = mongoose.model('Announcement', new mongoose.Schema({}, { strict: false }));
        
        const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(3);
        
        console.log('\n=== Recent Announcements ===');
        announcements.forEach((ann, i) => {
            console.log(`\n${i + 1}. ${ann.title}`);
            console.log(`   Status: ${ann.status}`);
            console.log(`   Stats:`, JSON.stringify(ann.stats, null, 2));
            console.log(`   Created: ${ann.createdAt}`);
            console.log(`   Sent At: ${ann.sentAt || 'Not sent'}`);
        });
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkAnnouncement();
