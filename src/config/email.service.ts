import { getEmailQueue } from '../features/email/queue/email.queue';
import { validateEmailOrThrow } from '../shared/email-validator';
import { EmailProvider } from '../core/email/email.provider';
import { getVerificationEmailTemplate, getPasswordResetEmailTemplate, getSecurityAlertTemplate } from '../core/email/templates/auth.templates';
import { config } from './env';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<boolean>;
  sendVerificationEmail(email: string, name: string, otp: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean>;
  sendWelcomeEmail(email: string, name: string): Promise<boolean>;
  sendSecurityAlert(email: string, name: string, wrongAnswer: string): Promise<boolean>;
}

class EmailService implements IEmailService {

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

      const { subject, html, text } = getVerificationEmailTemplate(name, otp);
      await EmailProvider.getInstance().sendEmail({
        to: email,
        subject,
        html,
        text
      });

      return true;
    } catch (error) {
      logger.error('Failed to send verification email (sync):', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
    try {
      validateEmailOrThrow(email, 'password reset email');

      const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const { subject, html, text } = getPasswordResetEmailTemplate(name, resetUrl);

      await EmailProvider.getInstance().sendEmail({
        to: email,
        subject,
        html,
        text
      });

      return true;
    } catch (error) {
      logger.error('Failed to send password reset email (sync):', error);
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
          frontendUrl: config.FRONTEND_URL
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

      const { subject, html, text } = getSecurityAlertTemplate(name, wrongAnswer);
      await EmailProvider.getInstance().sendEmail({
        to: email,
        subject,
        html,
        text
      });

      return true;
    } catch (error) {
      logger.error('Failed to send security alert email (sync):', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
