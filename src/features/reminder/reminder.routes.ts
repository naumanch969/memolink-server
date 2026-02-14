import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { ReminderController } from './reminder.controller';
import { completeReminderValidation, createReminderValidation, getRemindersQueryValidation, reminderIdValidation, updateReminderValidation, } from './reminder.validations';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Create reminder
router.post('/', createReminderValidation, ValidationMiddleware.validate, ReminderController.createReminder);

// Get all reminders with filters
router.get('/', getRemindersQueryValidation, ValidationMiddleware.validate, ReminderController.getReminders);

// Get upcoming reminders
router.get('/upcoming', ReminderController.getUpcomingReminders);

// Get overdue reminders
router.get('/overdue', ReminderController.getOverdueReminders);

// Get single reminder
router.get('/:id', reminderIdValidation, ValidationMiddleware.validate, ReminderController.getReminderById);

// Update reminder
router.patch('/:id', reminderIdValidation, updateReminderValidation, ValidationMiddleware.validate, ReminderController.updateReminder);

// Complete reminder
router.patch('/:id/complete', reminderIdValidation, completeReminderValidation, ValidationMiddleware.validate, ReminderController.completeReminder);

// Cancel reminder
router.patch('/:id/cancel', reminderIdValidation, ValidationMiddleware.validate, ReminderController.cancelReminder);

// Delete reminder
router.delete('/:id', reminderIdValidation, ValidationMiddleware.validate, ReminderController.deleteReminder);

export default router;
