
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { User } from '../features/auth/auth.model';
import { Entry } from '../features/entry/entry.model';
import { badgeService } from '../features/badge/badge.service';
import { logger } from '../config/logger';

dotenv.config();

async function backfillBadges() {
    try {
        console.log('Starting retroactive badge award script...');
        await mongoose.connect(config.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log(`Analyzing ${users.length} users for eligibility...`);

        let firstThoughtCount = 0;
        let tenThoughtCount = 0;
        let fiftyThoughtCount = 0;
        let hundredThoughtCount = 0;

        for (const user of users) {
            const userId = user._id.toString();
            const entryCount = await Entry.countDocuments({ userId: user._id });

            if (entryCount >= 1) {
                const badge = await badgeService.awardBadge(userId, 'first_thought', { note: 'Retroactive award' });
                if (badge) firstThoughtCount++;
            }

            if (entryCount >= 10) {
                const badge = await badgeService.awardBadge(userId, 'ten_thoughts', { note: 'Retroactive award' });
                if (badge) tenThoughtCount++;
            }

            if (entryCount >= 50) {
                const badge = await badgeService.awardBadge(userId, 'fifty_thoughts', { note: 'Retroactive award' });
                if (badge) fiftyThoughtCount++;
            }

            if (entryCount >= 100) {
                const badge = await badgeService.awardBadge(userId, 'memory_keeper', { note: 'Retroactive award' });
                if (badge) hundredThoughtCount++;
            }
        }

        console.log('\n--- Backfill Results ---');
        console.log(`First Thought (1+):  ${firstThoughtCount} awarded`);
        console.log(`Deca-Thought (10+):  ${tenThoughtCount} awarded`);
        console.log(`Thought Weaver (50+): ${fiftyThoughtCount} awarded`);
        console.log(`Memory Keeper (100+): ${hundredThoughtCount} awarded`);
        console.log('------------------------\n');

    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

backfillBadges();
