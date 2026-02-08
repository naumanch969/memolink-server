import * as dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { logger } from '../config/logger';
import { KnowledgeEntity } from '../features/entity/entity.model';
import { entityService } from '../features/entity/entity.service';
import { EdgeType, GraphEdge, NodeType } from '../features/graph/edge.model';
import { Person } from '../features/person/person.model';

dotenv.config();

async function migrate() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink';

    try {
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB for migration');

        // 1. Migrate People to KnowledgeEntities
        const persons = await Person.find({});
        logger.info(`Found ${persons.length} persons to migrate`);

        for (const person of persons) {
            try {
                // Check if already migrated
                const existing = await KnowledgeEntity.findById(person._id);
                if (existing) {
                    logger.debug(`Entity ${person.name} already exists, skipping...`);
                    continue;
                }

                // Create KnowledgeEntity with same ID
                const entity = new KnowledgeEntity({
                    _id: person._id,
                    userId: person.userId,
                    name: person.name,
                    otype: NodeType.PERSON, // Storing 'KnowledgeEntity' as otype
                    email: person.email,
                    phone: person.phone,
                    avatar: person.avatar,
                    jobTitle: person.jobTitle,
                    company: person.company,
                    tags: person.tags,
                    notes: person.notes,
                    interactionCount: person.interactionCount,
                    lastInteractionAt: person.lastInteractionAt,
                    lastInteractionSummary: person.lastInteractionSummary,
                    isDeleted: person.isDeleted,
                    deletedAt: person.deletedAt,
                    createdAt: person.createdAt,
                    updatedAt: person.updatedAt
                });

                await entity.save();
                logger.info(`Migrated person: ${person.name} (${person._id})`);

                // Sync with Redis for the user
                await entityService.syncRegistry(person.userId.toString());
            } catch (err) {
                logger.error(`Failed to migrate person ${person.name}:`, err);
            }
        }

        // 3. Ensure 'MENTIONED_IN' edges exist for all entries with mentions
        const { default: Entry } = await import('../features/entry/entry.model');
        const entriesWithMentions = await Entry.find({ mentions: { $exists: true, $not: { $size: 0 } } });
        logger.info(`Found ${entriesWithMentions.length} entries with mentions to verify graph edges`);

        for (const entry of entriesWithMentions) {
            for (const personId of entry.mentions) {
                try {
                    await GraphEdge.findOneAndUpdate(
                        {
                            "from.id": new Types.ObjectId(personId),
                            "to.id": entry._id,
                            relation: EdgeType.MENTIONED_IN
                        },
                        {
                            $set: {
                                "from.type": NodeType.PERSON,
                                "to.type": NodeType.CONTEXT,
                                weight: 1.0,
                                metadata: { entryDate: entry.date }
                            }
                        },
                        { upsert: true }
                    );
                } catch (err) {
                    logger.error(`Failed to create MENTIONED_IN edge for entry ${entry._id} and person ${personId}`);
                }
            }
        }

        // 4. Update existing GraphEdge polymorphic types to match new Model Names
        logger.info('Updating existing GraphEdge polymorphic types to match new Model Names...');

        const updates = [
            { old: 'Person', new: NodeType.PERSON },
            { old: 'Entity', new: NodeType.ENTITY },
            { old: 'Routine', new: NodeType.ROUTINE },
            { old: 'Context', new: NodeType.CONTEXT },
        ];

        for (const up of updates) {
            const resFrom = await GraphEdge.updateMany({ "from.type": up.old }, { $set: { "from.type": up.new } });
            const resTo = await GraphEdge.updateMany({ "to.type": up.old }, { $set: { "to.type": up.new } });
            logger.info(`Updated type ${up.old} to ${up.new}: ${resFrom.modifiedCount} from, ${resTo.modifiedCount} to`);
        }

        logger.info('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
