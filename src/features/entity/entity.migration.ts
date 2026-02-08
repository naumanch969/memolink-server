import mongoose, { Types } from 'mongoose';
import { logger } from '../../config/logger';
import Entry from '../entry/entry.model';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { Person } from '../person/person.model';
import { Reminder } from '../reminder/reminder.model';
import KnowledgeEntity from './entity.model';
import { entityService } from './entity.service';

interface MigrationStats {
    usersProcessed: number;
    personsProcessed: number;
    entriesUpdated: number;
    remindersUpdated: number;
    mediaUpdated: number;
    goalsLinked: number;
    remindersLinked: number;
    errors: string[];
}

export class EntityMigration {
    private stats: MigrationStats = {
        usersProcessed: 0,
        personsProcessed: 0,
        entriesUpdated: 0,
        remindersUpdated: 0,
        mediaUpdated: 0,
        goalsLinked: 0,
        remindersLinked: 0,
        errors: []
    };

    /**
     * Complete migration from legacy Person/Relation models to Knowledge Entities/Graph
     * This includes:
     * 1. Person -> KnowledgeEntity conversion
     * 2. Entry.mentions update (Person IDs -> Entity IDs)
     * 3. Reminder.linkedPeople update (Person IDs -> Entity IDs)
     * 4. Media.faces update (Person IDs -> Entity IDs)
     * 5. Graph edges creation for goals/reminders ownership
     * 6. MENTIONED_IN edges for historical entry-entity links
     */
    async migrateAll(): Promise<MigrationStats> {
        logger.info('=========================================');
        logger.info('Starting Complete Person -> Entity Migration');
        logger.info('=========================================');

        this.stats = {
            usersProcessed: 0,
            personsProcessed: 0,
            entriesUpdated: 0,
            remindersUpdated: 0,
            mediaUpdated: 0,
            goalsLinked: 0,
            remindersLinked: 0,
            errors: []
        };

        try {
            // 1. Fetch all users
            const { User } = await import('../auth/auth.model');
            const users = await User.find({});
            logger.info(`Found ${users.length} users for migration.`);

            for (const user of users) {
                try {
                    await this.migrateUser(user._id.toString());
                    this.stats.usersProcessed++;
                } catch (err: any) {
                    logger.error(`Failed to migrate user ${user._id}: ${err.message}`);
                    this.stats.errors.push(`User ${user._id}: ${err.message}`);
                }
            }

            logger.info('=========================================');
            logger.info('Migration Summary:');
            logger.info(`  Users Processed: ${this.stats.usersProcessed}`);
            logger.info(`  Persons Migrated: ${this.stats.personsProcessed}`);
            logger.info(`  Entries Updated: ${this.stats.entriesUpdated}`);
            logger.info(`  Reminders Updated: ${this.stats.remindersUpdated}`);
            logger.info(`  Media Updated: ${this.stats.mediaUpdated}`);
            logger.info(`  Goals Linked: ${this.stats.goalsLinked}`);
            logger.info(`  Reminders Linked: ${this.stats.remindersLinked}`);
            logger.info(`  Errors: ${this.stats.errors.length}`);
            if (this.stats.errors.length > 0) {
                logger.warn('Errors encountered:', this.stats.errors);
            }
            logger.info('=========================================');

            return this.stats;
        } catch (error) {
            logger.error('Global Migration Failed:', error);
            throw error;
        }
    }

