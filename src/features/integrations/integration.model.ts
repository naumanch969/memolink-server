import { Document, Schema, Types, model } from 'mongoose';

export interface IIntegrationToken {
    userId: Types.ObjectId;
    // TODO: Using simple strings for now, but in production these should be encrypted at rest using a mongoose plugin or custom pre-save hook
    provider: string; // Dynamic provider ID, e.g. 'google_calendar', 'google_gmail'
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
    expiresAt?: Date;
    connectedAt: Date;
    profile?: {
        id?: string;
        email?: string;
        name?: string;
        picture?: string;
    };
}

export interface IIntegrationTokenDocument extends IIntegrationToken, Document {
    isExpired(): boolean;
}

const IntegrationTokenSchema = new Schema<IIntegrationTokenDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    scopes: [{ type: String }],
    expiresAt: { type: Date },
    connectedAt: { type: Date, default: Date.now },
    profile: {
        id: String,
        email: String,
        name: String,
        picture: String
    }
}, {
    timestamps: true
});

// Create a compound index so a user only has one token per provider
IntegrationTokenSchema.index({ userId: 1, provider: 1 }, { unique: true });

IntegrationTokenSchema.methods.isExpired = function (): boolean {
    if (!this.expiresAt) return false;
    // Add a 5 minute buffer to safely refresh before it actually expires
    return Date.now() >= (this.expiresAt.getTime() - 5 * 60 * 1000);
};

export const IntegrationToken = model<IIntegrationTokenDocument>('IntegrationToken', IntegrationTokenSchema);

