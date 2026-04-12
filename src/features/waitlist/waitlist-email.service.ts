import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { getEmailQueue } from '../email/queue/email.queue';

/**
 * Send waitlist confirmation email to user
 */
export async function sendWaitlistConfirmationEmail(email: string): Promise<void> {
  try {
    await getEmailQueue().add(
      'waitlist-confirmation',
      {
        type: 'WAITLIST_CONFIRMATION' as const,
        data: {
          to: email,
          email,
        },
      },
      {
        priority: 5, // High priority
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    logger.info(`Queued waitlist confirmation email for ${email}`);
  } catch (error) {
    logger.error('Error queuing confirmation email:', error);
    throw error;
  }
}

/**
 * Send admin notification about new waitlist signup
 */
export async function sendWaitlistAdminNotification(email: string): Promise<void> {
  try {
    const adminEmail = config.ADMIN_EMAIL;

    await getEmailQueue().add(
      'waitlist-admin-alert',
      {
        type: 'WAITLIST_ADMIN_ALERT' as const,
        data: {
          to: adminEmail,
          email,
        },
      },
      {
        priority: 4, // Medium-high priority
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    logger.info(`Queued admin alert for waitlist signup: ${email}`);
  } catch (error) {
    logger.error('Error queuing admin alert:', error);
    throw error;
  }
}
