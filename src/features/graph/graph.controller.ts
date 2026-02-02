import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { GraphEdge } from './edge.model';

export class GraphController {
    /**
     * Fetches the entire personal memory graph for the authenticated user
     */
    static async getGraph(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id;

            // Fetch all edges for the user
            // In a real implementation with millions of nodes, we would filter by viewport/depth
            // For now, we return the whole graph associated with the user
            const edges = await GraphEdge.find({
                $or: [
                    { sourceId: userId }, // Edges where user is source (if we treat user as a node)
                    { userId: userId }    // Or just edges belonging to user workspace
                ]
            }).lean();

            // Transform if necessary or fetch nodes
            // Ideally, we need nodes too.
            // This is a placeholder for the actual graph data fetching logic
            const nodes = [];
            // ... Logic to fetch nodes related to these edges ...

            ResponseHelper.success(res, { nodes, edges }, 'Graph fetched successfully');
        } catch (error) {
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
