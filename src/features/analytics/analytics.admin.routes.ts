import { Router } from 'express';
import { AnalyticsAdminController } from './analytics.admin.controller';

const analyticsAdminRouter = Router();

// Dashboard Overview
analyticsAdminRouter.get('/dashboard', AnalyticsAdminController.getDashboardOverview);

// User Analytics
analyticsAdminRouter.get('/users', AnalyticsAdminController.getAnalyticsUserGrowth);
analyticsAdminRouter.get('/active-users', AnalyticsAdminController.getAnalyticsActiveUsers);
analyticsAdminRouter.get('/accounts', AnalyticsAdminController.getAnalyticsUserAccounts);
analyticsAdminRouter.get('/retention', AnalyticsAdminController.getAnalyticsRetention);

// Platform Analytics
analyticsAdminRouter.get('/platform', AnalyticsAdminController.getAnalyticsPlatform);

// Feature Analytics
analyticsAdminRouter.get('/features', AnalyticsAdminController.getAnalyticsFeatures);
analyticsAdminRouter.get('/feature-breakdown', AnalyticsAdminController.getAnalyticsFeatureBreakdown);

// Content Analytics
analyticsAdminRouter.get('/content-growth', AnalyticsAdminController.getAnalyticsContentGrowth);

export { analyticsAdminRouter };
