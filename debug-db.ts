import dotenv from 'dotenv';
import mongoose from 'mongoose';
import database from './src/config/database';
import { User } from './src/features/auth/auth.model';

dotenv.config();

async function debug() {
    try {
        await database.connect();
        console.log('Connected to DB');

        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
        const roles = await User.distinct('role');

        console.log({
            totalUsers,
            verifiedUsers,
            roles
        });

        const usersByRole = await Promise.all(roles.map(async role => ({
            role,
            count: await User.countDocuments({ role, isEmailVerified: true })
        })));

        console.log('Verified Users by Role:', usersByRole);

        const latestAnnouncement = await mongoose.connection.collection('announcements').find().sort({ createdAt: -1 }).limit(1).toArray();
        console.log('Latest Announcement Stats:', latestAnnouncement[0]?.stats);
        console.log('Latest Announcement Target:', latestAnnouncement[0]?.target);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debug();
