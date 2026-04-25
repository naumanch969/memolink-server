import mongoose, { Schema } from 'mongoose';
import { IMedia } from './media.types';
import { MediaStatus } from './media.enums';
import cloudinaryService from './cloudinary/cloudinary.service';

const mediaSchema = new Schema<IMedia>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
  folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true }, // Folder organization
  filename: { type: String, required: true, },
  originalName: { type: String, required: true, },
  mimeType: { type: String, required: true, },
  size: { type: Number, required: true, },
  url: { type: String, required: true, },
  cloudinaryId: { type: String, required: true, },
  type: { type: String, enum: ['image', 'video', 'document', 'audio', 'archive', 'data', 'code'], required: true, },
  thumbnail: { type: String }, // Thumbnail URL for videos/images
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    pages: Number,              // For PDFs
    frameRate: Number,          // For videos
    bitrate: Number,            // For audio/video
    codec: String,              // Video/audio codec
    resolution: String,         // e.g., "1920x1080"
    // Archive metadata
    archiveContents: [{
      name: String,
      size: Number,
      isDirectory: Boolean,
    }],
    // Data file metadata
    rowCount: Number,           // For CSV
    columnCount: Number,        // For CSV
    // Code file metadata
    language: String,           // Detected language
    lineCount: Number,
    videoThumbnails: [String],  // Multiple thumbnail URLs
    selectedThumbnailIndex: { type: Number, default: 0 },
    // EXIF data
    exif: {
      make: String,
      model: String,
      dateTaken: Date,
      gps: {
        latitude: Number,
        longitude: Number,
        altitude: Number,
      },
      exposureTime: String,
      fNumber: Number,
      iso: Number,
      focalLength: String,
      lens: String,
      software: String,
      orientation: Number,
    },
    // OCR
    ocrText: String,
    ocrConfidence: Number,
    // AI tags
    aiTags: [{ tag: String, confidence: Number, }],
    // Face detection
    faces: [{
      entityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity' },
      boundingBox: { x: Number, y: Number, width: Number, height: Number, },
      confidence: Number,
    }],
  },
  tags: [{ type: String }], // For better organization
  extension: { type: String }, // File extension (e.g., 'pdf', 'zip', 'json')
  altText: { type: String },   // Accessibility description
  description: { type: String }, // User notes
  status: { type: String, enum: Object.values(MediaStatus), default: MediaStatus.READY },
  storageType: { type: String, enum: ['public', 'authenticated'], default: 'public' },
  oldCloudinaryId: { type: String },
  processingError: { type: String },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for signed URL
mediaSchema.virtual('signedUrl').get(function() {
  if (!this.cloudinaryId) return this.url;
  
  // If it's a public file, the standard URL is fine
  if (this.storageType === 'public') return this.url;

  // For authenticated files, we generate a signed URL
  // Note: Since this is a virtual, we use the service to sign it
  // This is fast as it's just a cryptographic string generation
  try {
    return cloudinaryService.getSignedUrl(this.cloudinaryId);
  } catch (error) {
    return this.url; // Fallback to raw URL
  }
});

mediaSchema.index({ userId: 1, type: 1 });
mediaSchema.index({ userId: 1, folderId: 1 });
mediaSchema.index({ userId: 1, createdAt: -1 });
mediaSchema.index({ userId: 1, extension: 1 }); // Index for filtering by extension

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
export default Media;
