import { body, param } from 'express-validator';
import { AgentTaskType } from './agent.types';

export const createTaskValidation = [
    body('type').notEmpty().withMessage('Task type is required').isIn(Object.values(AgentTaskType)).withMessage('Invalid task type'),
    body('inputData').optional().isObject(),
];

export const taskIdValidation = [
    param('taskId').isMongoId().withMessage('Invalid task ID'),
];

export const chatValidation = [
    body('message').notEmpty().withMessage('Message is required').isString().trim(),
];

export const goalArchitectValidation = [
    body('message').notEmpty().withMessage('Message is required').isString().trim(),
    body('history').optional().isArray(),
];
