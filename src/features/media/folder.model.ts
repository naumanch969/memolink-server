import mongoose, { Schema } from 'mongoose';
import { IFolder } from './folder.interfaces';

const folderSchema = new Schema<IFolder>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3B82F6' }, // Default blue
  icon: { type: String, default: 'folder' },
  parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null }, // For nested folders
  path: { type: String, default: '/' }, // Full path like /folder1/subfolder1
  isDefault: { type: Boolean, default: false }, // For system folders like "All Media", "Recent"
  itemCount: { type: Number, default: 0 }, // Count of media items
}, { timestamps: true });

// Indexes for performance
folderSchema.index({ userId: 1, parentId: 1 });
folderSchema.index({ userId: 1, name: 1 });
folderSchema.index({ userId: 1, isDefault: 1 });

// Update itemCount when media is added/removed
folderSchema.methods.updateItemCount = async function() {
  const Media = mongoose.model('Media');
  const count = await Media.countDocuments({ folderId: this._id });
  this.itemCount = count;
  await this.save();
};

export const Folder = mongoose.model<IFolder>('Folder', folderSchema);
export default Folder;
