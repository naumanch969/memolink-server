const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs');

const MONGO_URI = process.env.MONGODB_PROD_URI || 'mongodb+srv://naumanch969:memolink@main.ft8wemw.mongodb.net/production';

const mediaSchema = new mongoose.Schema({
  cloudinaryId: String,
  type: String,
  extension: String,
  storageType: { type: String, default: 'public' }
}, { timestamps: true });

const Media = mongoose.models.Media || mongoose.model('Media', mediaSchema);

async function run() {
  console.log('🔄 Fetching metadata for Cloudinary CSV V2 (Smart Type Detection)...');
  
  await mongoose.connect(MONGO_URI);
  
  const orphaned = await Media.find({
    cloudinaryId: { $regex: /^memolink\// }
  }).lean();

  // STRICT Header: public_id, format, resource_type, type
  let csv = 'public_id,format,resource_type,type\n';
  
  for (const item of orphaned) {
    const resourceType = item.type === 'video' ? 'video' : 'image';
    let format = (item.extension || '').replace('.', '').toLowerCase();
    
    // Mapping our storageType to Cloudinary's delivery type
    // our 'public' maps to Cloudinary 'upload'
    // our 'authenticated' maps to Cloudinary 'authenticated'
    const cloudinaryType = item.storageType === 'authenticated' ? 'authenticated' : 'upload';
    
    // Fallback logic for format
    if (!format) {
        if (item.type === 'video') format = 'mp4';
        else format = 'jpg';
    }
    
    // STRICT Order: public_id, format, resource_type, type
    csv += `${item.cloudinaryId},${format},${resourceType},${cloudinaryType}\n`;
  }

  fs.writeFileSync('cloudinary_recovery_v2.csv', csv);
  console.log(`✅ Success! Generated cloudinary_recovery_v2.csv with ${orphaned.length} assets.`);
  console.log('Detection: Used database storageType to map "public"-> "upload" and "authenticated"-> "authenticated".');
  
  await mongoose.disconnect();
}

run().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
