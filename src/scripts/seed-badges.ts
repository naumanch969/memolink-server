
import mongoose from 'mongoose';
import { BadgeDefinition } from '../features/badge/badge.model';
import { INITIAL_BADGES } from '../features/badge/badge.registry';
import { logger } from '../config/logger';

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        // Use environment variable if possible, fallback to local for development
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brinn';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        console.log('Clearing existing definitions...');
        await BadgeDefinition.deleteMany({});

        console.log('Seeding registry...');
        for (const badge of INITIAL_BADGES) {
            await BadgeDefinition.create(badge);
        }

        console.log('Successfully seeded 16 badge definitions.');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
