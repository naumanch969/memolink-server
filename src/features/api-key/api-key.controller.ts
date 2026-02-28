import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { apiKeyService } from './api-key.service';

export class ApiKeyController {
    static createApiKey = async (req: AuthenticatedRequest, res: Response) => {
        const { name, expiresInDays } = req.body;
        const userId = req.user!._id;

        const result = await apiKeyService.createApiKey(userId, { name, expiresInDays });

        ResponseHelper.created(res, {
            rawKey: result.rawKey,
            key: result.key
        }, 'API Key generated successfully. Save this now, it will not be shown again.');
    };

    static listApiKeys = async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id;
        const keys = await apiKeyService.listApiKeys(userId);

        ResponseHelper.success(res, keys, 'API Keys retrieved successfully');
    };

    static revokeApiKey = async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const userId = req.user!._id;

        await apiKeyService.revokeApiKey(userId, id);
        ResponseHelper.success(res, null, 'API Key revoked successfully');
    };
}
