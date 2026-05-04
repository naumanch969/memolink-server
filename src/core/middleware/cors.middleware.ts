import { config } from '../../config/env';
import { logger } from '../../config/logger';
import cors from 'cors';
import { RequestHandler } from 'express';

/**
 * CORS Middleware implementation
 * Centralizes all CORS logic and origin validation
 */
export const corsMiddleware = (): RequestHandler => {
  return cors(corsOptions);
};

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or some redirected requests)
    if (!origin || origin === 'null') {
      return callback(null, true);
    }

    const allowedOrigins = config.CORS_ORIGIN;
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
    
    // Check against explicitly allowed list
    const isExplicitlyAllowed = allowedOrigins.some((ao: string) => {
      const normalizedAo = ao.toLowerCase().replace(/\/$/, '');
      return normalizedAo && normalizedOrigin === normalizedAo;
    });

    if (isExplicitlyAllowed) {
      return callback(null, true);
    }

    // Secure domain patterns
    const isBrinnDomain = /^https?:\/\/([a-z0-9-]+\.)*brinn\.app$/.test(normalizedOrigin);
    const isOpstinDomain = /^https?:\/\/([a-z0-9-]+\.)*brinn\.opstintechnologies\.com$/.test(normalizedOrigin);
    const isClaudeDomain = /^https?:\/\/([a-z0-9-]+\.)*(claude\.ai|anthropic\.com)$/.test(normalizedOrigin);
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin) || 
                       /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin);
    const isTauri = normalizedOrigin === 'tauri://localhost' || 
                    normalizedOrigin === 'http://tauri.localhost';
    const isExtension = normalizedOrigin.startsWith('chrome-extension://');
    const isCapacitor = normalizedOrigin.startsWith('capacitor://');

    if (isBrinnDomain || isOpstinDomain || isClaudeDomain || isLocalhost || isTauri || isExtension || isCapacitor) {
      return callback(null, true);
    }

    // If we get here, it's blocked
    logger.warn('CORS blocked origin:', { 
      origin, 
      normalizedOrigin,
      allowedOrigins
    });
    
    // Pass false to reject the request without an explicit Error (prevents Express error handler side effects)
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'sentry-trace',
    'baggage',
    'x-client-id',
    'x-client-version',
    'x-platform',
    'x-device-id',
    'x-timezone',
    'id-token',
    'x-request-id',
    'x-app-version',
    'x-app-platform',
    'cache-control',
    'pragma',
    'expires'
  ],
  exposedHeaders: ['sentry-trace', 'baggage', 'Content-Disposition', 'X-Request-ID'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

