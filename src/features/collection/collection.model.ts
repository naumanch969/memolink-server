import mongoose, { Schema } from 'mongoose';
import { ICollection } from './collection.types';

const collectionSchema = new Schema<ICollection>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: [100, 'Name cannot exceed 100 characters'] },
    icon: { type: String, trim: true, maxlength: 50 },
    color: { type: String, trim: true, match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'] },
    description: { type: String, trim: true, maxlength: [300, 'Description cannot exceed 300 characters'] },
    entryCount: { type: Number, default: 0 },
}, { timestamps: true });

collectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
export default Collection;
