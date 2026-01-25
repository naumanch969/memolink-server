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
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping email verification in test mode');
            return;
        }

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.transporter.verify();
                logger.info('Email server connection established');
                return;
            } catch (error: any) {
                logger.error(`Email server connection failed (attempt ${attempt}/${maxRetries}):`, {
                    error: error.message,
                    code: error.code
                });

                if (attempt === maxRetries) {
                    throw new Error(
                        `Failed to connect to email server after ${maxRetries} attempts: ${error.message}`
                    );
                }

                // Exponential backoff: 2s, 4s
                const delay = 2000 * attempt;
                logger.info(`Retrying email connection in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async sendEmail(options: EmailOptions): Promise<void> {
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
        } catch (error: any) {
            logger.error('Failed to send email:', {
                error: error.message,
                stack: error.stack,
                to: options.to,
                subject: options.subject,
                code: error.code,
                command: error.command
            });
            // Throw error to let BullMQ handle retries with proper error context
            throw new Error(`Email send failed: ${error.message}`);
        }
    }
}
