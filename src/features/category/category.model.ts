import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  displayName: string;
  color?: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  parentCategoryId?: string;
  sortOrder: number;
  usageCount: number;
}

const CategorySchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
    maxlength: 100,
    index: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  color: {
    type: String,
    trim: true,
    maxlength: 7, // Hex color code
    default: '#3B82F6',
  },
  icon: {
    type: String,
    trim: true,
    maxlength: 50,
    default: '📝',
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  parentCategoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    index: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
    index: true,
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0,
    index: true,
  },
}, {
  timestamps: true,
});

// Create indexes for better search performance
CategorySchema.index({ name: 'text', displayName: 'text', description: 'text' });
CategorySchema.index({ isActive: 1, sortOrder: 1 });
CategorySchema.index({ parentCategoryId: 1, sortOrder: 1 });
CategorySchema.index({ usageCount: -1 });

// Virtual for subcategories
CategorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategoryId',
});

// Virtual for full path
CategorySchema.virtual('fullPath').get(function(this: any) {
  if (this.parentCategoryId) {
    return `${this.parentCategoryId}/${this.name}`;
  }
  return this.name;
});

// Ensure virtuals are serialized
CategorySchema.set('toJSON', { virtuals: true });
CategorySchema.set('toObject', { virtuals: true });

export default mongoose.model<ICategory>('Category', CategorySchema);
