import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { AgentController } from './agent.controller';
import { chatValidation, createTaskValidation, findSimilarValidation, goalArchitectValidation, processNLValidation, taskIdValidation } from './agent.validations';

const router = Router();

// Protect all agent routes
router.use(AuthMiddleware.authenticate);

router.post('/tasks', createTaskValidation, ValidationMiddleware.validate, AgentController.createTask);
router.get('/tasks', AgentController.listTasks);
router.get('/tasks/:taskId', taskIdValidation, ValidationMiddleware.validate, AgentController.getTask);
router.post('/intent', processNLValidation, ValidationMiddleware.validate, AgentController.processNaturalLanguage);
router.post('/chat', chatValidation, ValidationMiddleware.validate, AgentController.chat);
router.get('/chat', AgentController.getHistory);
router.get('/briefing', AgentController.getBriefing);
router.get('/similar', findSimilarValidation, ValidationMiddleware.validate, AgentController.getSimilarEntries);
router.post('/goal-architect', goalArchitectValidation, ValidationMiddleware.validate, AgentController.goalArchitectChat);
router.post('/sync', AgentController.syncLibrary);
router.get('/persona', AgentController.getPersona);
router.delete('/chat', AgentController.clearHistory);

export default router;
