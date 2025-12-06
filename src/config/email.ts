import nodemailer from 'nodemailer';
import { logger } from './logger';
import { config } from './env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(config.EMAIL_PORT || '587'),
      secure: config.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"MemoLink" <${config.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, name: string, otp: string): Promise<boolean> {
    const subject = 'Verify your MemoLink account';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">MemoLink</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your Personal Journal</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to MemoLink, ${name}!</h2>
            
            <p>Thank you for signing up. To complete your registration and start using MemoLink, please verify your email address using the OTP below:</p>
            
            <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h3 style="color: #667eea; margin: 0; font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h3>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This OTP will expire in 10 minutes. If you didn't create an account with MemoLink, please ignore this email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666; font-size: 12px; margin: 0;">
                Best regards,<br>
                The MemoLink Team
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to MemoLink, ${name}!
      
      Thank you for signing up. To complete your registration, please verify your email address using this OTP:
      
      ${otp}
      
      This OTP will expire in 10 minutes.
      
      If you didn't create an account with MemoLink, please ignore this email.
      
      Best regards,
      The MemoLink Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

    const subject = 'Reset your MemoLink password';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">MemoLink</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your Personal Journal</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hello ${name},</p>
            
            <p>We received a request to reset your password for your MemoLink account. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, you can copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666; font-size: 12px; margin: 0;">
                Best regards,<br>
                The MemoLink Team
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hello ${name},
      
      We received a request to reset your password for your MemoLink account. 
      Please visit the following link to reset your password:
      
      ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      
      Best regards,
      The MemoLink Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const subject = 'Welcome to MemoLink!';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to MemoLink</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">MemoLink</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your Personal Journal</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to MemoLink, ${name}!</h2>
            
            <p>Congratulations! Your email has been successfully verified and your MemoLink account is now active.</p>
            
            <p>You can now start:</p>
            <ul style="color: #555;">
              <li>Creating journal entries</li>
              <li>Tracking people in your life</li>
              <li>Organizing with tags</li>
              <li>Building habits</li>
              <li>Viewing your analytics</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.FRONTEND_URL || 'http://localhost:3000'}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Journaling</a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #666; font-size: 12px; margin: 0;">
                Best regards,<br>
                The MemoLink Team
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to MemoLink, ${name}!
      
      Congratulations! Your email has been successfully verified and your MemoLink account is now active.
      
      You can now start creating journal entries, tracking people in your life, organizing with tags, building habits, and viewing your analytics.
      
      Visit ${config.FRONTEND_URL || 'http://localhost:3000'} to get started.
      
      Best regards,
      The MemoLink Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
