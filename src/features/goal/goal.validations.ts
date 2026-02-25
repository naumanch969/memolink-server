import { body, param } from 'express-validator';
import { GOAL_STATUS } from '../../shared/constants';
import { GoalPeriod, GoalTrackingType } from './goal.types';

export const createGoalValidation = [
    body('title')
        .notEmpty().withMessage('Goal title is required')
        .isString().withMessage('Goal title must be a string')
        .trim()
        .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),

    body('period')
        .optional()
        .isIn(Object.values(GoalPeriod)).withMessage('Invalid goal period'),

    body('trackingConfig').optional().isObject(),
    body('trackingConfig.type')
        .optional()
        .isIn(Object.values(GoalTrackingType)).withMessage('Invalid tracking type'),
    body('trackingConfig.targetValue').optional().isNumeric(),
    body('trackingConfig.targetItems').optional().isArray(),
    body('trackingConfig.unit').optional().isString().trim(),

    body('trackingSchedule').optional().isObject(),
    body('trackingSchedule.frequency')
        .optional()
        .isIn(['daily', 'weekdays', 'specific_days', 'interval']),

    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .trim()
        .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    body('why')
        .optional()
        .isString().withMessage('Motivation (why) must be a string')
        .trim()
        .isLength({ max: 1000 }).withMessage('Motivation cannot exceed 1000 characters'),
    body('icon').optional().isString().trim(),
    body('color').optional().isString().trim(),
    body('status').optional().isIn(Object.values(GOAL_STATUS)),
    body('startDate').optional().isISO8601().toDate(),
    body('deadline').optional().isISO8601().toDate(),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('reward').optional().isString().trim(),
    body('milestones').optional().isArray(),
    body('milestones.*.title').notEmpty().withMessage('Milestone title is required'),

    // Tags: accept MongoIds (linked Tag entities) or plain strings (free-form)
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
];

export const updateGoalValidation = [
    param('id').isMongoId().withMessage('Invalid goal ID'),
    body('title')
        .optional()
        .isString().withMessage('Goal title must be a string')
        .trim()
        .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('status').optional().isIn(Object.values(GOAL_STATUS)),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('description').optional().isString().trim(),
    body('why').optional().isString().trim(),
    body('icon').optional().isString().trim(),
    body('color').optional().isString().trim(),
    body('deadline').optional().isISO8601().toDate(),
    body('period').optional().isIn(Object.values(GoalPeriod)),
    body('trackingConfig').optional().isObject(),
    body('trackingConfig.type').optional().isIn(Object.values(GoalTrackingType)),
    body('trackingConfig.targetValue').optional().isNumeric(),
    body('trackingConfig.targetItems').optional().isArray(),
    body('trackingConfig.unit').optional().isString().trim(),
    body('trackingSchedule').optional().isObject(),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('reward').optional().isString().trim(),
    body('milestones').optional().isArray(),
    body('milestones.*.title').optional().notEmpty(),
];

export const goalIdValidation = [
    param('id').isMongoId().withMessage('Invalid goal ID'),
];

export const updateProgressValidation = [
    param('id').isMongoId().withMessage('Invalid goal ID'),
    body('mode').optional().isIn(['add', 'set']),
    body('notes').optional().isString().trim(),
];
