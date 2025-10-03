import mongoose, { Schema } from 'mongoose';
import { IPerson } from '../../shared/types';

const personSchema = new Schema<IPerson>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
  name: { type: String, required: true, trim: true, maxlength: [100, 'Name cannot exceed 100 characters'], },
  email: { type: String, trim: true, lowercase: true, },
  phone: { type: String, trim: true, },
  avatar: { type: String, },
  notes: { type: String, trim: true, maxlength: [500, 'Notes cannot exceed 500 characters'], },
  isPlaceholder: { type: Boolean, default: false, },
  interactionCount: { type: Number, default: 0, },
  lastInteractionAt: { type: Date, },
}, { timestamps: true, });

personSchema.index({ userId: 1, name: 1 });
personSchema.index({ userId: 1, interactionCount: -1 });

export const Person = mongoose.model<IPerson>('Person', personSchema);
export default Person;
