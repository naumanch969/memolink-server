import { body, param, query } from 'express-validator';

// ============================================
// CREATE REMINDER VALIDATION
// ============================================

export const createReminderValidation = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters'),

    body('date')
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),

    body('startTime')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Start time must be in HH:mm format'),

    body('endTime')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('End time must be in HH:mm format'),

    body('allDay')
        .optional()
        .isBoolean()
        .withMessage('All day must be a boolean'),

    // Recurring validation
    body('recurring')
        .optional()
        .isObject()
        .withMessage('Recurring must be an object'),

    body('recurring.enabled')
        .optional()
        .isBoolean()
        .withMessage('Recurring enabled must be a boolean'),

    body('recurring.frequency')
        .optional()
        .isIn(['daily', 'weekly', 'monthly', 'yearly', 'custom'])
        .withMessage('Frequency must be one of: daily, weekly, monthly, yearly, custom'),

    body('recurring.interval')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Interval must be between 1 and 365'),

    body('recurring.daysOfWeek')
        .optional()
        .isArray()
        .withMessage('Days of week must be an array'),

    body('recurring.daysOfWeek.*')
        .optional()
        .isInt({ min: 0, max: 6 })
        .withMessage('Each day must be a number between 0 (Sunday) and 6 (Saturday)'),

    body('recurring.endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),

    body('recurring.endAfterOccurrences')
        .optional()
        .isInt({ min: 1, max: 999 })
        .withMessage('End after occurrences must be between 1 and 999'),

    // Notifications validation
    body('notifications')
        .optional()
        .isObject()
        .withMessage('Notifications must be an object'),

    body('notifications.enabled')
        .optional()
        .isBoolean()
        .withMessage('Notifications enabled must be a boolean'),

    body('notifications.times')
        .optional()
        .isArray({ max: 10 })
        .withMessage('Notification times must be an array with max 10 items'),

    body('notifications.times.*.type')
        .optional()
        .isIn(['minutes', 'hours', 'days'])
        .withMessage('Notification type must be one of: minutes, hours, days'),

    body('notifications.times.*.value')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Notification value must be a non-negative integer'),

    // Priority
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be one of: low, medium, high'),

    // Linked items
    body('linkedTags')
        .optional()
        .isArray()
        .withMessage('Linked tags must be an array'),

    body('linkedTags.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid tag ID format'),

    body('linkedEntities')
        .optional()
        .isArray()
        .withMessage('Linked people must be an array'),

    body('linkedEntities.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid person ID format'),

    body('linkedEntries')
        .optional()
        .isArray()
        .withMessage('Linked entries must be an array'),

    body('linkedEntries.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid entry ID format'),


];

// ============================================
// UPDATE REMINDER VALIDATION
// ============================================

export const updateReminderValidation = [
    body('title')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters'),

    body('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),

    body('startTime')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Start time must be in HH:mm format'),

    body('endTime')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('End time must be in HH:mm format'),

    body('allDay')
        .optional()
        .isBoolean()
        .withMessage('All day must be a boolean'),

    body('recurring')
        .optional()
        .isObject()
        .withMessage('Recurring must be an object'),

    body('notifications')
        .optional()
        .isObject()
        .withMessage('Notifications must be an object'),

    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be one of: low, medium, high'),

    body('status')
        .optional()
        .isIn(['pending', 'completed', 'cancelled'])
        .withMessage('Status must be one of: pending, completed, cancelled'),

    body('linkedTags')
        .optional()
        .isArray()
        .withMessage('Linked tags must be an array'),

    body('linkedEntities')
        .optional()
        .isArray()
        .withMessage('Linked people must be an array'),

    body('linkedEntries')
        .optional()
        .isArray()
        .withMessage('Linked entries must be an array'),


];

// ============================================
// QUERY VALIDATION
// ============================================

export const getRemindersQueryValidation = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),

    query('status')
        .optional()
        .custom((value) => {
            const validStatuses = ['pending', 'completed', 'cancelled'];
            if (Array.isArray(value)) {
                return value.every(s => validStatuses.includes(s));
            }
            return validStatuses.includes(value);
        })
        .withMessage('Status must be one of: pending, completed, cancelled'),

    query('priority')
        .optional()
        .custom((value) => {
            const validPriorities = ['low', 'medium', 'high'];
            if (Array.isArray(value)) {
                return value.every(p => validPriorities.includes(p));
            }
            return validPriorities.includes(value);
        })
        .withMessage('Priority must be one of: low, medium, high'),

    query('tagId')
        .optional()
        .isMongoId()
        .withMessage('Invalid tag ID format'),

    query('entityId')
        .optional()
        .isMongoId()
        .withMessage('Invalid person ID format'),

    query('entryId')
        .optional()
        .isMongoId()
        .withMessage('Invalid entry ID format'),



    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 1000'),

    query('skip')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Skip must be a non-negative integer'),
];

// ============================================
// COMPLETE REMINDER VALIDATION
// ============================================

export const completeReminderValidation = [
    body('completedAt')
        .optional()
        .isISO8601()
        .withMessage('Completed at must be a valid ISO 8601 date'),
];

// ============================================
// ID PARAM VALIDATION
// ============================================

export const reminderIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid reminder ID format'),
];
