import mongoose, { Schema, Document } from 'mongoose';

export interface IPerson extends Document {
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  birthday?: Date;
  lastContact?: Date;
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rarely';
}

const PersonSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  avatar: {
    type: String,
    maxlength: 500,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100,
    index: true,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
  },
  relationship: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50,
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  birthday: {
    type: Date,
    index: true,
  },
  lastContact: {
    type: Date,
    index: true,
  },
  contactFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rarely'],
    default: 'monthly',
  },
}, {
  timestamps: true,
});

// Create indexes for better search performance
PersonSchema.index({ name: 'text', tags: 'text', notes: 'text' });
PersonSchema.index({ isActive: 1, name: 1 });
PersonSchema.index({ relationship: 1, name: 1 });
PersonSchema.index({ birthday: 1 });
PersonSchema.index({ lastContact: 1 });

// Virtual for age calculation
PersonSchema.virtual('age').get(function(this: any) {
  if (this.birthday) {
    const today = new Date();
    const birthDate = new Date(this.birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
  return null;
});

// Virtual for days since last contact
PersonSchema.virtual('daysSinceLastContact').get(function(this: any) {
  if (this.lastContact) {
    const today = new Date();
    const lastContact = new Date(this.lastContact);
    const diffTime = Math.abs(today.getTime() - lastContact.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Ensure virtuals are serialized
PersonSchema.set('toJSON', { virtuals: true });
PersonSchema.set('toObject', { virtuals: true });

export default mongoose.model<IPerson>('Person', PersonSchema);
