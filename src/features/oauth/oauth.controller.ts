import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { oauthService } from './oauth.service';
import { config } from '../../config/env';

export class OAuthController {
  /**
   * Initial authorization request.
   * If user is not logged in, redirects to login.
   * If logged in, redirects to the client's redirect_uri with the code.
   * 
   * Note: In a production app, this would show a "Consent" screen first.
   * For this implementation, we'll assume consent is given if the user is logged in or
   * redirect to a consent page on the frontend.
   */
  static async authorize(req: any, res: Response) {
    try {
      const { client_id, clientId, redirect_uri, redirectUri, response_type, responseType, state, scope } = { ...req.query, ...req.body };

      // Normalize parameters (handle both camelCase from frontend and snake_case from OAuth spec)
      const effectiveClientId = (client_id || clientId) as string;
      const effectiveRedirectUri = (redirect_uri || redirectUri) as string;
      const effectiveResponseType = (response_type || responseType || 'code') as string;

      if (effectiveResponseType !== 'code') {
        return ResponseHelper.badRequest(res, 'Only response_type=code is supported');
      }

      const client = await oauthService.getClientById(effectiveClientId);
      if (!client) {
        return ResponseHelper.badRequest(res, `Invalid client_id: ${effectiveClientId}`);
      }

      if (!client.redirectUris.includes(effectiveRedirectUri)) {
        return ResponseHelper.badRequest(res, `Invalid redirect_uri: ${effectiveRedirectUri}`);
      }

      // If user is not logged in (middleware should handle this, but just in case)
      if (!req.user) {
        const loginUrl = `${config.FRONTEND_URL}/login?returnTo=${encodeURIComponent(req.originalUrl)}`;
        return res.redirect(loginUrl);
      }

      // If we want a consent screen, redirect to frontend consent page
      // For now, let's assume we redirect to a consent page on the frontend
      // return res.redirect(`${config.FRONTEND_URL}/oauth/consent?${req.url.split('?')[1]}`);

      // AUTO-APPROVE for now to fulfill the "automatic" request
      const userId = req.user._id.toString();
      const code = await oauthService.generateAuthorizationCode(
        effectiveClientId,
        userId,
        effectiveRedirectUri,
        scope ? (scope as string).split(' ') : []
      );

      // If it's an AJAX request (from our frontend), return JSON
      if (req.xhr || req.headers['accept']?.includes('application/json')) {
        return ResponseHelper.success(res, { code, state });
      }

      // Traditional OAuth redirect
      const redirectUrl = new URL(effectiveRedirectUri);
      redirectUrl.searchParams.append('code', code);
      if (state) redirectUrl.searchParams.append('state', state as string);

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      ResponseHelper.error(res, 'Authorization failed', 500, error);
    }
  }

  /**
   * Token exchange endpoint.
   * Called by the client (Claude) using the authorization code.
   */
  static async token(req: Request, res: Response) {
    try {
      const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

      if (grant_type !== 'authorization_code') {
        return ResponseHelper.badRequest(res, 'Only grant_type=authorization_code is supported');
      }

      const result = await oauthService.exchangeCodeForToken(
        client_id,
        client_secret,
        code,
        redirect_uri
      );

      return res.json(result);
    } catch (error) {
      ResponseHelper.error(res, 'Token exchange failed', 401, error);
    }
  }

  /**
   * Get client info (used by frontend to show client name on consent screen)
   */
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
}

export default OAuthController;
