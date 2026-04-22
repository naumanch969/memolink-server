import { Document, Types } from 'mongoose';

export enum EmailStatus {
    PENDING = 'pending',
    QUEUED = 'queued',
    SENDING = 'sending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    OPENED = 'opened',
    CLICKED = 'clicked',
    FAILED = 'failed',
    BOUNCED = 'bounced',
    SPAM = 'spam',
}

export enum EmailProvider {
    RESEND = 'resend',
    SMTP = 'smtp',
    NONE = 'none',
}

export interface IEmailLog extends Document {
    userId?: Types.ObjectId;
    to: string;
    subject: string;
    templateId?: string; // Reference to EmailTemplate name or ID
    templateData?: Record<string, any>;
    provider: EmailProvider;
    providerMessageId?: string;
    status: EmailStatus;
    attempts: number;
    lastError?: {
        message: string;
        code?: string;
        stack?: string;
    };
    sentAt?: Date;
    deliveredAt?: Date;
    openedAt?: Date;
    clickedAt?: Date;
    failedAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
