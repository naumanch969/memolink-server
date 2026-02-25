import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { searchService } from './search.service';
import { GlobalSearchRequest } from './search.types';

export class SearchController {
    static async globalSearch(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { q, mode, limit, collections, ...filters } = req.query as any;

            if (!q) {
                return ResponseHelper.badRequest(res, 'Search query is required');
            }

            const params: GlobalSearchRequest = {
                q,
                mode,
                limit: limit ? parseInt(limit) : 10,
                collections: collections ? (collections as string).split(',') as any : undefined,
                filters
            };

            const results = await searchService.globalSearch(userId, params);
            ResponseHelper.success(res, results, 'Global search results retrieved');
        } catch (error) {
            ResponseHelper.error(res, 'Global search failed', 500, error);
        }
    }
}
