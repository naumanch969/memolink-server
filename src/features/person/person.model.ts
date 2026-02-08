import mongoose, { Schema } from 'mongoose';

const personSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
  name: { type: String, required: true, trim: true, maxlength: [100, 'Name cannot exceed 100 characters'], },
  email: { type: String, trim: true, lowercase: true, },
  phone: { type: String, trim: true, },
  avatar: { type: String, },

  // Professional Details
  jobTitle: { type: String, trim: true, maxlength: [100, 'Job title cannot exceed 100 characters'], },
  role: { type: String, trim: true },
  company: { type: String, trim: true, maxlength: [100, 'Company cannot exceed 100 characters'], },

  // Important Dates
  birthday: { type: Date, },

  // Address
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },

  // Social & Web
  socialLinks: {
    linkedin: { type: String, trim: true },
    twitter: { type: String, trim: true },
    website: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
  },

  // Organization
  tags: [{ type: String, trim: true }],

  notes: { type: String, trim: true, maxlength: [5000, 'Notes cannot exceed 5000 characters'], },
  isPlaceholder: { type: Boolean, default: false, },
  interactionCount: { type: Number, default: 0, },
  lastInteractionAt: { type: Date, },
  lastInteractionSummary: { type: String },
  sentimentScore: { type: Number, default: 0 },

  // Soft Delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
}, { timestamps: true, });

personSchema.index({ userId: 1, name: 1 });
personSchema.index({ userId: 1, interactionCount: -1 });
personSchema.index({ userId: 1, isDeleted: 1 }); // Index for soft delete queries

export const Person = mongoose.model('Person', personSchema);
export default Person;
