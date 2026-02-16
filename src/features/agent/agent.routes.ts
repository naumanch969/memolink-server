import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RateLimitMiddleware } from '../../core/middleware/rate-limit.middleware';
import { FileUploadMiddleware } from '../../core/middleware/upload.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { AgentController } from './agent.controller';
import { chatValidation, createTaskValidation, findSimilarValidation, goalArchitectValidation, processNLValidation, taskIdValidation } from './agent.validations';

const router = Router();

// Protect all agent routes
router.use(AuthMiddleware.authenticate);

router.post('/tasks', createTaskValidation, ValidationMiddleware.validate, AgentController.createTask);
router.get('/tasks', AgentController.listTasks);
router.get('/tasks/:taskId', taskIdValidation, ValidationMiddleware.validate, AgentController.getTask);

// Expensive AI & Processing operations - restricted to 50 requests per hour per user (approx)
// or more loosely 10 requests per minute
const aiLimiter = RateLimitMiddleware.limit({ zone: 'ai', maxRequests: 10, windowMs: 60 * 1000 });

router.post('/intent', aiLimiter, processNLValidation, ValidationMiddleware.validate, AgentController.processNaturalLanguage);
router.post('/intent/audio', aiLimiter, FileUploadMiddleware.uploadSingle('audio'), AgentController.processAudioIntent);
router.post('/chat', aiLimiter, chatValidation, ValidationMiddleware.validate, AgentController.chat);
router.get('/chat', AgentController.getHistory);
router.get('/briefing', AgentController.getBriefing);
router.get('/similar', findSimilarValidation, ValidationMiddleware.validate, AgentController.getSimilarEntries);
router.post('/goal-architect', aiLimiter, goalArchitectValidation, ValidationMiddleware.validate, AgentController.goalArchitectChat);
router.post('/sync', RateLimitMiddleware.limit({ zone: 'sync', maxRequests: 5, windowMs: 5 * 60 * 1000 }), AgentController.syncLibrary);

router.get('/persona', AgentController.getPersona);
router.delete('/chat', AgentController.clearHistory);

export default router;
