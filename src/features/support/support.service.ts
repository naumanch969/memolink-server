import { logger } from '../../config/logger';
import { emailService } from '../email/email.service';

export class SupportService {
  async sendSupportRequest({ name, email, subject, message, type }: { name: string, email: string, subject: string, message: string, type: string }) {
    try {
      const supportEmail = 'support.brinn@opstintechnologies.com';

      const html = `
                     <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                         <h2 style="color: #333; margin-bottom: 20px;">Support Request / Feedback</h2>
                         <p><strong>From:</strong> ${name} (${email})</p>
                         <p><strong>Type:</strong> ${type || 'General Feedback'}</p>
                         <p><strong>Subject:</strong> ${subject}</p>
                         <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                         <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${message}</p>
                         <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                         <p style="font-size: 12px; color: #999;">This message was sent from the Brinn Feedback Modal.</p>
                     </div>
                 `;

      const text = `Support request from ${name} (${email}):\n\n${message}`;

      // Use the unified email engine
      await emailService.sendCustomEmail(
        supportEmail,
        `[FEEDBACK] ${subject} - from ${name}`,
        html,
        text,
        undefined, // No userId associated with support yet
        { supportName: name, supportEmail: email, supportType: type }
      );

      logger.info('Support request queued via unified engine', { email, subject });
      return { success: true };
    } catch (error) {
      logger.error('Failed to queue support request', error);
      throw error;
    }
  }
}

export const supportService = new SupportService();
export default supportService;
