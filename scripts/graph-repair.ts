import 'dotenv/config';
import mongoose from 'mongoose';
import { logger } from '../src/config/logger';
import KnowledgeEntity from '../src/features/entity/entity.model';
import Entry from '../src/features/entry/entry.model';
import Goal from '../src/features/goal/goal.model';
import { EdgeType, NodeType } from '../src/features/graph/edge.model';
import { graphService } from '../src/features/graph/graph.service';
import { Reminder } from '../src/features/reminder/reminder.model';

async function repairGraph() {
    try {
        logger.info('Starting Graph Repair/Backfill...');
        await mongoose.connect(process.env.MONGODB_URI!);
        logger.info('Database connected.');

        // 1. Backfill Goals -> User
        const goals = await Goal.find({ status: { $ne: 'archived' } });
        logger.info(`Found ${goals.length} goals to backfill.`);
        for (const goal of goals) {
            await graphService.createAssociation({
                fromId: goal.userId.toString(),
                fromType: NodeType.USER,
                toId: goal._id.toString(),
                toType: NodeType.GOAL,
                relation: EdgeType.HAS_GOAL,
                metadata: { title: goal.title, isBackfill: true }
            }).catch(err => logger.error(`Goal ${goal._id} failed`, err));
        }

        // 2. Backfill Reminders -> User
        const reminders = await Reminder.find({ status: { $ne: 'cancelled' } });
        logger.info(`Found ${reminders.length} reminders to backfill.`);
        for (const r of reminders) {
            await graphService.createAssociation({
                fromId: r.userId.toString(),
                fromType: NodeType.USER,
                toId: r._id.toString(),
                toType: NodeType.REMINDER,
                relation: EdgeType.HAS_TASK,
                metadata: { title: r.title, isBackfill: true }
            }).catch(err => logger.error(`Reminder ${r._id} failed`, err));
        }

        // 3. Backfill Entities -> User (Ego-Edges)
        const entities = await KnowledgeEntity.find({ isDeleted: false });
        logger.info(`Found ${entities.length} entities to backfill ego-edges.`);
        for (const e of entities) {
            const egoRelation = e.otype === NodeType.PERSON ? EdgeType.KNOWS : EdgeType.INTERESTED_IN;
            await graphService.createAssociation({
                fromId: e.userId.toString(),
                fromType: NodeType.USER,
                toId: e._id.toString(),
                toType: e.otype as NodeType,
                relation: egoRelation,
                metadata: { name: e.name, isBackfill: true }
            }).catch(err => logger.error(`Entity ${e._id} ego-edge failed`, err));
        }

        // 4. Backfill Mentions (Entry -> Entity)
        const entries = await Entry.find({ "mentions.0": { $exists: true } });
        logger.info(`Found ${entries.length} entries with mentions to backfill.`);
        for (const entry of entries) {
            if (entry.mentions && entry.mentions.length > 0) {
                for (const entityId of entry.mentions) {
                    const entity = await KnowledgeEntity.findById(entityId);
                    if (entity) {
                        await graphService.createAssociation({
                            fromId: entity._id.toString(),
                            fromType: entity.otype as NodeType,
                            toId: entry._id.toString(),
                            toType: NodeType.CONTEXT,
                            relation: EdgeType.MENTIONED_IN,
                            metadata: { entryDate: entry.date, name: entity.name, isBackfill: true }
                        }).catch(err => logger.debug(`Entry ${entry._id} mention backfill failed`, err));
                    }
                }
            }
        }

        logger.info('Graph Repair/Backfill completed successfully.');
    } catch (error) {
        logger.error('Graph Repair failed', error);
    } finally {
        await mongoose.disconnect();
    }
}

repairGraph();
