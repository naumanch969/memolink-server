
import mongoose from 'mongoose';
import { User } from '../features/auth/auth.model';
import { Entry } from '../features/entry/entry.model';
import { Tag } from '../features/tag/tag.model';

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brinn';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const users = await User.find({ 
            $or: [
                { interests: { $exists: false } },
                { interests: { $size: 0 } }
            ]
        });

        console.log(`Processing ${users.length} users for interest migration...`);

        for (const user of users) {
             // Find the first entry for this user
             const firstEntry = await Entry.findOne({ userId: user._id }).sort({ createdAt: 1 }).populate({ path: 'tags', model: Tag });
             
             if (firstEntry && firstEntry.tags && firstEntry.tags.length > 0) {
                 const interestNames = (firstEntry.tags as any[]).map(t => t.name);
                 
                 user.interests = interestNames;
                 await user.save();
                 
                 console.log(`Migrated ${interestNames.length} interests for user: ${user.email}`);
             } else {
                 console.log(`No interests found for user: ${user.email}`);
             }
        }

        console.log('Interest migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
