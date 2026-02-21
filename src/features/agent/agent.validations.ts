import { body, param, query } from 'express-validator';
import { AgentTaskType } from './agent.types';

export const createTaskValidation = [
    body('type').notEmpty().withMessage('Task type is required').isIn(Object.values(AgentTaskType)).withMessage('Invalid task type'),
    body('inputData').optional().isObject(),
];

export const taskIdValidation = [
    param('taskId').isMongoId().withMessage('Invalid task ID'),
];

export const processNLValidation = [
    body('text').notEmpty().withMessage('Text input is required').isString().trim(),
    body('tags').optional().isArray(),
    body('timezone').optional().isString(),
];

export const chatValidation = [
    body('message').notEmpty().withMessage('Message is required').isString().trim(),
];

export const goalArchitectValidation = [
    body('message').notEmpty().withMessage('Message is required').isString().trim(),
    body('history').optional().isArray(),
];

export const findSimilarValidation = [
    query('text').notEmpty().withMessage('Text query is required').isString().trim(),
];

export const cleanTextValidation = [
    body('text').notEmpty().withMessage('Text is required').isString().trim(),
];
