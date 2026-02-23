import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { KnowledgeEntity } from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import { Tag } from '../tag/tag.model';

import { IAnalyticsGraphService } from './analytics.interfaces';

export class AnalyticsGraphService implements IAnalyticsGraphService {
    /**
     * Generates graph data (nodes and links) based on entity co-occurrence in entries.
     */
    async getGraphData(userId: string): Promise<{ nodes: any[]; links: any[]; }> {
        try {
            const userObjectId = new Types.ObjectId(userId);

            // 1. Fetch entities and tags to create base nodes
            const [entities, tags, entries] = await Promise.all([
                KnowledgeEntity.find({ userId: userObjectId, isDeleted: false }).select('_id name avatar otype').lean(),
                Tag.find({ userId: userObjectId }).select('_id name color').lean(),
                Entry.find({ userId: userObjectId })
                    .select('_id mentions tags')
                    .populate('mentions', '_id name')
                    .populate('tags', '_id name')
                    .lean()
            ]);

            const nodes: any[] = [];
            const links: any[] = [];
            const nodeIds = new Set<string>();

            // Add Entity Nodes
            entities.forEach(e => {
                nodes.push({ id: e._id.toString(), label: e.name, group: 'entity', img: e.avatar, val: 1, otype: e.otype });
                nodeIds.add(e._id.toString());
            });

            // Add Tag Nodes
            tags.forEach(t => {
                nodes.push({ id: t._id.toString(), label: t.name, group: 'tag', color: t.color, val: 1 });
                nodeIds.add(t._id.toString());
            });

            // Calculate Edges based on Co-occurrence in Entries
            const linkMap = new Map<string, number>();

            entries.forEach(entry => {
                const entitiesInEntry = [
                    ...(entry.mentions || []).map((m: any) => m._id.toString()),
                    ...(entry.tags || []).map((t: any) => t._id.toString())
                ];

                // Create links between all unique pairs in this entry
                for (let i = 0; i < entitiesInEntry.length; i++) {
                    for (let j = i + 1; j < entitiesInEntry.length; j++) {
                        const source = entitiesInEntry[i];
                        const target = entitiesInEntry[j];

                        if (nodeIds.has(source) && nodeIds.has(target)) {
                            const linkKey = [source, target].sort().join('-');
                            linkMap.set(linkKey, (linkMap.get(linkKey) || 0) + 1);
                        }
                    }
                }
            });

            linkMap.forEach((weight, key) => {
                const [source, target] = key.split('-');
                links.push({ source, target, value: weight });
            });

            // Update node values (size) based on link weight
            links.forEach(link => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);
                if (sourceNode) sourceNode.val += link.value * 0.5;
                if (targetNode) targetNode.val += link.value * 0.5;
            });

            return { nodes, links };
        } catch (error) {
            logger.error('[AnalyticsGraphService] Failed to generate graph data:', error);
            throw error;
        }
    }
}

export const analyticsGraphService = new AnalyticsGraphService();
