import mongoose, { Schema } from 'mongoose';
import { IMedia } from '../../shared/types';

const mediaSchema = new Schema<IMedia>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
  folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true }, // Folder organization
  filename: { type: String, required: true, },
  originalName: { type: String, required: true, },
  mimeType: { type: String, required: true, },
  size: { type: Number, required: true, },
  url: { type: String, required: true, },
  cloudinaryId: { type: String, required: true, },
  type: { type: String, enum: ['image', 'video', 'document', 'audio'], required: true, },
  thumbnail: { type: String }, // Thumbnail URL for videos/images
  metadata: { width: Number, height: Number, duration: Number, },
  tags: [{ type: String }], // For better organization
}, { timestamps: true, });

mediaSchema.index({ userId: 1, type: 1 });
mediaSchema.index({ userId: 1, folderId: 1 });
mediaSchema.index({ userId: 1, createdAt: -1 });

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
export default Media;
