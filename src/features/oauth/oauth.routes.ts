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
 * Discovery endpoints
 */
router.get('/.well-known/oauth-protected-resource/mcp', OAuthController.getProtectedResourceMetadata);
router.get('/.well-known/oauth-authorization-server', OAuthController.getAuthorizationServerMetadata);

/**
 * Endpoint to exchange authorization code for access token.
 * Authenticated by clientId and clientSecret in body.
 */
router.post('/token', OAuthController.token);

router.use(AuthMiddleware.authenticate);

/**
 * Endpoint to request an authorization code.
 * Requires user to be authenticated.
 */
router.get('/authorize', OAuthController.authorize);
router.post('/authorize', OAuthController.authorize);

/**
 * Explicit consent approval endpoint.
 */
router.post('/approve', OAuthController.approve);


export default router;
