import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { ReminderController } from './reminder.controller';
import { completeReminderValidation, createReminderValidation, getRemindersQueryValidation, reminderIdValidation, updateReminderValidation, } from './reminder.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// REMINDER CRUD
// ============================================

// Create reminder
router.post('/', createReminderValidation, validationMiddleware, ReminderController.createReminder);

// Get all reminders with filters
router.get('/', getRemindersQueryValidation, validationMiddleware, ReminderController.getReminders);

// Get upcoming reminders
router.get('/upcoming', ReminderController.getUpcomingReminders);

// Get overdue reminders
router.get('/overdue', ReminderController.getOverdueReminders);

// Get single reminder
router.get('/:id', reminderIdValidation, validationMiddleware, ReminderController.getReminderById);

// Update reminder
router.patch('/:id', reminderIdValidation, updateReminderValidation, validationMiddleware, ReminderController.updateReminder);

// Complete reminder
router.patch('/:id/complete', reminderIdValidation, completeReminderValidation, validationMiddleware, ReminderController.completeReminder);

// Cancel reminder
router.patch('/:id/cancel', reminderIdValidation, validationMiddleware, ReminderController.cancelReminder);

// Delete reminder
router.delete('/:id', reminderIdValidation, validationMiddleware, ReminderController.deleteReminder);

export default router;
