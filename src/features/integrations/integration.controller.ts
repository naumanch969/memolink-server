import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { IntegrationToken } from './integration.model';
import { integrationRegistry } from './integration.registry';
import jwt from 'jsonwebtoken';

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

            // res.redirect(url); // Don't redirect straight away
            res.json({ url });
        } catch (error) {
            logger.error('Failed to generate connection URL', error);
            res.status(500).json({ error: 'Failed to connect' });
        }
    }

    static async handleGoogleCallback(req: any, res: any): Promise<void> {
        try {
            const { code, state } = req.query;

            if (!code || !state) {
                return res.status(400).json({ error: 'Code and state are required' });
            }

            let decodedState: any;

            try {
                decodedState = jwt.verify(state as string, config.JWT_SECRET);
            } catch {
                return res.status(401).json({ error: 'Invalid or expired state token' });
            }

            const { userId, provider } = decodedState;

            const p = integrationRegistry.get(provider);
            await p.handleCallback(code as string, userId);

            // Once successfully connected, redirect back to the frontend settings UI
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/settings?integration=success`);

        } catch (error) {
            logger.error('Failed to handle Google callback', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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

            res.json(tokens);
        } catch (error) {
            logger.error('Failed to list integrations', error);
            res.status(500).json({ error: 'Failed to list connections' });
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

            res.json({ message: `Successfully disconnected ${provider}` });
        } catch (error) {
            logger.error('Failed to disconnect integration', error);
            res.status(500).json({ error: 'Failed to disconnect' });
        }
    }
}
