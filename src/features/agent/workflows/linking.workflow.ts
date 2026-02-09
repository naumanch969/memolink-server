
import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import Entry from '../../entry/entry.model';
import { EdgeType, NodeType } from '../../graph/edge.model';
import { graphService } from '../../graph/graph.service';
import { AgentWorkflow } from '../agent.types';

/**
 * Retroactive Linking Workflow:
 * Triggered when a new entity is created. Scans past entries for name matches
 * and creates graph associations without full AI re-extraction.
 */
export const runRetroactiveLinking: AgentWorkflow = async (task) => {
    const { entityId, userId, name, aliases = [] } = task.inputData;
    if (!entityId || !name) throw new Error('entityId and name are required');

    // 1. Build search regex for name and aliases
    const terms = [name, ...aliases].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const combinedRegex = new RegExp(`\\b(${terms.join('|')})\\b`, 'i');

    // 2. Find entries that mention these terms but aren't currently linked to this entity
    const entries = await Entry.find({
        userId: new Types.ObjectId(userId),
        content: { $regex: combinedRegex },
        mentions: { $ne: new Types.ObjectId(entityId) }
    }).limit(100); // Guardrails

    let linkedCount = 0;
    for (const entry of entries) {
        // Create Graph Association
        await graphService.createAssociation({
            fromId: entityId,
            fromType: NodeType.ENTITY, // Default as ENTITY, or passed in
            toId: entry._id.toString(),
            toType: NodeType.CONTEXT,
            relation: EdgeType.MENTIONED_IN,
            metadata: { entryDate: entry.date, name, isRetroactive: true }
        }).catch(err => logger.debug(`Retro-link failed for entry ${entry._id}`));

        // Update Entry Mentions
        await Entry.findByIdAndUpdate(entry._id, {
            $addToSet: { mentions: new Types.ObjectId(entityId) }
        });

        linkedCount++;
    }

    logger.info(`Retroactive Linking completed for ${name}. Linked ${linkedCount} past entries.`);

    return {
        status: 'completed',
        result: { linkedCount }
    };
};
