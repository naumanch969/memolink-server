import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  type: 'verification' | 'password_reset';
  expiresAt: Date;
  isUsed: boolean;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IOtpModel extends Model<IOtp> {
  generateOtp(email: string, type: 'verification' | 'password_reset'): Promise<string>;
  verifyOtp(email: string, otp: string, type: 'verification' | 'password_reset'): Promise<boolean>;
  cleanupExpiredOtps(): Promise<void>;
}

const otpSchema = new Schema<IOtp>({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    lowercase: true, 
    trim: true,
    index: true
  },
  otp: { 
    type: String, 
    required: [true, 'OTP is required'],
    length: 6
  },
  type: { 
    type: String, 
    enum: ['verification', 'password_reset'], 
    required: [true, 'OTP type is required'],
    index: true
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  isUsed: { 
    type: Boolean, 
    default: false,
    index: true
  },
  attempts: { 
    type: Number, 
    default: 0,
    max: 3
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
otpSchema.index({ email: 1, type: 1, isUsed: 1 });

// Static method to generate OTP
otpSchema.statics.generateOtp = async function(email: string, type: 'verification' | 'password_reset'): Promise<string> {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration time (10 minutes for verification, 1 hour for password reset)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + (type === 'verification' ? 10 : 60));
  
  // Remove any existing unused OTPs for this email and type
  await this.deleteMany({ 
    email: email.toLowerCase().trim(), 
    type, 
    isUsed: false 
  });
  
  // Create new OTP record
  await this.create({
    email: email.toLowerCase().trim(),
    otp,
    type,
    expiresAt
  });
  
  return otp;
};

// Static method to verify OTP
otpSchema.statics.verifyOtp = async function(email: string, otp: string, type: 'verification' | 'password_reset'): Promise<boolean> {
  const otpRecord = await this.findOne({
    email: email.toLowerCase().trim(),
    otp,
    type,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (!otpRecord) {
    // Increment attempts for any existing OTP record for this email and type
    await this.updateOne(
      { 
        email: email.toLowerCase().trim(), 
        type, 
        isUsed: false 
      },
      { $inc: { attempts: 1 } }
    );
    return false;
  }
  
  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();
  
  return true;
};

// Static method to cleanup expired OTPs
otpSchema.statics.cleanupExpiredOtps = async function(): Promise<void> {
  await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { attempts: { $gte: 3 } }
    ]
  });
};

export const Otp = mongoose.model<IOtp, IOtpModel>('Otp', otpSchema);
export default Otp;
