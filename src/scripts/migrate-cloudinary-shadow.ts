import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { Media } from '../features/media/media.model';
import { User } from '../features/auth/auth.model';
import { cloudinaryService } from '../features/media/cloudinary/cloudinary.service';

dotenv.config();

/**
 * Shadow Migration Script
 * 1. Finds all legacy media (non-authenticated storage)
 * 2. Copies them to the new hierarchical authenticated storage
 * 3. Updates the DB records to point to new IDs
 */
async function migrateCloudinaryShadow() {
  try {
    console.log('🚀 Starting Shadow Migration of Cloudinary assets...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Find legacy media
    // Legacy media has storageType 'public' or it's missing (legacy data)
    const legacyMedia = await Media.find({
      storageType: { $ne: 'authenticated' }
    });

    console.log(`🔍 Found ${legacyMedia.length} legacy media items to migrate.`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const media of legacyMedia) {
      try {
        const userId = media.userId.toString();
        const user = await User.findById(userId);

        if (!user) {
          console.warn(`⚠️ User not found for media ${media._id}, skipping.`);
          skippedCount++;
          continue;
        }

        // New Path Factory
        const env = 'production';

        // Check if it's already in the new pattern but just missing the flag (unlikely)
        const isAlreadyNewPattern = media.cloudinaryId.startsWith(`brinn/${env}/users/`);
        if (isAlreadyNewPattern) {
          media.storageType = 'authenticated';
          await media.save();
          skippedCount++;
          continue;
        }

        const newId = cloudinaryService.getStoragePath(userId, 'timeline', {
          entryId: 'migrated',
          assetId: media._id.toString()
        });

        console.log(`📦 Migrating ${media._id}: ${media.cloudinaryId} (${media.type}) -> ${newId}`);

        // Shadow Copy
        let sourceUrl = media.url;
        try {
          const resourceType = media.type === 'video' ? 'video' : (media.type === 'document' || media.type === 'archive' ? 'raw' : 'image');
          const legacyType = (media.storageType === 'public' || !media.storageType) ? 'upload' : media.storageType;

          sourceUrl = cloudinaryService.getSignedUrl(media.cloudinaryId, {
            resource_type: resourceType,
            type: legacyType,
            expiresIn: 3600
          });
        } catch {
          console.warn(`⚠️ Signed URL generation failed for ${media.cloudinaryId}, using media.url`);
        }

        try {
          const result = await cloudinaryService.migrateFile(sourceUrl, newId);

          // Update DB
          const oldId = media.cloudinaryId;
          media.oldCloudinaryId = oldId;
          media.cloudinaryId = result.public_id;
          media.url = result.secure_url;
          media.storageType = 'authenticated';

          await media.save();

          successCount++;
          console.log(`✅ Successfully migrated ${media._id}`);
        } catch (copyErr: any) {
          // If the asset is missing in Cloudinary, we should mark its migration status
          const isNotFound = copyErr.http_code === 400 && (copyErr.message?.includes('404') || copyErr.message?.includes('401'));
          if (isNotFound) {
            console.warn(`⚠️ Asset not found in Cloudinary: ${media.cloudinaryId}. Marking as legacy_missing.`);
            media.storageType = 'authenticated'; // Mark it as "done" so we don't try again
            media.processingError = 'cloudinary_not_found';
            await media.save();
            skippedCount++;
          } else {
            throw copyErr;
          }
        }
      } catch (err) {
        failCount++;
        console.error(`❌ Failed to migrate media ${media._id}:`, err);
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Total Found: ${legacyMedia.length}`);
    console.log(`Success:     ${successCount}`);
    console.log(`Failed:      ${failCount}`);
    console.log(`Skipped:     ${skippedCount}`);
    console.log('-------------------------\n');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

migrateCloudinaryShadow();