    async migrateUser(userId: string): Promise<void> {
        logger.info(`[User ${userId}] Starting migration...`);
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // =====================================================
                // STEP 1: Migrate Persons -> KnowledgeEntities
                // =====================================================
                const persons = await Person.find({ userId, isDeleted: { $ne: true } }).session(session);
                const personMap: Record<string, string> = {}; // OldPersonId -> NewEntityId

                logger.info(`[User ${userId}] Found ${persons.length} persons to migrate`);

                for (const p of persons) {
                    try {
                        // Check if entity already exists (idempotency)
                        const existing = await KnowledgeEntity.findOne({
                            userId: new Types.ObjectId(userId),
                            name: p.name,
                            otype: NodeType.PERSON
                        }).session(session);

                        if (existing) {
                            personMap[p._id.toString()] = existing._id.toString();
                            logger.debug(`[User ${userId}] Entity already exists for "${p.name}"`);
                            continue;
                        }

                        const entity = await entityService.createEntity(userId, {
                            name: p.name,
                            otype: NodeType.PERSON,
                            email: p.email,
                            phone: p.phone,
                            avatar: p.avatar,
                            jobTitle: p.jobTitle,
                            company: p.company,
                            role: p.role,
                            birthday: p.birthday,
                            address: p.address,
                            tags: p.tags,
                            interactionCount: p.interactionCount || 0,
                            lastInteractionAt: p.lastInteractionAt,
                            lastInteractionSummary: p.lastInteractionSummary,
                            sentimentScore: p.sentimentScore || 0,
                            rawMarkdown: p.notes || '',
                            summary: p.lastInteractionSummary || '',
                            metadata: {
                                socialLinks: (p as any).socialLinks,
                                isPlaceholder: (p as any).isPlaceholder,
                                legacyPersonId: p._id.toString(),
                                migratedAt: new Date().toISOString()
                            }
                        }, { session });

                        personMap[p._id.toString()] = entity._id.toString();
                        this.stats.personsProcessed++;
                    } catch (err: any) {
                        // Handle duplicate - find existing by name
                        const existing = await entityService.findOrCreateEntity(
                            userId,
                            p.name,
                            NodeType.PERSON,
                            { session }
                        );
                        personMap[p._id.toString()] = existing._id.toString();
                        logger.debug(`[User ${userId}] Used findOrCreate for "${p.name}"`);
                    }
                }

                // =====================================================
                // STEP 2: Migrate Entry.mentions (Person IDs -> Entity IDs)
                // =====================================================
                const entries = await Entry.find({
                    userId,
                    mentions: { $exists: true, $not: { $size: 0 } }
                }).session(session);

                logger.info(`[User ${userId}] Found ${entries.length} entries with mentions`);

                for (const entry of entries) {
                    let hasChanged = false;
                    const newMentions: Types.ObjectId[] = [];

                    for (const m of entry.mentions) {
                        const oldId = m.toString();
                        const newId = personMap[oldId];

                        if (newId && newId !== oldId) {
                            newMentions.push(new Types.ObjectId(newId));
                            hasChanged = true;
                        } else {
                            // Keep existing (might already be entity ID)
                            newMentions.push(m);
                        }
                    }

                    if (hasChanged) {
                        entry.mentions = newMentions;
                        await entry.save({ session });
                        this.stats.entriesUpdated++;
                    }

                    // Create MENTIONED_IN edges for all mentions (idempotent via upsert)
                    for (const mId of entry.mentions) {
                        try {
                            await graphService.createAssociation({
                                fromId: mId.toString(),
                                fromType: NodeType.PERSON,
                                toId: entry._id.toString(),
                                toType: NodeType.CONTEXT,
                                relation: EdgeType.MENTIONED_IN,
                                metadata: {
                                    entryDate: entry.date,
                                    migrationSource: 'entity-migration'
                                }
                            }, { session });
                        } catch (edgeErr) {
                            // Ignore edge creation errors (might be duplicate)
                        }
                    }
                }

                // =====================================================
                // STEP 3: Migrate Reminder.linkedPeople
                // =====================================================
                const reminders = await Reminder.find({
                    userId,
                    linkedEntities: { $exists: true, $not: { $size: 0 } }
                }).session(session);

                logger.info(`[User ${userId}] Found ${reminders.length} reminders with linkedPeople`);

                for (const rem of reminders) {
                    let hasChanged = false;
                    const newLinkedPeople: Types.ObjectId[] = [];

                    for (const p of rem.linkedEntities) {
                        const oldId = p.toString();
                        const newId = personMap[oldId];

                        if (newId && newId !== oldId) {
                            newLinkedPeople.push(new Types.ObjectId(newId));
                            hasChanged = true;
                        } else {
                            newLinkedPeople.push(p);
                        }
                    }

                    if (hasChanged) {
                        rem.linkedEntities = newLinkedPeople;
                        await rem.save({ session });
                        this.stats.remindersUpdated++;
                    }
                }

                // =====================================================
                // STEP 4: Migrate Media.faces.entityId
                // =====================================================
                const { Media } = await import('../media/media.model');
                const mediaItems = await Media.find({
                    userId,
                    'metadata.faces': { $exists: true, $not: { $size: 0 } }
                }).session(session);

                logger.info(`[User ${userId}] Found ${mediaItems.length} media items with faces`);

                for (const item of mediaItems) {
                    if (!item.metadata?.faces) continue;

                    let hasChanged = false;
                    const newFaces = item.metadata.faces.map((f: any) => {
                        if (!f.entityId) return f;

                        const oldId = f.entityId.toString();
                        const newId = personMap[oldId];

                        if (newId && newId !== oldId) {
                            hasChanged = true;
                            return { ...f, entityId: new Types.ObjectId(newId) };
                        }
                        return f;
                    });

                    if (hasChanged) {
                        item.metadata.faces = newFaces;
                        item.markModified('metadata.faces');
                        await item.save({ session });
                        this.stats.mediaUpdated++;
                    }
                }

                // =====================================================
                // STEP 5: Create Graph Edges for Goals (Ownership)
                // =====================================================
                const { Goal } = await import('../goal/goal.model');
                const goals = await Goal.find({ userId }).session(session);

                for (const goal of goals) {
                    try {
                        await graphService.createAssociation({
                            fromId: userId,
                            fromType: NodeType.USER,
                            toId: goal._id.toString(),
                            toType: NodeType.GOAL,
                            relation: EdgeType.HAS_GOAL,
                            metadata: { title: goal.title, migrationSource: 'entity-migration' }
                        }, { session });
                        this.stats.goalsLinked++;
                    } catch (err) {
                        // Ignore duplicate edges
                    }
                }

                // =====================================================
                // STEP 6: Create Graph Edges for Reminders (Ownership)
                // =====================================================
                const allReminders = await Reminder.find({ userId }).session(session);

                for (const rem of allReminders) {
                    try {
                        await graphService.createAssociation({
                            fromId: userId,
                            fromType: NodeType.USER,
                            toId: rem._id.toString(),
                            toType: NodeType.REMINDER,
                            relation: EdgeType.HAS_TASK,
                            metadata: { title: rem.title, migrationSource: 'entity-migration' }
                        }, { session });
                        this.stats.remindersLinked++;
                    } catch (err) {
                        // Ignore duplicate edges
                    }
                }
            });

            // Post-transaction: Sync Redis Registry
            try {
                await entityService.syncRegistry(userId);
            } catch (syncErr) {
                logger.warn(`[User ${userId}] Registry sync failed: ${syncErr}`);
            }

            logger.info(`[User ${userId}] Migration completed successfully`);
        } catch (error) {
            logger.error(`[User ${userId}] Migration failed:`, error);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Cleanup: Archive legacy Person collection after successful migration
     * This is a destructive operation - run only after verifying migration success
     */
    async archiveLegacyPersons(): Promise<{ archived: number }> {
        logger.info('Archiving legacy Person documents...');

        const session = await mongoose.startSession();
        let archived = 0;

        try {
            await session.withTransaction(async () => {
                // Soft-delete all persons by setting isDeleted = true
                const result = await Person.updateMany(
                    { isDeleted: { $ne: true } },
                    {
                        $set: {
                            isDeleted: true,
                            deletedAt: new Date(),
                            'metadata.archivedReason': 'migration-to-entities'
                        }
                    },
                    { session }
                );
                archived = result.modifiedCount;
            });

            logger.info(`Archived ${archived} legacy Person documents`);
            return { archived };
        } finally {
            await session.endSession();
        }
    }

    /**
     * Verification: Check migration completeness
     */
    async verifyMigration(): Promise<{
        personsCount: number;
        entitiesCount: number;
        unmappedMentions: number;
        unmappedLinkedPeople: number;
        success: boolean;
    }> {
        const personsCount = await Person.countDocuments({ isDeleted: { $ne: true } });
        const entitiesCount = await KnowledgeEntity.countDocuments({ isDeleted: { $ne: true } });

        // Check for any entries with mentions that don't resolve to entities
        const entriesWithOldMentions = await Entry.aggregate([
            { $unwind: '$mentions' },
            {
                $lookup: {
                    from: 'knowledge_entities',
                    localField: 'mentions',
                    foreignField: '_id',
                    as: 'entity'
                }
            },
            { $match: { entity: { $size: 0 } } },
            { $count: 'count' }
        ]);
        const unmappedMentions = entriesWithOldMentions[0]?.count || 0;

        // Check for reminders with old linkedPeople
        const remindersWithOldLinks = await Reminder.aggregate([
            { $unwind: '$linkedPeople' },
            {
                $lookup: {
                    from: 'knowledge_entities',
                    localField: 'linkedPeople',
                    foreignField: '_id',
                    as: 'entity'
                }
            },
            { $match: { entity: { $size: 0 } } },
            { $count: 'count' }
        ]);
        const unmappedLinkedPeople = remindersWithOldLinks[0]?.count || 0;

        const success = unmappedMentions === 0 && unmappedLinkedPeople === 0;

        logger.info('Migration Verification:');
        logger.info(`  Legacy Persons: ${personsCount}`);
        logger.info(`  Knowledge Entities: ${entitiesCount}`);
        logger.info(`  Unmapped Mentions: ${unmappedMentions}`);
        logger.info(`  Unmapped LinkedPeople: ${unmappedLinkedPeople}`);
        logger.info(`  Success: ${success}`);

        return { personsCount, entitiesCount, unmappedMentions, unmappedLinkedPeople, success };
    }

    /**
     * Cleanup orphan mentions: Remove mention IDs that don't resolve to any entity
     * Use this after migration to clean up any orphan references
     */
    async cleanupOrphanMentions(): Promise<{ entriesCleaned: number; orphansRemoved: number }> {
        logger.info('Cleaning up orphan mentions...');

        let entriesCleaned = 0;
        let orphansRemoved = 0;

        // Find entries with orphan mentions
        const orphanData = await Entry.aggregate([
            { $match: { mentions: { $exists: true, $not: { $size: 0 } } } },
            { $unwind: { path: '$mentions', preserveNullAndEmptyArrays: false } },
            {
                $lookup: {
                    from: 'knowledge_entities',
                    localField: 'mentions',
                    foreignField: '_id',
                    as: 'entity'
                }
            },
            { $match: { entity: { $size: 0 } } },
            {
                $group: {
                    _id: '$_id',
                    orphanMentions: { $push: '$mentions' }
                }
            }
        ]);

        logger.info(`Found ${orphanData.length} entries with orphan mentions`);

        for (const item of orphanData) {
            try {
                const entry = await Entry.findById(item._id);
                if (!entry) continue;

                const orphanIds = new Set(item.orphanMentions.map((id: Types.ObjectId) => id.toString()));
                const cleanedMentions = entry.mentions.filter(m => !orphanIds.has(m.toString()));

                if (cleanedMentions.length !== entry.mentions.length) {
                    const removed = entry.mentions.length - cleanedMentions.length;
                    entry.mentions = cleanedMentions;
                    await entry.save();
                    entriesCleaned++;
                    orphansRemoved += removed;
                    logger.debug(`Cleaned entry ${entry._id}: removed ${removed} orphan mentions`);
                }
            } catch (err) {
                logger.warn(`Failed to clean entry ${item._id}: ${err}`);
            }
        }

        logger.info(`Cleanup complete: ${entriesCleaned} entries cleaned, ${orphansRemoved} orphans removed`);
        return { entriesCleaned, orphansRemoved };
    }
}

export const entityMigration = new EntityMigration();
export default entityMigration;
