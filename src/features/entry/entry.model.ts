import mongoose, { Schema } from 'mongoose';
import { ENTRY_TYPES } from '../../shared/constants';
import '../media/media.model';
import { IEntry } from './entry.types';

const entrySchema = new Schema<IEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], index: true, },
  content: {
    type: String, required: false, trim: true,
    maxlength: [10000000, 'Content cannot exceed 10000000 characters'],
    default: ''
  },
  type: { type: String, enum: Object.values(ENTRY_TYPES), default: ENTRY_TYPES.TEXT, },
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag', }],
  media: [{ type: Schema.Types.ObjectId, ref: 'Media', }],
  collectionId: { type: Schema.Types.ObjectId, ref: 'Collection' },
  title: { type: String, trim: true, maxlength: [200, 'Title cannot exceed 200 characters'], },
  isPrivate: { type: Boolean, default: false, },
  isPinned: { type: Boolean, default: false, index: true },
  isImportant: { type: Boolean, default: false, },
  isFavorite: { type: Boolean, default: false, },
  kind: { type: String, enum: ['entry', 'document', 'note'], default: 'entry' },
  location: { type: String, trim: true, maxlength: [200, 'Location cannot exceed 200 characters'], },
  date: { type: Date, default: Date.now, index: true, },
  startDate: { type: Date, index: true, },
  endDate: { type: Date, index: true, },
  startTime: { type: String, trim: true, },
  endTime: { type: String, trim: true, },
  isMultiDay: { type: Boolean, default: false, },
  isEdited: { type: Boolean, default: false, },
  inputMethod: { type: String, enum: ['text', 'voice', 'whatsapp', 'system'], default: 'text' },
  sessionId: { type: String, index: true },
  status: { type: String, enum: ['ready', 'processing', 'failed', 'capturing', 'completed', 'queued'], default: 'ready', index: true },
  signalTier: { type: String, enum: ['noise', 'log', 'signal', 'deep_signal'], index: true },
  metadata: { type: Object, default: {} },
}, {
  timestamps: true,
});

// Indexes
entrySchema.index({ userId: 1, createdAt: -1 });
entrySchema.index({ userId: 1, type: 1 });
entrySchema.index({ tags: 1 });
entrySchema.index({ media: 1 });
entrySchema.index({ collectionId: 1 });
entrySchema.index({ isPrivate: 1 });

// Text search index
entrySchema.index({ content: 'text', location: 'text' });

// Virtual for formatted content
entrySchema.virtual('formattedContent').get(function () {
  return this.content.replace(/\n/g, '<br>');
});

// Virtual for word count
entrySchema.virtual('wordCount').get(function () {
  return this.content.split(/\s+/).filter(word => word.length > 0).length;
});

// Pre-save middleware
entrySchema.pre('save', function (this: any, next) {
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
