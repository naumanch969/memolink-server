import mongoose, { Schema } from 'mongoose';
import { ITag } from './tag.types';

const tagSchema = new Schema<ITag>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
  name: { type: String, required: true, trim: true, maxlength: [50, 'Tag name cannot exceed 50 characters'], set: (v: string) => v ? v.toUpperCase() : v, get: (v: string) => v ? v.toUpperCase() : v },
  color: { type: String, trim: true, match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'], },
  description: { type: String, trim: true, maxlength: [200, 'Description cannot exceed 200 characters'], },
  usageCount: { type: Number, default: 0, },
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

tagSchema.index({ userId: 1, name: 1 }, { unique: true });
tagSchema.index({ userId: 1, usageCount: -1 });

export const Tag = mongoose.model<ITag>('Tag', tagSchema);
export default Tag;
