import { Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { GraphEdge } from './edge.model';
import KnowledgeEntity from '../entity/entity.model';
import Goal from '../goal/goal.model';
import { Reminder } from '../reminder/reminder.model';

export class GraphController {
    /**
     * Fetches the entire personal memory graph for the authenticated user
     */
    static async getGraph(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id;

            const [entities, goals, reminders] = await Promise.all([
                KnowledgeEntity.find({ userId, isDeleted: false }).lean(),
                Goal.find({ userId, status: { $ne: 'archived' } }).lean(),
                Reminder.find({ userId, status: { $ne: 'cancelled' } }).lean()
            ]);

            const entityIds = entities.map(e => e._id);
            const goalIds = goals.map(g => g._id);
            const reminderIds = reminders.map(r => r._id);
            const allNodeIds = [...entityIds, ...goalIds, ...reminderIds, userId];

            // 2. Fetch all edges where either side is one of our nodes
            const edges = await GraphEdge.find({
                $or: [
                    { "from.id": { $in: allNodeIds } },
                    { "to.id": { $in: allNodeIds } }
                ]
            }).lean();

            // 3. Construct Nodes for frontend
            const nodes = [
                { id: userId.toString(), name: 'You', type: 'User', group: 'user' },
                ...entities.map((e: any) => ({
                    id: e._id.toString(),
                    name: e.name,
                    type: e.otype,
                    group: e.otype?.toLowerCase() || 'default',
                    img: e.avatar
                })),
                ...goals.map((g: any) => ({
                    id: g._id.toString(),
                    name: g.title,
                    type: 'Goal',
                    group: 'goal'
                })),
                ...reminders.map((r: any) => ({
                    id: r._id.toString(),
                    name: r.title,
                    type: 'Reminder',
                    group: 'reminder'
                }))
            ];

            // 4. Transform links for frontend
            const links = edges.map(edge => ({
                id: edge._id.toString(),
                source: edge.from.id.toString(),
                target: edge.to.id.toString(),
                relation: edge.relation,
                weight: edge.weight,
                metadata: edge.metadata
            }));

            // Filter out links that might reference non-existent nodes (if any)
            const activeNodeIds = new Set(nodes.map(n => n.id));
            const filteredLinks = links.filter(l => activeNodeIds.has(l.source) && activeNodeIds.has(l.target));

            ResponseHelper.success(res, { nodes, links: filteredLinks }, 'Graph fetched successfully');
        } catch (error) {
            logger.error(`[GraphController] getGraph failed`, error);
            ResponseHelper.error(res, 'Failed to fetch graph', 500, error);
        }
    }

    /**
     * Creates a new edge between two nodes
     */
    static async createEdge(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id;
            const { source, target, relation } = req.body; // Assuming body structure

            if (!source || !target || !relation) {
                ResponseHelper.badRequest(res, 'Source, target, and relation are required');
                return;
            }

            const edge = await GraphEdge.create({
                userId,
                source,
                target,
                relation,
                timestamp: new Date()
            });

            ResponseHelper.created(res, edge, 'Edge created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create edge', 500, error);
        }
    }

    /**
     * Deletes an edge
     */
    static async deleteEdge(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id;
            const { id } = req.params;

            const result = await GraphEdge.findOneAndDelete({ _id: id, userId });

            if (!result) {
                ResponseHelper.notFound(res, 'Edge not found');
                return;
            }

            ResponseHelper.success(res, null, 'Edge deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete edge', 500, error);
        }
    }
}
