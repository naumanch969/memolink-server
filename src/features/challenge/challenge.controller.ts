import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateChallengeLogParams, CreateChallengeParams } from './challenge.interfaces';
import { challengeService } from './challenge.service';

export class ChallengeController {
    static async create(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: CreateChallengeParams = req.body;
            const challenge = await challengeService.createChallenge(userId, params);
            ResponseHelper.created(res, challenge, 'Challenge started successfully');
        } catch (error: any) {
            ResponseHelper.error(res, error.message || 'Failed to start challenge', error.status || 500, error);
        }
    }

    static async listActive(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const challenges = await challengeService.getActiveChallenges(userId);
            ResponseHelper.success(res, challenges, 'Active challenges retrieved successfully');
        } catch (error: any) {
            ResponseHelper.error(res, 'Failed to retrieve active challenges', 500, error);
        }
    }

    static async logDay(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: CreateChallengeLogParams = req.body;
            const log = await challengeService.logChallengeDay(userId, params);
            ResponseHelper.success(res, log, 'Challenge day logged successfully');
        } catch (error: any) {
            ResponseHelper.error(res, error.message || 'Failed to log challenge day', error.status || 500, error);
        }
    }
}
