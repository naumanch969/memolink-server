import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RateLimitMiddleware } from '../../core/middleware/rate-limit.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { AgentController } from './agent.controller';
import { chatValidation, createTaskValidation, goalArchitectValidation, taskIdValidation } from './agent.validations';

const router = Router();

const aiLimiter = RateLimitMiddleware.limit({ zone: 'ai', maxRequests: 10, windowMs: 60 * 1000 });
// Protect all agent routes
router.use(AuthMiddleware.authenticate);

router.post('/tasks', createTaskValidation, ValidationMiddleware.validate, AgentController.createTask);
router.get('/tasks', AgentController.listTasks);
router.get('/tasks/:taskId', taskIdValidation, ValidationMiddleware.validate, AgentController.getTask);
router.post('/tasks/:taskId/cancel', taskIdValidation, ValidationMiddleware.validate, AgentController.cancelTask);

// Expensive AI & Processing operations - restricted to 50 requests per hour per user (approx)
// or more loosely 10 requests per minute


router.post('/chat', aiLimiter, chatValidation, ValidationMiddleware.validate, AgentController.chat);
router.get('/chat', AgentController.getHistory);
router.get('/briefing', AgentController.getBriefing);
router.post('/goal-architect', aiLimiter, goalArchitectValidation, ValidationMiddleware.validate, AgentController.goalArchitectChat);
router.post('/persona/sync', RateLimitMiddleware.limit({ zone: 'sync', maxRequests: 5, windowMs: 5 * 60 * 1000 }), AgentController.syncPersona);

router.get('/persona', AgentController.getPersona);
router.delete('/chat', AgentController.clearHistory);

export default router;
