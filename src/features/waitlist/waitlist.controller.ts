import { Request, Response, NextFunction } from 'express';
import { WaitlistService } from './waitlist.service';
import { validateWaitlistEmail } from './waitlist.validations';
import { sendWaitlistConfirmationEmail, sendWaitlistAdminNotification } from './waitlist-email.service';
import { logger } from '../../config/logger';

/**
 * POST /api/v1/waitlist/join
 * Add email to waitlist
 */
export const joinWaitlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, source, answers, q1, q2, q3, q4 } = req.body;

    const normalizedSource = source === 'referral' || source === 'other' ? source : 'landing';

    const normalizedAnswers = {
      q1: answers?.q1 || q1 || null,
      q2: answers?.q2 || q2 || null,
      q3: answers?.q3 || q3 || null,
      q4: answers?.q4 || q4 || null,
    };

    const hasQuestionnaire = Object.values(normalizedAnswers).some(Boolean);
    const notes = hasQuestionnaire ? JSON.stringify({ questionnaire: normalizedAnswers }) : undefined;

    // Validate email format
    const validationError = validateWaitlistEmail(email);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // Add to waitlist
    const waitlistEntry = await WaitlistService.addToWaitlist(email, normalizedSource, notes);

    // Send confirmation email to user (async - don't wait)
    sendWaitlistConfirmationEmail(email)
      .catch((err) => logger.error('Failed to send confirmation email:', err));

    // Send admin notification (async - don't wait)
    sendWaitlistAdminNotification(email)
      .catch((err) => logger.error('Failed to send admin notification:', err));

    return res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      email: waitlistEntry.email,
    });
  } catch (error: unknown) {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: 'This email is already on the waitlist',
      });
    }

    logger.error('Error in joinWaitlist:', error);
    next(error);
  }
};

/**
 * GET /api/v1/waitlist/count
 * Get waitlist count (admin only)
 */
export const getWaitlistCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const count = await WaitlistService.getWaitlistCount();
    const byStatus = await WaitlistService.getCountByStatus();

    return res.status(200).json({
      success: true,
      total: count,
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (error) {
    logger.error('Error in getWaitlistCount:', error);
    next(error);
  }
};
