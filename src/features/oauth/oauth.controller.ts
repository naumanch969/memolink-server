import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { oauthService } from './oauth.service';
import { config } from '../../config/env';
import { OAuthApproveRequest, OAuthAuthorizeRequest, OAuthTokenRequest } from './oauth.types';

export class OAuthController {
  // Initial authorization request.
  // If user is not logged in, redirects to login.
  // If logged in, redirects to the client's redirect_uri with the code.
  static async authorize(req: any, res: Response) {
    try {
      const data = { ...req.query, ...req.body };
      
      const clientId = data.clientId || data.client_id;
      const redirectUri = data.redirectUri || data.redirect_uri;
      const responseType = data.responseType || data.response_type || 'code';
      const state = data.state || '';
      const scope = data.scope || '';
      const codeChallenge = data.codeChallenge || data.code_challenge;
      const codeChallengeMethod = data.codeChallengeMethod || data.code_challenge_method || 'S256';

      if (!clientId) {
        return ResponseHelper.badRequest(res, 'client_id is required');
      }

      const client = await oauthService.getClientById(clientId);
      if (!client) {
        return ResponseHelper.badRequest(res, `Invalid client_id: ${clientId}`);
      }

      const effectiveRedirectUri = redirectUri || client.redirectUris[0];
      if (effectiveRedirectUri && !client.redirectUris.includes(effectiveRedirectUri)) {
        return ResponseHelper.badRequest(res, `Invalid redirect_uri: ${effectiveRedirectUri}`);
      }

      // If user is not logged in
      if (!req.user) {
        const loginUrl = `${config.FRONTEND_URL}/login?returnTo=${encodeURIComponent(req.originalUrl)}`;
        
        if (req.headers.accept?.includes('application/json')) {
          return ResponseHelper.success(res, { redirectUrl: loginUrl }, 'Authentication required');
        }
        return res.redirect(loginUrl);
      }

      // Prepare redirect to frontend consent page
      const query = new URLSearchParams({
        clientId: clientId,
        redirectUri: effectiveRedirectUri,
        responseType: responseType,
        state: state,
        scope: scope
      });

      if (codeChallenge) {
        query.append('codeChallenge', codeChallenge);
        query.append('codeChallengeMethod', codeChallengeMethod);
      }

      const consentUrl = `${config.FRONTEND_URL}/oauth/consent?${query.toString()}`;

      if (req.headers.accept?.includes('application/json')) {
        return ResponseHelper.success(res, { redirectUrl: consentUrl });
      }

      return res.redirect(consentUrl);
    } catch (error) {
      ResponseHelper.error(res, 'Authorization failed', 500, error);
    }
  }

  // Explicit approval from the consent screen.
  static async approve(req: any, res: Response) {
    try {
      const { clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod }: OAuthApproveRequest = req.body;
      const userId = req.user._id.toString();

      if (!clientId || !redirectUri) {
        return ResponseHelper.badRequest(res, 'clientId and redirectUri are required');
      }

      const normalizedScope = scope ? (Array.isArray(scope) ? scope : (scope as string).split(' ')) : [];

      const code = await oauthService.approveGrant(
        userId,
        clientId,
        redirectUri,
        normalizedScope,
        codeChallenge,
        codeChallengeMethod
      );

      return ResponseHelper.success(res, { code, state });
    } catch (error: any) {
      ResponseHelper.error(res, error.message || 'Approval failed', error.statusCode || 500);
    }
  }

  // Token exchange endpoint.
  // Called by the client (Claude) using the authorization code.
  static async token(req: Request, res: Response) {
    try {
      const body = req.body;
      const grantType = body.grantType || body.grant_type;
      const code = body.code;
      const redirectUri = body.redirectUri || body.redirect_uri;
      const clientId = body.clientId || body.client_id;
      const clientSecret = body.clientSecret || body.client_secret;
      const codeVerifier = body.codeVerifier || body.code_verifier;

      if (grantType !== 'authorization_code') {
        return ResponseHelper.badRequest(res, 'Only grant_type=authorization_code is supported');
      }

      const result = await oauthService.exchangeCodeForToken(
        clientId,
        clientSecret,
        code,
        redirectUri,
        codeVerifier
      );

      return res.json(result);
    } catch (error: any) {
      ResponseHelper.error(res, error.message || 'Token exchange failed', error.statusCode || 401, error);
    }
  }

  // Get client info (used by frontend to show client name on consent screen)
  static async getClientInfo(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const client = await oauthService.getClientById(clientId);
      if (!client) {
        return ResponseHelper.notFound(res, 'Client not found');
      }
      ResponseHelper.success(res, {
        name: client.name,
        logo: client.logo,
        description: client.description,
        clientId: client.clientId
      });
    } catch (error) {
      ResponseHelper.error(res, 'Failed to get client info', 500, error);
    }
  }

  // RFC 9470: Discovery for Protected Resource (MCP)
  static async getProtectedResourceMetadata(req: Request, res: Response) {
    // Force HTTPS for production
    const protocol = req.secure || config.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.get('host') || 'api.brinn.app';
    const baseUrl = `${protocol}://${host}`;
    
    // The MCP server is actually at the worker URL, but we can provide our own if we proxy
    const mcpUrl = `${baseUrl}/api/mcp`;

    res.json({
      mcp_endpoint: mcpUrl,
      authorization_servers: [baseUrl]
    });
  }

  // RFC 8414: OAuth 2.0 Authorization Server Metadata
  static async getAuthorizationServerMetadata(req: Request, res: Response) {
    const protocol = req.secure || config.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.get('host') || 'api.brinn.app';
    const baseUrl = `${protocol}://${host}`;
    
    const issuer = baseUrl;
    const authBase = `${baseUrl}/api/oauth`;

    res.json({
      issuer: issuer,
      authorization_endpoint: `${authBase}/authorize`,
      token_endpoint: `${authBase}/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['mcp:read', 'mcp:write', 'profile'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none']
    });
  }
}

export default OAuthController;
