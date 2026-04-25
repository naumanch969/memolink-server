import mongoose from 'mongoose';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { Media } from '../features/media/media.model';
import { config } from '../config/env';
import { logger } from '../config/logger';

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
});

async function syncStorage() {
    console.log('🔄 Starting Storage Mirror Sync (Cloudinary -> R2)...');
    
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fetch all media records
    const mediaItems = await Media.find({}).lean();
    console.log(`📊 Found ${mediaItems.length} media records to check.`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of mediaItems) {
        if (!item.cloudinaryId || !item.url) continue;

        // Use the cloudinaryId as the key in R2 to maintain structure
        // We add the extension if it's missing to make the R2 bucket readable
        const extension = item.extension ? (item.extension.startsWith('.') ? item.extension : `.${item.extension}`) : '';
        const r2Key = `${item.cloudinaryId}${extension}`;

        try {
            // 1. Check if file already exists in R2
            try {
                await s3Client.send(new HeadObjectCommand({
                    Bucket: config.R2_BUCKET_NAME,
                    Key: r2Key
                }));
                skipped++;
                continue; // File exists, skip
            } catch (headError: any) {
                if (headError.name !== 'NotFound') {
                    throw headError;
                }
            }

            // 2. File missing in R2, download from Cloudinary
            console.log(`📦 Syncing: ${item.cloudinaryId}...`);
            const response = await axios.get(item.url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);

            // 3. Upload to R2
            await s3Client.send(new PutObjectCommand({
                Bucket: config.R2_BUCKET_NAME,
                Key: r2Key,
                Body: buffer,
                ContentType: item.mimeType,
                Metadata: {
                    mediaId: item._id.toString(),
                    originalName: item.originalName,
                    userId: item.userId.toString()
                }
            }));

            synced++;
        } catch (error: any) {
            failed++;
            console.error(`❌ Failed to sync ${item.cloudinaryId}:`, error.message);
        }
    }

    console.log('\n✨ Sync Completed ✨');
    console.log(`✅ Synced: ${synced}`);
    console.log(`⏩ Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);

    await mongoose.disconnect();
}

syncStorage().catch(err => {
    console.error('Fatal error during sync:', err);
    process.exit(1);
});
