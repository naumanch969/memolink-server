import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IWaitlist extends Document {
  email: string;
  status: 'pending' | 'verified' | 'converted';
  source: 'landing' | 'referral' | 'other';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IWaitlistModel extends Model<IWaitlist> {
  findByEmail(email: string): Promise<IWaitlist | null>;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'converted'],
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['landing', 'referral', 'other'],
      default: 'landing',
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
waitlistSchema.index({ email: 1 });
waitlistSchema.index({ createdAt: -1 });
waitlistSchema.index({ status: 1 });

// Static method to find by email
waitlistSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

export const Waitlist = mongoose.model<IWaitlist, IWaitlistModel>(
  'Waitlist',
  waitlistSchema
);
