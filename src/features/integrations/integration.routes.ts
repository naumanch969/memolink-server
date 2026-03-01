import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import './init';
import { IntegrationController } from './integration.controller';
import { WhatsAppController } from './whatsapp.controller';

const router = Router();

// Connection endpoints
router.get('/:provider/connect', AuthMiddleware.authenticate, IntegrationController.connectProvider);
// Google has a strict callback url so we use a universal one and pass state mapping to provider id
router.get('/google/callback', IntegrationController.handleGoogleCallback);

// WhatsApp Webhook (Public)
router.get('/whatsapp/webhook', WhatsAppController.verify);
router.post('/whatsapp/webhook', WhatsAppController.receive);

// Management endpoints
router.get('/', AuthMiddleware.authenticate, IntegrationController.listConnections);
router.delete('/:provider', AuthMiddleware.authenticate, IntegrationController.disconnect);

export default router;
