import nodemailer from 'nodemailer';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export class EmailProvider {
    private transporter: nodemailer.Transporter;
    private static instance: EmailProvider;

    private constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(config.EMAIL_PORT || '587'),
            secure: config.EMAIL_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: config.EMAIL_USER,
                pass: config.EMAIL_PASS,
            },
        });

        this.verifyConnection();
    }

    public static getInstance(): EmailProvider {
        if (!EmailProvider.instance) {
            EmailProvider.instance = new EmailProvider();
        }
        return EmailProvider.instance;
    }

    private async verifyConnection() {
        try {
            if (process.env.NODE_ENV !== 'test') {
                await this.transporter.verify();
                logger.info('Email server connection established');
            }
        } catch (error) {
            logger.error('Email server connection failed:', error);
        }
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
            return false; // Don't throw, just return false so worker can handle retry or failure logic
        }
    }
}
