import { getEmailQueue } from '../features/email/queue/email.queue';
import { validateEmailOrThrow } from '../shared/email-validator';
import { config } from './env';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      validateEmailOrThrow(options.to, 'generic email');
      await getEmailQueue().add('generic-email', {
        type: 'GENERIC',
        data: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue generic email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, name: string, otp: string): Promise<boolean> {
    try {
      validateEmailOrThrow(email, 'verification email');
      await getEmailQueue().add('verification-email', {
        type: 'VERIFICATION',
        data: {
          to: email,
          name,
          otp
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue verification email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
    try {
      validateEmailOrThrow(email, 'password reset email');
      await getEmailQueue().add('password-reset-email', {
        type: 'PASSWORD_RESET',
        data: {
          to: email,
          name,
          resetToken,
          frontendUrl: config.FRONTEND_URL || 'http://localhost:3000'
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue password reset email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      validateEmailOrThrow(email, 'welcome email');
      await getEmailQueue().add('welcome-email', {
        type: 'WELCOME',
        data: {
          to: email,
          name,
          frontendUrl: config.FRONTEND_URL || 'http://localhost:3000'
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue welcome email:', error);
      return false;
    }
  }

  async sendSecurityAlert(email: string, name: string, wrongAnswer: string): Promise<boolean> {
    try {
      validateEmailOrThrow(email, 'security alert email');
      await getEmailQueue().add('security-alert-email', {
        type: 'SECURITY_ALERT',
        data: {
          to: email,
          name,
          wrongAnswer
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue security alert email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
