import nodemailer from 'nodemailer';
import { config } from '../../../config/env';
import { EmailOptions } from '../email.provider';
import { IEmailTransporter } from './email-transporter.interface';

export class SmtpTransporter implements IEmailTransporter {
    public readonly name = 'SMTP';
    private transporter: nodemailer.Transporter;

    constructor() {
        const port = parseInt(config.EMAIL_PORT || '587');
        const isSecure = port === 465 || String(config.EMAIL_SECURE).toLowerCase() === 'true';

        this.transporter = nodemailer.createTransport({
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            host: config.EMAIL_HOST || 'smtp.gmail.com',
            port: port,
            secure: isSecure,
            auth: {
                user: config.EMAIL_USER,
                pass: config.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: any }> {
        try {
            const mailOptions = {
                from: config.EMAIL_FROM || `"Brinn" <${config.EMAIL_USER}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            };

            const result = await this.transporter.sendMail(mailOptions);
            return { success: true, messageId: result.messageId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async verify(): Promise<boolean> {
        try {
            await this.transporter.verify();
            return true;
        } catch {
            return false;
        }
    }
}
