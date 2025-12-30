import { Router } from 'express';
import { config } from '../config/env';
import { logger } from '../config/logger';

// Import feature routes
import authRoutes from '../features/auth/auth.routes';
import entryRoutes from '../features/entry/entry.routes';
import personRoutes from '../features/person/person.routes';
import tagRoutes from '../features/tag/tag.routes';
import mediaRoutes from '../features/media/media.routes';
import folderRoutes from '../features/media/folder.routes';
import analyticsRoutes from '../features/analytics/analytics.routes';
import insightsRoutes from '../features/insights/insights.routes';
import exportRoutes from '../features/export/export.routes';
import goalRoutes from '../features/goals/goal.routes';
import widgetRoutes from '../features/widget/widget.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: config.npm_package_version || '1.0.0',
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'MemoLink API',
    version: '1.0.0',
    description: 'Personal journaling and life tracking API',
    endpoints: {
      auth: '/api/auth',
      entries: '/api/entries',
      people: '/api/people',
      tags: '/api/tags',
      media: '/api/media',
      folders: '/api/folders',
      analytics: '/api/analytics',
      export: '/api/export',
      goals: '/api/goals',
    },
    documentation: 'https://github.com/naumanch969/memolink-server',
  });
});

// Feature routes
router.use('/auth', authRoutes);
router.use('/entries', entryRoutes);
router.use('/people', personRoutes);
router.use('/tags', tagRoutes);
router.use('/media', mediaRoutes);
router.use('/folders', folderRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/insights', insightsRoutes);
router.use('/export', exportRoutes);
router.use('/goals', goalRoutes);
router.use('/widgets', widgetRoutes); // Registered

// Log route registration
logger.info('Routes registered successfully', {
  features: [
    'auth',
    'entries',
    'people',
    'tags',
    'media',
    'folders',
    'analytics',
    'export',
    'goals',
  ],
});

export default router;
