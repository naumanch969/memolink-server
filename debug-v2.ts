import dotenv from 'dotenv';
import database from './src/config/database';
import { AnnouncementDeliveryLog } from './src/features/communication/announcement-delivery-log.model';
import { Announcement } from './src/features/communication/announcement.model';
import { getEmailQueue } from './src/features/email/queue/email.queue';

dotenv.config();

async function debug() {
    try {
        await database.connect();
        console.log('Connected to DB');

        const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(1).lean();
        if (announcements.length === 0) {
            console.log('No announcements found.');
            process.exit(0);
        }

        const a = announcements[0];
        console.log(`\nAnnouncement: ${a.title} (${a._id})`);
        console.log(`Status: ${a.status}`);
        console.log(`Stats:`, a.stats);
        console.log(`Target:`, a.target);

        const logs = await AnnouncementDeliveryLog.find({ announcementId: a._id }).lean();
        console.log(`\nLogs Found: ${logs.length}`);

        const statusCounts = logs.reduce((acc: any, log) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
        }, {});
        console.log('Log Status Counts:', statusCounts);

        if (logs.length > 0) {
            console.log('\nSample Logs:');
            logs.slice(0, 5).forEach(l => {
                console.log(`- ${l.recipientEmail}: ${l.status}${l.error ? ` (Error: ${l.error.message})` : ''}`);
            });
        }

        const queue = getEmailQueue();
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getJobCountByTypes('waiting'),
            queue.getJobCountByTypes('active'),
            queue.getJobCountByTypes('completed'),
            queue.getJobCountByTypes('failed'),
            queue.getJobCountByTypes('delayed')
        ]);

        console.log('\nQueue Status:', { waiting, active, completed, failed, delayed });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debug();
