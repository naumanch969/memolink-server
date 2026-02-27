import { Router } from 'express';
import { config } from '../../config/env';

import adminRoutes from '../../features/admin/admin.routes';
import agentRoutes from '../../features/agent/agent.routes';
import analyticsRoutes from '../../features/analytics/analytics.routes';
import authRoutes from '../../features/auth/auth.routes';
import collectionRoutes from '../../features/collection/collection.routes';
import announcementRoutes from '../../features/communication/announcement.routes';
import entityRoutes from '../../features/entity/entity.routes';
import entryRoutes from '../../features/entry/entry.routes';
import eventsRoutes from '../../features/events/events.routes';
import exportRoutes from '../../features/export/export.routes';
import goalRoutes from '../../features/goal/goal.routes';
import graphRoutes from '../../features/graph/graph.routes';
import chunkedUploadRoutes from '../../features/media/chunked-upload.routes';
import folderRoutes from '../../features/media/folder.routes';
import mediaRoutes from '../../features/media/media.routes';
import storageRoutes from '../../features/media/storage.routes';
import monitoringRoutes from '../../features/monitoring/monitoring.routes';
import moodRoutes from '../../features/mood/mood.routes';
import notificationRoutes from '../../features/notification/notification.routes';
import reminderRoutes from '../../features/reminder/reminder.routes';
import reportRoutes from '../../features/report/report.routes';
import searchRoutes from '../../features/search/search.routes';
import tagRoutes from '../../features/tag/tag.routes';
import webActivityRoutes from '../../features/web-activity/web-activity.routes';
import widgetRoutes from '../../features/widget/widget.routes';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../config/swagger.config';
import integrationRoutes from '../../features/integrations/integration.routes';

const router = Router();

// Health check

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: config.npm_package_version || '1.0.0',
  });
});

// API documentation
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'MemoLink API Docs',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// Feature routes
router.use('/auth', authRoutes);
router.use('/entries', entryRoutes);
router.use('/entities', entityRoutes);
router.use('/tags', tagRoutes);
router.use('/collections', collectionRoutes);
router.use('/media', mediaRoutes);
router.use('/media/upload/chunked', chunkedUploadRoutes);
router.use('/folders', folderRoutes);
router.use('/storage', storageRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/export', exportRoutes);
router.use('/widgets', widgetRoutes);
router.use('/reminders', reminderRoutes);
router.use('/moods', moodRoutes);
router.use('/goals', goalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/graph', graphRoutes);

router.use('/admin', adminRoutes);
router.use('/integrations', integrationRoutes);

router.use('/agents', agentRoutes);
router.use('/reports', reportRoutes);
router.use('/activity', webActivityRoutes);
router.use('/search', searchRoutes);

router.use('/events', eventsRoutes);
router.use('/announcements', announcementRoutes);
router.use('/monitoring', monitoringRoutes);


export default router;
