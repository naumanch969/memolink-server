import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserPersona {
    userId: string;
    summary: string; // High-level executive summary
    rawMarkdown: string; // The "Source of Truth" living document (OpenClaw style)
    lastSynthesized: Date;
}

export interface IUserPersonaDocument extends IUserPersona, Document { }

const userPersonaSchema = new Schema<IUserPersonaDocument>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        summary: { type: String, default: 'Initial persona extraction in progress...' },
        rawMarkdown: { type: String, default: '' },
        lastSynthesized: { type: Date, default: Date.now }
    },
    {
        timestamps: true,
        collection: 'user_personas'
    }
);

export const UserPersona: Model<IUserPersonaDocument> = mongoose.model<IUserPersonaDocument>('UserPersona', userPersonaSchema);
