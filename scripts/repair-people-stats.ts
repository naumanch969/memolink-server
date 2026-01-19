
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { Person } from '../src/features/person/person.model';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink';

const repair = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Step 1: Set interactionCount to 0 where it doesn't exist
        const initResult = await Person.updateMany(
            { interactionCount: { $exists: false } },
            { $set: { interactionCount: 0 } }
        );
        console.log(`Initialized ${initResult.modifiedCount} people with missing interactionCount.`);

        // Step 2: Recalculate actual interaction counts from entries
        const { Entry } = await import('../src/features/entry/entry.model');

        // Get all people
        const people = await Person.find({});
        console.log(`Recalculating interaction counts for ${people.length} people...`);

        let updated = 0;
        for (const person of people) {
            // Count entries that mention this person
            const count = await Entry.countDocuments({
                userId: person.userId,
                mentions: person._id
            });

            // Get most recent interaction
            const lastEntry = await Entry.findOne({
                userId: person.userId,
                mentions: person._id
            }).sort({ createdAt: -1 }).select('createdAt');

            await Person.updateOne(
                { _id: person._id },
                {
                    $set: {
                        interactionCount: count,
                        lastInteractionAt: lastEntry?.createdAt || null
                    }
                }
            );
            updated++;
            if (updated % 10 === 0) {
                console.log(`  Progress: ${updated}/${people.length}`);
            }
        }

        console.log(`Updated ${updated} people with recalculated interaction counts.`);

        // Optional: Recalculate counts based on entries?
        // That would be heavier. For now, setting to 0 fixes the sorting issue for "undefined" values.

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

repair();
