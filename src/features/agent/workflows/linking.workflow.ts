import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import Entry from '../../entry/entry.model';
import { EdgeType, NodeType } from '../../graph/edge.model';
import { graphService } from '../../graph/graph.service';
import { IAgentWorkflow } from '../agent.interfaces';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult } from '../agent.types';

export class RetroactiveLinkingWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.RETROACTIVE_LINKING;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { entityId, userId, name, aliases = [] } = (task.inputData as any) || {};

        if (!entityId || !name) {
            return { status: 'failed', error: 'entityId and name are required' };
        }

        try {
            // 1. Build search regex for name and aliases
            const terms = [name, ...aliases].map(t => typeof t === 'string' ? t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
            const combinedRegex = new RegExp(`\\b(${terms.filter(t => t).join('|')})\\b`, 'i');

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
                    fromType: NodeType.ENTITY,
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
        } catch (error: any) {
            logger.error(`Retroactive linking failed for ${name}`, error);
            return { status: 'failed', error: error.message };
        }
    }
}

export const retroactiveLinkingWorkflow = new RetroactiveLinkingWorkflow();
