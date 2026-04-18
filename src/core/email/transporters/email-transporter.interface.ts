import { EmailOptions } from '../email.provider';

export interface IEmailTransporter {
    send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: any }>;
    name: string;
}
