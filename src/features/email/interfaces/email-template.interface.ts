import { Document } from 'mongoose';

export interface IEmailTemplate extends Document {
    name: string; // Unique identifier for the template
    subject: string;
    htmlBody: string;
    textBody?: string;
    variables: string[]; // List of required/available variables
    description?: string;
    isSystem: boolean; // True for hardcoded system templates that shouldn't be deleted
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
