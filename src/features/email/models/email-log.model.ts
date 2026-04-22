import mongoose, { Schema } from 'mongoose';
import { IEmailLog, EmailStatus, EmailProvider } from '../interfaces/email-log.interface';

export { EmailStatus, EmailProvider };

const emailLogSchema = new Schema<IEmailLog>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    templateId: { type: String, index: true },
    templateData: { type: Schema.Types.Mixed },
    provider: { 
        type: String, 
        enum: Object.values(EmailProvider), 
        default: EmailProvider.NONE 
    },
    providerMessageId: { type: String, index: true },
    status: {
        type: String,
        enum: Object.values(EmailStatus),
        default: EmailStatus.PENDING,
        index: true
    },
    attempts: { type: Number, default: 0 },
    lastError: {
        message: { type: String },
        code: { type: String },
        stack: { type: String }
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    failedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
}, {
    timestamps: true,
});

// Compound index for history lookup
emailLogSchema.index({ userId: 1, createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

export const EmailLog = mongoose.model<IEmailLog>('EmailLog', emailLogSchema);
