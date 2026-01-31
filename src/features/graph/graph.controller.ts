import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { GraphEdge } from './edge.model';

export class GraphController {
    /**
     * Fetches the entire personal memory graph for the authenticated user
     */
    static getGraph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id;

        // Fetch all edges where the user is the 'from' node or connected via paths
        // For V0, we fetch all edges belonging to this user's context.
        // In our schema, many edges start from the User.
        const edges = await GraphEdge.find({
            $or: [
                { "from.id": new Types.ObjectId(userId) },
                { "to.id": new Types.ObjectId(userId) }
            ]
        }).lean();

        // Extract unique nodes from edges
        const nodesMap = new Map();

        // Always include the User node
        nodesMap.set(userId.toString(), {
            id: userId.toString(),
            label: 'Me',
            type: 'User',
            val: 20
        });

        edges.forEach(edge => {
            const fromId = edge.from.id.toString();
            const toId = edge.to.id.toString();

            if (!nodesMap.has(fromId)) {
                nodesMap.set(fromId, {
                    id: fromId,
                    label: edge.from.type,
                    type: edge.from.type,
                    val: 10
                });
            }

            if (!nodesMap.has(toId)) {
                // Try to find a better label for the target (e.g. from metadata)
                // Since we use .lean(), metadata is a plain object, not a Map
                const label = (edge.metadata as any)?.title || edge.to.type;
                nodesMap.set(toId, {
                    id: toId,
                    label: label,
                    type: edge.to.type,
                    val: 12
                });
            }
        });

        const nodes = Array.from(nodesMap.values());
        const links = edges.map(edge => ({
            source: edge.from.id.toString(),
            target: edge.to.id.toString(),
            relation: edge.relation,
            weight: edge.weight
        }));

        ResponseHelper.success(res, { nodes, links }, 'Graph data fetched');
    });
}
