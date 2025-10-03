import mongoose, { Schema, Document } from 'mongoose';
import { IEntry } from '../../shared/types';
import { ENTRY_TYPES } from '../../shared/constants';

const entrySchema = new Schema<IEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], index: true, },
  content: { type: String, required: [true, 'Content is required'], trim: true, maxlength: [10000, 'Content cannot exceed 10000 characters'], },
  type: { type: String, enum: Object.values(ENTRY_TYPES), default: ENTRY_TYPES.TEXT, },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'Person', }],
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag', }],
  media: [{ type: Schema.Types.ObjectId, ref: 'Media', }],
  isPrivate: { type: Boolean, default: false, },
  mood: { type: String, trim: true, maxlength: [50, 'Mood cannot exceed 50 characters'], },
  location: { type: String, trim: true, maxlength: [200, 'Location cannot exceed 200 characters'], },
}, {
  timestamps: true,
});

// Indexes
entrySchema.index({ userId: 1, createdAt: -1 });
entrySchema.index({ userId: 1, type: 1 });
entrySchema.index({ mentions: 1 });
entrySchema.index({ tags: 1 });
entrySchema.index({ media: 1 });
entrySchema.index({ isPrivate: 1 });

// Text search index
entrySchema.index({ content: 'text', mood: 'text', location: 'text' });

// Virtual for formatted content
entrySchema.virtual('formattedContent').get(function () {
  return this.content.replace(/\n/g, '<br>');
});

// Virtual for word count
entrySchema.virtual('wordCount').get(function () {
  return this.content.split(/\s+/).filter(word => word.length > 0).length;
});

// Pre-save middleware
entrySchema.pre('save', function (next) {
  // Auto-detect entry type based on content
  if (this.media && this.media.length > 0) {
    this.type = this.content.trim() ? ENTRY_TYPES.MIXED : ENTRY_TYPES.MEDIA;
  } else {
    this.type = ENTRY_TYPES.TEXT;
  }
  next();
});

// Static methods
entrySchema.statics.findByUser = function (userId: string, options: any = {}) {
  const query = { userId, ...options };
  return this.find(query).sort({ createdAt: -1 });
};

entrySchema.statics.findByMention = function (personId: string) {
  return this.find({ mentions: personId }).sort({ createdAt: -1 });
};

entrySchema.statics.findByTag = function (tagId: string) {
  return this.find({ tags: tagId }).sort({ createdAt: -1 });
};

entrySchema.statics.searchEntries = function (userId: string, searchQuery: string) {
  return this.find({
    userId,
    $text: { $search: searchQuery },
  }).sort({ score: { $meta: 'textScore' } });
};

export const Entry = mongoose.model<IEntry>('Entry', entrySchema);
export default Entry;
