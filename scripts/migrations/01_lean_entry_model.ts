import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.production') });

const BATCH_SIZE = 500;

async function migrateData() {
    console.log('--- Starting Data Migration: Splitting Entry and EnrichedEntry ---\n');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI is undefined.');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ Connected to MongoDB.');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error("Unable to access db object");
        }

        const entriesCollection = db.collection('entries');
        const enrichedEntriesCollection = db.collection('enrichedentries');

        // Check indexing to ensure EnrichedEntry has vector indices
        console.log('Indexing status should be reviewed. Remember to setup the enriched_vector_index on MongoDB Atlas for the `EnrichedEntry` collection.');

        const count = await entriesCollection.countDocuments({
            $or: [
                { embeddings: { $exists: true } },
                { mood: { $exists: true } },
                { mentions: { $exists: true, $not: { $size: 0 } } }
            ]
        });
        console.log(`\nFound ${count} entries needing migration.`);

        let processedCount = 0;
        let enrichedCreatedCount = 0;

        const cursor = entriesCollection.find({
            $or: [
                { embeddings: { $exists: true } },
                { mood: { $exists: true } },
                { mentions: { $exists: true, $not: { $size: 0 } } }
            ]
        }).batchSize(BATCH_SIZE);

        for await (const rawEntry of cursor) {
            // 1. Create matching EnrichedEntry if it doesn't already exist for this entry
            const existingEnriched = await enrichedEntriesCollection.findOne({ referenceId: rawEntry._id });

            const enrichedMetadata: any = {
                themes: [],
                emotions: [],
                people: [],
                entities: [],
                sentimentScore: 0
            };

            if (rawEntry.mood) {
                enrichedMetadata.emotions.push({
                    name: rawEntry.mood,
                    score: rawEntry.moodMetadata?.score || 3,
                    icon: rawEntry.moodMetadata?.icon || ''
                });
            }

            if (rawEntry.mentions && Array.isArray(rawEntry.mentions) && rawEntry.mentions.length > 0) {
                rawEntry.mentions.forEach((mentionId: any) => {
                    enrichedMetadata.entities.push({
                        entityId: mentionId,
                        name: "Legacy Mention", // This can't be resolved easily without a join, fallback.
                        type: "Entity"
                    });
                })
            }

            const timestamp = rawEntry.createdAt ? new Date(rawEntry.createdAt) : new Date();

            if (!existingEnriched && (rawEntry.embeddings || rawEntry.mood || rawEntry.mentions)) {
                await enrichedEntriesCollection.insertOne({
                    userId: rawEntry.userId,
                    referenceId: rawEntry._id,
                    sessionId: 'migration-session',
                    sourceType: 'active',
                    inputMethod: rawEntry.type === 'media' ? 'voice' : 'text',
                    processingStatus: 'completed',
                    content: rawEntry.content || '',
                    metadata: enrichedMetadata,
                    embedding: rawEntry.embeddings || [],
                    timestamp: timestamp,
                    createdAt: timestamp,
                    updatedAt: new Date()
                });
                enrichedCreatedCount++;
            }

            // 2. Clean up Entry
            const updateQuery: any = { $unset: {} };

            if (rawEntry.embeddings) updateQuery.$unset.embeddings = "";
            if (rawEntry.mood) updateQuery.$unset.mood = "";
            if (rawEntry.moodMetadata) updateQuery.$unset.moodMetadata = "";
            if (rawEntry.aiProcessed !== undefined) updateQuery.$unset.aiProcessed = "";
            if (rawEntry.mentions) updateQuery.$unset.mentions = "";

            if (Object.keys(updateQuery.$unset).length > 0) {
                await entriesCollection.updateOne(
                    { _id: rawEntry._id },
                    updateQuery
                );
            }

            processedCount++;
            if (processedCount % 100 === 0) {
                process.stdout.write(`\rProgress: ${processedCount}/${count} entries processed.      `);
            }
        }

        console.log(`\n\n✅ Migration Complete!`);
        console.log(`- Entries Leaned: ${processedCount}`);
        console.log(`- New EnrichedEntries Created: ${enrichedCreatedCount}`);
        console.log('\nRemember to review indexes on both collections.');

    } catch (err) {
        console.error('\n❌ Migration failed:', err);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('MongoDB disconnected.');
        }
        process.exit(0);
    }
}

migrateData();
