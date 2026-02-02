import mongoose, { Schema } from 'mongoose';
import { IMoodDocument } from './mood.interfaces';

const moodSchema = new Schema<IMoodDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        index: true
    },
    score: {
        type: Number,
        required: [true, 'Score is required'],
        min: 1,
        max: 5
    },
    note: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true,
});

// Ensure only one mood per user per day (normalized to YYYY-MM-DD)
// We'll handle normalization in the service, but let's add an index for performance
moodSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Mood = mongoose.model<IMoodDocument>('Mood', moodSchema);
export default Mood;
