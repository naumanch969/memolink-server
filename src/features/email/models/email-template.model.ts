import mongoose, { Schema } from 'mongoose';
import { IEmailTemplate } from '../interfaces/email-template.interface';

const emailTemplateSchema = new Schema<IEmailTemplate>({
    name: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String },
    variables: [{ type: String }],
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, });

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);
