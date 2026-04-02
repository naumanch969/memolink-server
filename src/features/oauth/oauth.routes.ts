import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import OAuthController from './oauth.controller';

const router = Router();

/**
 * Public endpoint to get client information.
 * Useful for the frontend to display "Connect to [AppName]"
 */
router.get('/client/:clientId', OAuthController.getClientInfo);

/**
 * Endpoint to request an authorization code.
 * Requires user to be authenticated.
 */
router.post('/authorize', AuthMiddleware.authenticate, OAuthController.authorize);

/**
 * Endpoint to exchange authorization code for access token.
 * Authenticated by client_id and client_secret in body.
 */
router.post('/token', OAuthController.token);

export default router;
