import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { agentController } from './agent.controller';

const router = Router();

// Protect all agent routes
router.use(authenticate);

router.post('/tasks', agentController.createTask);
router.get('/tasks', agentController.listTasks);
router.get('/tasks/:taskId', agentController.getTask);
router.post('/intent', agentController.processNaturalLanguage);
router.post('/chat', agentController.chat);
router.get('/chat', agentController.getHistory);
router.delete('/chat', agentController.clearHistory);

export default router;
