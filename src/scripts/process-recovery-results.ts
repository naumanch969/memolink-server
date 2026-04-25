import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import { Media } from '../features/media/media.model';
import { MediaStatus } from '../features/media/media.enums';

dotenv.config();
const RESULTS_CSV = path.join(__dirname, '../../20260425T085302-980efd05c5.csv');
const RECOVERY_V3_CSV = path.join(__dirname, '../../cloudinary_recovery_v3.csv');

async function run() {
    console.log('📊 Processing Cloudinary Recovery Results...');

    const MONGO_URI = process.env.MONGODB_PROD_URI || 'mongodb+srv://naumanch969:memolink@main.ft8wemw.mongodb.net/production';
    await mongoose.connect(MONGO_URI);

    const content = fs.readFileSync(RESULTS_CSV, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('public_id'));

    let succeededCount = 0;
    let failedDRCount = 0;
    let recoverableCount = 0;
    
    // Header for V3
    let v3Csv = 'public_id,format,resource_type,type\n';

    for (const line of lines) {
        const [publicId, format, resourceType, type, result, info] = line.split(',');

        if (result === 'succeeded') {
            // Update DB
            await Media.updateOne(
                { cloudinaryId: publicId },
                { $set: { status: MediaStatus.READY, processingError: null } }
            );
            succeededCount++;
        } else if (result === 'failed') {
            if (info && info.includes('not supported for resource type')) {
                // This is a format mismatch! We can fix this by using 'raw'
                v3Csv += `${publicId},${format},raw,${type}\n`;
                recoverableCount++;
            } else if (info && info.includes('Format jpeg is not supported')) {
                 // Fix jpeg to jpg or use raw? jpeg should be image. Maybe use jpg.
                 v3Csv += `${publicId},jpg,image,${type}\n`;
                 recoverableCount++;
            } else {
                failedDRCount++;
                // Mark as truly failed in DB if you want, but maybe wait for V3
                await Media.updateOne(
                    { cloudinaryId: publicId },
                    { $set: { status: MediaStatus.FAILED, processingError: 'Unable to recover from Cloudinary DR' } }
                );
            }
        }
    }

    if (recoverableCount > 0) {
        fs.writeFileSync(RECOVERY_V3_CSV, v3Csv);
        console.log(`📝 Generated cloudinary_recovery_v3.csv with ${recoverableCount} potentially recoverable assets (fixing raw/format issues).`);
    }

    console.log('\n--- Summary ---');
    console.log(`✅ Succeeded (Restored in DB): ${succeededCount}`);
    console.log(`🛠️  Recoverable in V3 (Format Fix): ${recoverableCount}`);
    console.log(`❌ Truly Lost (DR Failure): ${failedDRCount}`);
    console.log('----------------\n');

    await mongoose.disconnect();
}

run().catch(console.error);
