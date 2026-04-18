import axios from 'axios';
import { config } from '../../../config/env';
import { logger } from '../../../config/logger';
import { EmailOptions } from '../email.provider';
import { IEmailTransporter } from './email-transporter.interface';

export class ResendTransporter implements IEmailTransporter {
    public readonly name = 'Resend';
    public readonly baseUrl = 'https://api.resend.com/emails'

    async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: any }> {
        if (!config.EMAIL_RESEND_API_KEY) {
            return { success: false, error: 'Resend API key missing' };
        }

        try {
            const response = await axios.post(this.baseUrl, {
                from: config.EMAIL_FROM || 'company@opstintechnologies.com',
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            }, {
                headers: {
                    'Authorization': `Bearer ${config.EMAIL_RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.status === 200 || response.status === 201) {
                return { success: true, messageId: response.data.id };
            }

            return { success: false, error: response.data };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}
