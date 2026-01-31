import mongoose, { Schema } from 'mongoose';
import { IDocument } from './document.interfaces';

const documentSchema = new Schema<IDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, default: 'Untitled' },
    icon: { type: String }, // Emoji or URL
    coverImage: { type: String },
    content: { type: Schema.Types.Mixed, default: {} }, // JSON structure for Tiptap
    isFavorite: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    parentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null }, // Nested docs
    tags: [{ type: String }],
}, { timestamps: true });

documentSchema.index({ userId: 1, parentId: 1 });
documentSchema.index({ userId: 1, title: 'text' });

export const Document = mongoose.model<IDocument>('Document', documentSchema);
export default Document;
