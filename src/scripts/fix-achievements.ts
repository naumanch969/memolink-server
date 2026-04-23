
import mongoose from 'mongoose';
import { User } from '../features/auth/auth.model';
import { badgeService } from '../features/badge/badge.service';
import { logger } from '../config/logger';

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brinn';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        await badgeService.seedBadges();
        console.log('Badge registry ensured.');

        const users = await User.find({});
        console.log(`Processing ${users.length} users for achievement backfill...`);

        for (const user of users) {
             console.log(`Checking achievements for: ${user.email} (${user._id})`);
             await badgeService.handleEntryCreatedAchievements(user._id.toString());
        }

        console.log('Achievement fix completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

run();
