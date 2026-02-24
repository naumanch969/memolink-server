import mongoose, { Document, Schema } from 'mongoose';
import { IChatMessage } from '../agent.interfaces';

export interface IChatMemory extends Document {
    userId: string;
    messages: IChatMessage[];
    updatedAt: Date;
}

const ChatMemorySchema = new Schema<IChatMemory>({
    userId: { type: String, required: true, index: true, unique: true },
    messages: [{
        role: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: Number, required: true }
    }],
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure we only keep limited history even in Mongo
ChatMemorySchema.pre('save', function (next) {
    const MAX_HISTORY = 40;
    if (this.messages.length > MAX_HISTORY) {
        this.messages = this.messages.slice(-MAX_HISTORY);
    }
    next();
});

export const ChatMemory = mongoose.model<IChatMemory>('ChatMemory', ChatMemorySchema);
