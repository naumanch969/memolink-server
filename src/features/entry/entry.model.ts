import mongoose, { Schema, Document } from 'mongoose';

export interface IEntry extends Document {
  content: string;
  timestamp: Date;
  mood?: string;
  weather?: string;
  location?: string;
  people: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  mentions: Array<{
    id: string;
    personId: string;
    personName: string;
    startIndex: number;
    endIndex: number;
  }>;
  tags: string[];
  media: Array<{
    id: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    thumbnail?: string;
    publicId: string;
    filename: string;
    mimeType: string;
    size: number;
    duration?: number;
    width?: number;
    height?: number;
    metadata?: Record<string, any>;
  }>;
  reactions: Array<{
    id: string;
    userId: string;
    type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'custom';
    customEmoji?: string;
    createdAt: Date;
  }>;
  isPrivate: boolean;
  isPinned: boolean;
  parentEntryId?: string;
  replyCount: number;
  viewCount: number;
}

const EntrySchema: Schema = new Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  mood: {
    type: String,
    trim: true,
    maxlength: 50,
    index: true,
  },
  weather: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true,
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200,
    index: true,
  },
  people: [{
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
  }],
  mentions: [{
    id: {
      type: String,
      required: true,
    },
    personId: {
      type: String,
      required: true,
    },
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    startIndex: {
      type: Number,
      required: true,
    },
    endIndex: {
      type: Number,
      required: true,
    },
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: 50,
    index: true,
  }],
  media: [{
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'audio'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
    publicId: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  }],
  reactions: [{
    id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry', 'custom'],
      required: true,
    },
    customEmoji: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  isPrivate: {
    type: Boolean,
    default: false,
    index: true,
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true,
  },
  parentEntryId: {
    type: Schema.Types.ObjectId,
    ref: 'Entry',
    index: true,
  },
  replyCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

// Create indexes for better search performance
EntrySchema.index({ content: 'text', tags: 'text', 'people.name': 'text' });
EntrySchema.index({ timestamp: -1 });
EntrySchema.index({ createdAt: -1 });
EntrySchema.index({ isPinned: -1, timestamp: -1 });
EntrySchema.index({ 'people.id': 1 });
EntrySchema.index({ 'mentions.personId': 1 });
EntrySchema.index({ parentEntryId: 1 });
EntrySchema.index({ isPrivate: 1, timestamp: -1 });

// Virtual for reaction counts
EntrySchema.virtual('reactionCounts').get(function(this: any) {
  const counts: Record<string, number> = {};
  const reactions = this.reactions as any[];
  if (reactions && Array.isArray(reactions)) {
    reactions.forEach((reaction: any) => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
    });
  }
  return counts;
});

// Virtual for media counts by type
EntrySchema.virtual('mediaCounts').get(function(this: any) {
  const counts: Record<string, number> = {};
  const media = this.media as any[];
  if (media && Array.isArray(media)) {
    media.forEach((item: any) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
  }
  return counts;
});

// Ensure virtuals are serialized
EntrySchema.set('toJSON', { virtuals: true });
EntrySchema.set('toObject', { virtuals: true });

export default mongoose.model<IEntry>('Entry', EntrySchema);
