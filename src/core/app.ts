import path from 'path';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';

import { config } from '../config/env';
import { logger } from '../config/logger';
import { ErrorMiddleware } from './middleware/error.middleware';
import { MonitoringMiddleware } from './middleware/monitoring.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import routes from './routes/index';
import OAuthController from '../features/oauth/oauth.controller';

const app = express();

// 1. Pre-middleware (CORS & Security)
app.use(corsMiddleware());

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://validator.swagger.io", "https://*.cloudinary.com"],
      connectSrc: [
        "'self'", 
        "https://validator.swagger.io", 
        "https://*.brinn.app", 
        "https://brinn.app",
        "https://*.sentry.io",
        "https://*.cloudinary.com",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Static files
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// 2. Performance & Logging
app.use(compression());

// Logging middleware
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Monitoring middleware - must be after body parsing
app.use(MonitoringMiddleware.addRequestContext);
app.use(MonitoringMiddleware.monitorHTTP());

// Request logging
app.use((req, res, next) => {
  logger.debug('Incoming request:', { method: req.method, url: req.url, ip: req.ip, userAgent: req.get('User-Agent'), });
  next();
});

// Rate limiting - apply to all API routes
// app.use('/api', RateLimitMiddleware.limit());

// API routes
app.use('/api', routes);

// RFC 9470: Discovery for Protected Resource (MCP) - For Claude
app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  OAuthController.getProtectedResourceMetadata(req, res);
});

// RFC 8414: OAuth 2.0 Authorization Server Metadata - For Claude
app.get(['/.well-known/oauth-authorization-server', '/api/oauth/.well-known/oauth-authorization-server'], (req, res) => {
  OAuthController.getAuthorizationServerMetadata(req, res);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Brinn API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
    health: '/api/monitoring/health',
    metrics: '/api/monitoring/metrics',
  });
});

// Sentry error handler - must be before local error handler
if (config.SENTRY_DSN_URL) {
  Sentry.setupExpressErrorHandler(app);
}

// 404 handler
app.use(ErrorMiddleware.notFound);

// Error tracking middleware
app.use(MonitoringMiddleware.errorTrackingMiddleware);

// Error handling middleware
app.use(ErrorMiddleware.handle);


export default app;
