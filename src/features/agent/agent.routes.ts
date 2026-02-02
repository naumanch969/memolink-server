import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { AgentController } from './agent.controller';

const router = Router();

// Protect all agent routes
router.use(authenticate);

router.post('/tasks', AgentController.createTask);
router.get('/tasks', AgentController.listTasks);
router.get('/tasks/:taskId', AgentController.getTask);
router.post('/intent', AgentController.processNaturalLanguage);
router.post('/chat', AgentController.chat);
router.get('/chat', AgentController.getHistory);
router.get('/briefing', AgentController.getBriefing);
router.get('/similar', AgentController.getSimilarEntries);
router.delete('/chat', AgentController.clearHistory);

export default router;
