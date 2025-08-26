import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    privacyLevel: 'public' | 'friends' | 'private';
  };
  stats: {
    totalEntries: number;
    totalPeople: number;
    totalCategories: number;
    lastActive: Date;
    streakDays: number;
  };
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 100,
    index: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 100,
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  avatar: {
    type: String,
    maxlength: 500,
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
    },
    language: {
      type: String,
      default: 'en',
      maxlength: 10,
    },
    timezone: {
      type: String,
      default: 'UTC',
      maxlength: 50,
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
    privacyLevel: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'private',
    },
  },
  stats: {
    totalEntries: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPeople: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCategories: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    streakDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  lastLogin: {
    type: Date,
    index: true,
  },
}, {
  timestamps: true,
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create indexes for better search performance
UserSchema.index({ email: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ 'stats.lastActive': -1 });
UserSchema.index({ 'stats.streakDays': -1 });

// Virtual for display name
UserSchema.virtual('displayName').get(function(this: any) {
  return this.name || this.email.split('@')[0];
});

// Virtual for isOnline (active in last 5 minutes)
UserSchema.virtual('isOnline').get(function(this: any) {
  if (!this.stats?.lastActive) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.stats.lastActive > fiveMinutesAgo;
});

// Ensure virtuals are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

export default mongoose.model<IUser>('User', UserSchema);
