import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';
import { STORAGE_LIMITS, USER_ROLES } from '../../shared/constants';
import { IUser } from './auth.interfaces';

// Interface for User model with static methods
interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<HydratedDocument<IUser> | null>;
  findActiveUsers(): Promise<HydratedDocument<IUser>[]>;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true, maxlength: [254, 'Email cannot exceed 254 characters'], match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'], },
  password: { type: String, minlength: [8, 'Password must be at least 8 characters long'], select: false, }, // Don't include password in queries by default
  googleId: { type: String, unique: true, sparse: true, select: false },
  name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: [100, 'Name cannot exceed 100 characters'], },
  avatar: { type: String, default: null, },
  role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.USER, },
  isEmailVerified: { type: Boolean, default: false, },
  isActive: { type: Boolean, default: false, },
  lastLoginAt: { type: Date, default: null, },
  lastLogoutAt: { type: Date, default: null, },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto', 'system'], default: 'system', },
    notifications: { type: Boolean, default: true, },
    privacy: { type: String, enum: ['public', 'private'], default: 'private', },
    webActivityTrackingEnabled: { type: Boolean, default: true },
    webActivityAutoClassification: { type: Boolean, default: true },
    accentColor: { type: String, enum: ['zinc', 'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet'], default: 'violet' },
    communication: {
      newsletter: { type: Boolean, default: true },
      productUpdates: { type: Boolean, default: true },
      security: { type: Boolean, default: true }, // Should mostly remain true/enforced by logic, but good to have preference stored
    },
  },
  securityConfig: {
    question: { type: String, trim: true },
    answerHash: { type: String, select: false }, // Don't return hash by default
    timeoutMinutes: { type: Number, default: 5 },
    isEnabled: { type: Boolean, default: false },
    maskEntries: { type: Boolean, default: false },
  },
  // Storage quota
  storageUsed: { type: Number, default: 0 },
  storageQuota: { type: Number, default: STORAGE_LIMITS.FREE_QUOTA },

  // Mobile Push Notifications
  pushTokens: [{
    token: { type: String, required: true },
    platform: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
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
    isActive: this.isActive,
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
