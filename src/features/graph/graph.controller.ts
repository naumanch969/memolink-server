import { Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import KnowledgeEntity from '../entity/entity.model';
import Goal from '../goal/goal.model';
import { Reminder } from '../reminder/reminder.model';
import { EdgeStatus, GraphEdge } from './edge.model';
import { graphService } from './graph.service';

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
                $and: [
                    {
                        $or: [
                            { "from.id": { $in: allNodeIds } },
                            { "to.id": { $in: allNodeIds } }
                        ]
                    },
                    {
                        $or: [
                            { status: { $in: [EdgeStatus.ACTIVE, EdgeStatus.PROPOSED] } },
                            { status: { $exists: false } },
                            { status: null }
                        ]
                    }
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
                    img: e.avatar,
                    val: e.interactionCount || 1
                })),
                ...goals.map((g: any) => ({
                    id: g._id.toString(),
                    name: g.title,
                    type: 'Goal',
                    group: 'goal',
                    val: 4
                })),
                ...reminders.map((r: any) => ({
                    id: r._id.toString(),
                    name: r.title,
                    type: 'Reminder',
                    group: 'reminder',
                    val: 2
                }))
            ];

            // 4. Transform links for frontend
            // Include Provenance and Status
            const links = edges.map(edge => ({
                id: edge._id.toString(),
                source: edge.from.id.toString(),
                target: edge.to.id.toString(),
                relation: edge.relation,
                weight: edge.weight,
                metadata: edge.metadata,

                // Integrity Fields
                status: edge.status || 'active',
                sourceEntryId: edge.sourceEntryId?.toString(),
                refutedAt: edge.refutedAt
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
     * Mark an edge as Refuted (User Rejection)
     */
    static async refuteEdge(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            await graphService.refuteEdge(id);
            ResponseHelper.success(res, null, 'Edge refuted successfully');
        } catch (error) {
            logger.error(`[GraphController] refuteEdge failed`, error);
            ResponseHelper.error(res, 'Failed to refute edge', 500, error);
        }
    }

    /**
     * Resolve a conflict proposal (Accept or Reject)
     */
    static async resolveProposal(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const { action } = req.body; // 'accept' | 'reject'
            if (!['accept', 'reject'].includes(action)) {
                return ResponseHelper.badRequest(res, 'Invalid action. Must be accept or reject.');
            }

            await graphService.resolveProposal(id, action as 'accept' | 'reject');
            ResponseHelper.success(res, null, `Proposal ${action}ed successfully`);
        } catch (error) {
            logger.error(`[GraphController] resolveProposal failed`, error);
            ResponseHelper.error(res, 'Failed to resolve proposal', 500, error);
        }
    }

    /**
     * Trigger Self-Healing for Orphaned Entities
     */
    static async repairGraph(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const result = await graphService.repairOrphanedEntities(userId);
            ResponseHelper.success(res, result, 'Graph repair completed');
        } catch (error) {
            logger.error(`[GraphController] repairGraph failed`, error);
            ResponseHelper.error(res, 'Failed to repair graph', 500, error);
        }
    }

    /**
     * Deletes an edge
     */
    static async deleteEdge(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id;
            const { id } = req.params;
            await graphService.removeEdge(id, '', '' as any); // TODO: Fix removeEdge signature or use ID directly
            // graphService currently takes fromId, toId. We might need a deleteById method in service or use Model directly here.
            await GraphEdge.findOneAndDelete({ _id: id });
            ResponseHelper.success(res, null, 'Edge deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete edge', 500, error);
        }
    }
}
