import { body, param, query } from 'express-validator';
import { ROUTINE_VALIDATION, ROUTINE_TYPES, ROUTINE_STATUS } from '../../shared/constants';

// ============================================
// ROUTINE TEMPLATE VALIDATIONS
// ============================================

export const createRoutineTemplateValidation = [
    body('name')
        .trim()
        .isLength({ min: ROUTINE_VALIDATION.NAME_MIN_LENGTH, max: ROUTINE_VALIDATION.NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${ROUTINE_VALIDATION.NAME_MIN_LENGTH} and ${ROUTINE_VALIDATION.NAME_MAX_LENGTH} characters`),

    body('description')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.DESCRIPTION_MAX_LENGTH })
        .withMessage(`Description cannot exceed ${ROUTINE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`),

    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Icon cannot exceed 50 characters'),

    body('type')
        .isIn(Object.values(ROUTINE_TYPES))
        .withMessage(`Type must be one of: ${Object.values(ROUTINE_TYPES).join(', ')}`),

    body('config')
        .isObject()
        .withMessage('Config must be an object'),

    body('config.items')
        .optional()
        .isArray({ max: ROUTINE_VALIDATION.CHECKLIST_MAX_ITEMS })
        .withMessage(`Checklist items cannot exceed ${ROUTINE_VALIDATION.CHECKLIST_MAX_ITEMS}`),

    body('config.items.*')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.CHECKLIST_ITEM_MAX_LENGTH })
        .withMessage(`Each item cannot exceed ${ROUTINE_VALIDATION.CHECKLIST_ITEM_MAX_LENGTH} characters`),

    body('config.target')
        .optional()
        .isInt({ min: 1, max: ROUTINE_VALIDATION.COUNTER_MAX_TARGET })
        .withMessage(`Target must be between 1 and ${ROUTINE_VALIDATION.COUNTER_MAX_TARGET}`),

    body('config.unit')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.UNIT_MAX_LENGTH })
        .withMessage(`Unit cannot exceed ${ROUTINE_VALIDATION.UNIT_MAX_LENGTH} characters`),

    body('config.scale')
        .optional()
        .isInt({ min: ROUTINE_VALIDATION.SCALE_MIN, max: ROUTINE_VALIDATION.SCALE_MAX })
        .withMessage(`Scale must be between ${ROUTINE_VALIDATION.SCALE_MIN} and ${ROUTINE_VALIDATION.SCALE_MAX}`),

    body('config.scaleLabels')
        .optional()
        .isArray()
        .withMessage('Scale labels must be an array'),

    body('config.prompt')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.TEXT_PROMPT_MAX_LENGTH })
        .withMessage(`Prompt cannot exceed ${ROUTINE_VALIDATION.TEXT_PROMPT_MAX_LENGTH} characters`),

    body('config.targetTime')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Target time must be in HH:mm format'),

    body('schedule')
        .isObject()
        .withMessage('Schedule must be an object'),

    body('schedule.activeDays')
        .isArray({ min: 1, max: ROUTINE_VALIDATION.MAX_ACTIVE_DAYS })
        .withMessage('Active days must be an array with 1-7 elements'),

    body('schedule.activeDays.*')
        .isInt({ min: 0, max: 6 })
        .withMessage('Each active day must be a number between 0 (Sunday) and 6 (Saturday)'),

    body('completionMode')
        .optional()
        .isIn(['strict', 'gradual'])
        .withMessage('Completion mode must be either strict or gradual'),

    body('gradualThreshold')
        .optional()
        .isInt({ min: ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MIN, max: ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MAX })
        .withMessage(`Gradual threshold must be between ${ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MIN} and ${ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MAX}`),

    body('linkedTags')
        .optional()
        .isArray()
        .withMessage('Linked tags must be an array'),

    body('linkedTags.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid tag ID format'),

    body('order')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order must be a non-negative integer'),
];

export const updateRoutineTemplateValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: ROUTINE_VALIDATION.NAME_MIN_LENGTH, max: ROUTINE_VALIDATION.NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${ROUTINE_VALIDATION.NAME_MIN_LENGTH} and ${ROUTINE_VALIDATION.NAME_MAX_LENGTH} characters`),

    body('description')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.DESCRIPTION_MAX_LENGTH })
        .withMessage(`Description cannot exceed ${ROUTINE_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`),

    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Icon cannot exceed 50 characters'),

    body('type')
        .optional()
        .isIn(Object.values(ROUTINE_TYPES))
        .withMessage(`Type must be one of: ${Object.values(ROUTINE_TYPES).join(', ')}`),

    body('config')
        .optional()
        .isObject()
        .withMessage('Config must be an object'),

    body('schedule')
        .optional()
        .isObject()
        .withMessage('Schedule must be an object'),

    body('schedule.activeDays')
        .optional()
        .isArray({ min: 1, max: ROUTINE_VALIDATION.MAX_ACTIVE_DAYS })
        .withMessage('Active days must be an array with 1-7 elements'),

    body('schedule.activeDays.*')
        .optional()
        .isInt({ min: 0, max: 6 })
        .withMessage('Each active day must be a number between 0 (Sunday) and 6 (Saturday)'),

    body('completionMode')
        .optional()
        .isIn(['strict', 'gradual'])
        .withMessage('Completion mode must be either strict or gradual'),

    body('gradualThreshold')
        .optional()
        .isInt({ min: ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MIN, max: ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MAX })
        .withMessage(`Gradual threshold must be between ${ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MIN} and ${ROUTINE_VALIDATION.GRADUAL_THRESHOLD_MAX}`),

    body('linkedTags')
        .optional()
        .isArray()
        .withMessage('Linked tags must be an array'),

    body('linkedTags.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid tag ID format'),

    body('order')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Order must be a non-negative integer'),
];

