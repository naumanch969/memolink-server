import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { emailService } from '../email/email.service';

/**
 * Send waitlist confirmation email to user
 */
export async function sendWaitlistConfirmationEmail(email: string): Promise<void> {
  try {
    await emailService.sendWaitlistConfirmationEmail(email);
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
    await emailService.sendWaitlistAdminAlert(email, adminEmail);
    logger.info(`Queued admin alert for waitlist signup: ${email}`);
  } catch (error) {
    logger.error('Error queuing admin alert:', error);
    throw error;
  }
}
