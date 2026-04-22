import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { IntegrationToken } from './integration.model';
import { integrationRegistry } from './integration.registry';
import jwt from 'jsonwebtoken';
import { ResponseHelper } from '../../core/utils/response.utils';

export class IntegrationController {
    /**
     * Start the OAuth connection for any registered provider
     */
    static async connectProvider(req: any, res: any): Promise<void> {
        try {
            const { provider } = req.params;
            const userId = req.user._id;

            const p = integrationRegistry.get(provider);
            const url = p.getAuthUrl(userId);

            // ResponseHelper.success for JSON responses
            ResponseHelper.success(res, { url });
        } catch (error) {
            logger.error('Failed to generate connection URL', error);
            ResponseHelper.error(res, 'Failed to connect');
        }
    }

    static async handleGoogleCallback(req: any, res: any): Promise<void> {
        try {
            const { code, state } = req.query;

            if (!code || !state) {
                ResponseHelper.badRequest(res, 'Code and state are required');
                return;
            }

            let decodedState: any;

            try {
                decodedState = jwt.verify(state as string, config.JWT_SECRET);
            } catch {
                ResponseHelper.unauthorized(res, 'Invalid or expired state token');
                return;
            }

            const { userId, provider } = decodedState;

            const p = integrationRegistry.get(provider);
            await p.handleCallback(code as string, userId);

            // Once successfully connected, redirect back to the frontend settings UI
            const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/settings?integration=success`);

        } catch (error) {
            logger.error('Failed to handle Google callback', error);
            const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/settings?integration=error`);
        }
    }

    /**
     * List all connected integrations for a user
     */
    static async listConnections(req: any, res: any): Promise<void> {
        try {
            const userId = req.user._id;
            const tokens = await IntegrationToken.find({ userId }).select('-accessToken -refreshToken');

            ResponseHelper.success(res, tokens);
        } catch (error) {
            logger.error('Failed to list integrations', error);
            ResponseHelper.error(res, 'Failed to list connections');
        }
    }

    /**
     * Disconnect a specific provider
     */
    static async disconnect(req: any, res: any): Promise<void> {
        try {
            const { provider } = req.params;
            const userId = req.user._id;

            await IntegrationToken.findOneAndDelete({ userId, provider });

            ResponseHelper.success(res, null, `Successfully disconnected ${provider}`);
        } catch (error) {
            logger.error('Failed to disconnect integration', error);
            ResponseHelper.error(res, 'Failed to disconnect');
        }
    }
}