export const routineIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid routine ID format'),
];

export const reorderRoutinesValidation = [
    body('routineIds')
        .isArray({ min: 1 })
        .withMessage('Routine IDs must be a non-empty array'),

    body('routineIds.*')
        .isMongoId()
        .withMessage('Invalid routine ID format'),
];

// ============================================
// ROUTINE LOG VALIDATIONS
// ============================================

export const createRoutineLogValidation = [
    body('routineId')
        .isMongoId()
        .withMessage('Invalid routine ID format'),

    body('date')
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),

    body('data')
        .isObject()
        .withMessage('Data must be an object'),

    body('data.completed')
        .optional()
        .isBoolean()
        .withMessage('Completed must be a boolean'),

    body('data.checkedItems')
        .optional()
        .isArray()
        .withMessage('Checked items must be an array'),

    body('data.checkedItems.*')
        .optional()
        .isBoolean()
        .withMessage('Each checked item must be a boolean'),

    body('data.value')
        .optional()
        .isNumeric()
        .withMessage('Value must be a number'),

    body('data.text')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.TEXT_RESPONSE_MAX_LENGTH })
        .withMessage(`Text cannot exceed ${ROUTINE_VALIDATION.TEXT_RESPONSE_MAX_LENGTH} characters`),

    body('data.time')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Time must be in HH:mm format'),

    body('journalEntryId')
        .optional()
        .isMongoId()
        .withMessage('Invalid journal entry ID format'),
];

export const updateRoutineLogValidation = [
    body('data')
        .optional()
        .isObject()
        .withMessage('Data must be an object'),

    body('data.completed')
        .optional()
        .isBoolean()
        .withMessage('Completed must be a boolean'),

    body('data.checkedItems')
        .optional()
        .isArray()
        .withMessage('Checked items must be an array'),

    body('data.checkedItems.*')
        .optional()
        .isBoolean()
        .withMessage('Each checked item must be a boolean'),

    body('data.value')
        .optional()
        .isNumeric()
        .withMessage('Value must be a number'),

    body('data.text')
        .optional()
        .trim()
        .isLength({ max: ROUTINE_VALIDATION.TEXT_RESPONSE_MAX_LENGTH })
        .withMessage(`Text cannot exceed ${ROUTINE_VALIDATION.TEXT_RESPONSE_MAX_LENGTH} characters`),

    body('data.time')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Time must be in HH:mm format'),

    body('journalEntryId')
        .optional()
        .isMongoId()
        .withMessage('Invalid journal entry ID format'),
];

export const logIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid log ID format'),
];

export const getRoutineLogsValidation = [
    query('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),

    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),

    query('routineId')
        .optional()
        .isMongoId()
        .withMessage('Invalid routine ID format'),
];

// ============================================
// ANALYTICS VALIDATIONS
// ============================================

export const getRoutineStatsValidation = [
    query('period')
        .optional()
        .isIn(['week', 'month', 'year', 'all'])
        .withMessage('Period must be one of: week, month, year, all'),

    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
];

export const getRoutineAnalyticsValidation = [
    query('period')
        .optional()
        .isIn(['week', 'month', 'year'])
        .withMessage('Period must be one of: week, month, year'),
];

// ============================================
// USER PREFERENCES VALIDATIONS
// ============================================

export const updateUserRoutinePreferencesValidation = [
    body('reminders')
        .optional()
        .isObject()
        .withMessage('Reminders must be an object'),

    body('reminders.enabled')
        .optional()
        .isBoolean()
        .withMessage('Enabled must be a boolean'),

    body('reminders.dailyReminderTime')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Daily reminder time must be in HH:mm format'),

    body('reminders.smartReminders')
        .optional()
        .isBoolean()
        .withMessage('Smart reminders must be a boolean'),

    body('reminders.customReminders')
        .optional()
        .isArray()
        .withMessage('Custom reminders must be an array'),

    body('reminders.customReminders.*.routineId')
        .optional()
        .isMongoId()
        .withMessage('Invalid routine ID format'),

    body('reminders.customReminders.*.time')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Time must be in HH:mm format'),

    body('reminders.customReminders.*.message')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Message cannot exceed 200 characters'),

    body('defaultView')
        .optional()
        .isIn(['list', 'grid', 'compact'])
        .withMessage('Default view must be one of: list, grid, compact'),

    body('showStreaksOnCalendar')
        .optional()
        .isBoolean()
        .withMessage('Show streaks on calendar must be a boolean'),
];
