import { Router } from 'express';
import reminderController from './reminder.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { createReminderValidation, updateReminderValidation, getRemindersQueryValidation, completeReminderValidation, reminderIdValidation, } from './reminder.validation';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// REMINDER CRUD
// ============================================

// Create reminder
router.post('/', createReminderValidation, validationMiddleware, reminderController.createReminder);

// Get all reminders with filters
router.get('/', getRemindersQueryValidation, validationMiddleware, reminderController.getReminders);

// Get upcoming reminders
router.get('/upcoming', reminderController.getUpcomingReminders);

// Get overdue reminders
router.get('/overdue', reminderController.getOverdueReminders);

// Get single reminder
router.get('/:id', reminderIdValidation, validationMiddleware, reminderController.getReminderById);

// Update reminder
router.patch('/:id', reminderIdValidation, updateReminderValidation, validationMiddleware, reminderController.updateReminder);

// Complete reminder
router.patch('/:id/complete', reminderIdValidation, completeReminderValidation, validationMiddleware, reminderController.completeReminder);

// Cancel reminder
router.patch('/:id/cancel', reminderIdValidation, validationMiddleware, reminderController.cancelReminder);

// Delete reminder
router.delete('/:id', reminderIdValidation, validationMiddleware, reminderController.deleteReminder);

export default router;
