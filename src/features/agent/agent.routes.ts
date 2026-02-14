import { Router } from 'express';
import { AgentController } from './agent.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Protect all agent routes
router.use(AuthMiddleware.authenticate);

router.post('/tasks', AgentController.createTask);
router.get('/tasks', AgentController.listTasks);
router.get('/tasks/:taskId', AgentController.getTask);
router.post('/intent', AgentController.processNaturalLanguage);
router.post('/chat', AgentController.chat);
router.get('/chat', AgentController.getHistory);
router.get('/briefing', AgentController.getBriefing);
router.get('/similar', AgentController.getSimilarEntries);
router.post('/goal-architect', AgentController.goalArchitectChat);
router.post('/sync', AgentController.syncLibrary);
router.get('/persona', AgentController.getPersona);
router.delete('/chat', AgentController.clearHistory);

export default router;
