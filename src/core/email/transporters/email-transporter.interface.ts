import { EmailOptions } from '../email.provider';
import { EmailProvider } from '../../../features/email/models/email-log.model';

export interface TransporterResponse {
    success: boolean;
    messageId?: string;
    error?: any;
    provider: EmailProvider;
}

export interface IEmailTransporter {
    send(options: EmailOptions): Promise<TransporterResponse>;
    name: string;
    provider: EmailProvider;
    verify?(): Promise<boolean>;
}
