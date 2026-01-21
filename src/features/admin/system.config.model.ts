import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemConfig extends Document {
    key: string;
    value: any;
    description?: string;
    category: 'feature_flags' | 'system' | 'maintenance';
    updatedBy?: string; // Admin ID
}

const systemConfigSchema = new Schema<ISystemConfig>({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: ['feature_flags', 'system', 'maintenance'],
        default: 'system'
    },
    updatedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true,
    collection: 'system_configs'
});

export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', systemConfigSchema);
