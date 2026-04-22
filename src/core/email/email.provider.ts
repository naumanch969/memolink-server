import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { ResendTransporter } from './transporters/resend.transporter';
import { SmtpTransporter } from './transporters/smtp.transporter';
import { TransporterResponse } from './transporters/email-transporter.interface';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export class EmailProvider {
    private static instance: EmailProvider;
    private resendTransporter: ResendTransporter;
    private smtpTransporter: SmtpTransporter;

    private constructor() {
        this.resendTransporter = new ResendTransporter();
        this.smtpTransporter = new SmtpTransporter();

        // Initial verification
        this.verifyConnection();
    }

    public static getInstance(): EmailProvider {
        if (!EmailProvider.instance) {
            EmailProvider.instance = new EmailProvider();
        }
        return EmailProvider.instance;
    }

    private async verifyConnection() {
        if (config.NODE_ENV === 'test') return;

        if (config.EMAIL_RESEND_API_KEY) {
            logger.info('Email System: Resend detected as primary provider');
            return;
        }

        const isSmtpConnected = await this.smtpTransporter.verify();
        if (isSmtpConnected) {
            logger.info('Email System: SMTP connection established');
        } else {
            logger.warn('Email System: SMTP connection failed. Please check credentials.');
        }
    }

    async sendEmail(options: EmailOptions): Promise<TransporterResponse> {
        const startedAt = Date.now();

        // 1. Try Resend if configured
        if (config.EMAIL_RESEND_API_KEY) {
            const result = await this.resendTransporter.send(options);
            if (result.success) {
                logger.info('Email sent successfully via Resend', {
                    to: options.to,
                    durationMs: Date.now() - startedAt
                });
                return result;
            }
            logger.warn('Resend send failed, trying fallback to SMTP...', { error: result.error });
        }

        // 2. Fallback to SMTP
        const result = await this.smtpTransporter.send(options);
        if (result.success) {
            logger.info('Email sent successfully via SMTP', {
                to: options.to,
                durationMs: Date.now() - startedAt
            });
            return result;
        }

        // 3. Both failed
        logger.error('Email delivery failed for all providers', {
            to: options.to,
            error: result.error,
            durationMs: Date.now() - startedAt
        });

        return result;
    }
}