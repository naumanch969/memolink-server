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
        const port = parseInt(config.EMAIL_PORT || '587');
        // Hostinger and many others require secure: true for port 465
        const isSecure = port === 465 || String(config.EMAIL_SECURE).toLowerCase() === 'true';

        this.transporter = nodemailer.createTransport({
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            host: config.EMAIL_HOST || 'smtp.gmail.com',
            port: port,
            secure: isSecure,
            connectionTimeout: config.EMAIL_CONNECTION_TIMEOUT_MS,
            greetingTimeout: config.EMAIL_GREETING_TIMEOUT_MS,
            socketTimeout: config.EMAIL_SOCKET_TIMEOUT_MS,
            dnsTimeout: config.EMAIL_DNS_TIMEOUT_MS,
            auth: {
                user: config.EMAIL_USER,
                pass: config.EMAIL_PASS,
            },
            tls: {
                // Many hosting providers (like Hostinger) may have certificate chain issues 
                // in containerized environments. This ensures the handshake succeeds.
                rejectUnauthorized: false
            }
        });

        // Fire and forget verification, but catch errors to prevent unhandled rejections
        this.verifyConnection().catch(err => {
            logger.error('EmailProvider failed to establish initial connection:', {
                message: err.message,
                host: config.EMAIL_HOST,
                port: port,
                secure: isSecure,
                user: config.EMAIL_USER
            });
        });
    }

    public static getInstance(): EmailProvider {
        if (!EmailProvider.instance) {
            EmailProvider.instance = new EmailProvider();
        }
        return EmailProvider.instance;
    }

    private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);

            promise
                .then((value) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    private async verifyConnection() {
        if (config.NODE_ENV === 'test') {
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
        const startedAt = Date.now();
        try {
            const mailOptions = {
                from: `"Brinn" <${config.EMAIL_USER}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            };

            const result = await this.withTimeout(
                this.transporter.sendMail(mailOptions),
                config.EMAIL_SEND_TIMEOUT_MS,
                `Email send timeout after ${config.EMAIL_SEND_TIMEOUT_MS}ms`
            );

            logger.info('Email sent successfully', {
                messageId: result.messageId,
                to: options.to,
                subject: options.subject,
                durationMs: Date.now() - startedAt
            });
        } catch (error: any) {
            logger.error('Failed to send email:', {
                error: error.message,
                stack: error.stack,
                to: options.to,
                subject: options.subject,
                code: error.code,
                command: error.command,
                durationMs: Date.now() - startedAt
            });
            // Throw error to let BullMQ handle retries with proper error context
            throw new Error(`Email send failed: ${error.message}`);
        }
    }
}
 