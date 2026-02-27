import { google } from 'googleapis';
import { config } from '../../../../config/env';
import { logger } from '../../../../config/logger';
import { IIntegrationTokenDocument, IntegrationToken } from '../../integration.model';
import { IIntegrationProvider } from '../../provider.interface';
import jwt from 'jsonwebtoken';

export abstract class BaseGoogleProvider implements IIntegrationProvider {
    abstract readonly identifier: string;
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly scopes: string[];

    protected createOAuthClient() {
        return new google.auth.OAuth2(
            config.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET || 'dev-secret-placeholder',
            process.env.GOOGLE_REDIRECT_URI || `${config.BACKEND_URL}/api/integrations/google/callback`
        );
    }

    getAuthUrl(userId: string): string {
        const client = this.createOAuthClient();

        // Secure state to track both provider and user (prevents CSRF and auth loss on redirect)
        const stateToken = jwt.sign(
            { userId, provider: this.identifier },
            config.JWT_SECRET,
            { expiresIn: '15m' }
        );

        return client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.scopes,
            state: stateToken
        });
    }

    async handleCallback(code: string, userId: string): Promise<IIntegrationTokenDocument> {
        try {
            const client = this.createOAuthClient();
            const { tokens } = await client.getToken(code);

            client.setCredentials(tokens);
            const oauth2 = google.oauth2({ version: 'v2', auth: client });
            const userInfo = await oauth2.userinfo.get();

            const tokenDoc = await IntegrationToken.findOneAndUpdate(
                { userId, provider: this.identifier },
                {
                    accessToken: tokens.access_token,
                    // Keep existing refresh token if they didn't return a new one
                    ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
                    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                    scopes: tokens.scope ? tokens.scope.split(' ') : [],
                    profile: {
                        id: userInfo.data.id,
                        email: userInfo.data.email,
                        name: userInfo.data.name,
                        picture: userInfo.data.picture
                    },
                    connectedAt: new Date()
                },
                { upsert: true, new: true }
            );

            return tokenDoc;
        } catch (error) {
            logger.error(`Failed to handle callback for ${this.identifier}`, error);
            throw new Error('OAuth authentication failed');
        }
    }

    async verifyConnection(userId: string): Promise<boolean> {
        const token = await IntegrationToken.findOne({ userId, provider: this.identifier });
        return !!token && (!token.isExpired() || !!token.refreshToken); // Valid if not expired OR has refresh token to renew
    }

    async getClient(userId: string) {
        const token = await IntegrationToken.findOne({ userId, provider: this.identifier });
        if (!token) throw new Error(`${this.name} integration not connected`);

        const client = this.createOAuthClient();
        client.setCredentials({
            access_token: token.accessToken,
            refresh_token: token.refreshToken,
            expiry_date: token.expiresAt ? token.expiresAt.getTime() : undefined,
        });

        client.on('tokens', async (newTokens) => {
            logger.info(`Refreshed tokens for ${this.identifier}, user: ${userId}`);
            token.accessToken = newTokens.access_token!;
            if (newTokens.refresh_token) token.refreshToken = newTokens.refresh_token;
            if (newTokens.expiry_date) token.expiresAt = new Date(newTokens.expiry_date);
            await token.save();
        });

        return client;
    }
}
