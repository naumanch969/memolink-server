import mongoose, { Schema, Model } from 'mongoose';
import { IUser } from '../../shared/types';
import { USER_ROLES } from '../../shared/constants';

// Interface for User model with static methods
interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findActiveUsers(): Promise<IUser[]>;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true, maxlength: [254, 'Email cannot exceed 254 characters'], match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'], },
  password: { type: String, required: [true, 'Password is required'], minlength: [8, 'Password must be at least 8 characters long'], select: false, }, // Don't include password in queries by default
  name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: [100, 'Name cannot exceed 100 characters'], },
  avatar: { type: String, default: null, },
  role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.USER, },
  isEmailVerified: { type: Boolean, default: false, },
  lastLoginAt: { type: Date, default: null, },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto', },
    notifications: { type: Boolean, default: true, },
    privacy: { type: String, enum: ['public', 'private'], default: 'private', },
  },
  securityConfig: {
    question: { type: String, trim: true },
    answerHash: { type: String, select: false }, // Don't return hash by default
    timeoutMinutes: { type: Number, default: 5 },
    isEnabled: { type: Boolean, default: false },
    maskEntries: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for user's full profile
userSchema.virtual('profile').get(function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    role: this.role,
    isEmailVerified: this.isEmailVerified,
    lastLoginAt: this.lastLoginAt,
    preferences: this.preferences,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
});

// Pre-save middleware
userSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Instance methods
userSchema.methods.updateLastLogin = function () {
  this.lastLoginAt = new Date();
  return this.save();
};

userSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  return this.save();
};

// Static methods
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findActiveUsers = function () {
  return this.find({ isEmailVerified: true });
};

// Add static methods to the interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
export default User;
