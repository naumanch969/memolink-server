import * as Sentry from '@sentry/node';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { ErrorMiddleware } from './middleware/error.middleware';
import { MonitoringMiddleware } from './middleware/monitoring.middleware';
import routes from './routes/index';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
      connectSrc: ["'self'", "https://validator.swagger.io"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = config.CORS_ORIGIN;
    const isAllowed = allowedOrigins.some(ao => origin === ao) ||
      origin.startsWith('chrome-extension://');

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
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
  logger.debug('Incoming request:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MemoLink API',
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
