import path from 'path';
import dotenv from 'dotenv'
import mongoose from 'mongoose';
import fs from 'fs';
import { Media } from '../features/media/media.model';

dotenv.config();
const RESULTS_CSV = path.join(__dirname, '../../20260425T085302-980efd05c5.csv');
const REPORT_PATH = path.join(__dirname, '../../PRODUCTION_DAMAGE_REPORT.md');

async function run() {
    console.log('📝 Generating Master Damage Report...');

    const MONGO_URI = process.env.MONGODB_PROD_URI || 'mongodb+srv://naumanch969:memolink@main.ft8wemw.mongodb.net/production';
    await mongoose.connect(MONGO_URI);

    const content = fs.readFileSync(RESULTS_CSV, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('public_id'));

    const resultsMap = new Map();
    for (const line of lines) {
        const [publicId, format, resourceType, type, result, info] = line.split(',');
        resultsMap.set(publicId, { result, info, format, resourceType });
    }

    const allMedia = await Media.find({
        cloudinaryId: { $regex: /^memolink\// }
    }).lean();

    let md = '# 🚨 Production Media Damage Report\n\n';
    md += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    
    const restored = [];
    const pendingV3 = [];
    const lost = [];

    for (const media of allMedia) {
        const res = resultsMap.get(media.cloudinaryId);
        const item = {
            name: media.originalName || 'Unnamed Asset',
            id: media.cloudinaryId,
            type: media.type,
            date: media.createdAt ? new Date(media.createdAt).toLocaleDateString() : 'N/A',
            summary: media.metadata?.summary || media.metadata?.ocrText?.substring(0, 50) || 'No preview text',
            error: res?.info || ''
        };

        if (res?.result === 'succeeded') {
            restored.push(item);
        } else if (res?.result === 'failed' && (res.info.includes('not supported') || res.info.includes('jpeg'))) {
            pendingV3.push(item);
        } else {
            lost.push(item);
        }
    }

    md += `## 📊 Executive Summary\n`;
    md += `- **Total Affected Assets**: ${allMedia.length}\n`;
    md += `- **✅ Fully Restored**: ${restored.length}\n`;
    md += `- **⏳ Pending (V3 Correction)**: ${pendingV3.length}\n`;
    md += `- **❌ Permanently Lost**: ${lost.length}\n\n`;

    md += `## ✅ Fully Restored (29 Assets)\n`;
    md += `| Asset Name | Type | Date | Summary / Context |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    restored.forEach(i => {
        md += `| ${i.name} | ${i.type} | ${i.date} | ${i.summary} |\n`;
    });
    md += `\n`;

    md += `## ⏳ Pending V3 Recovery (11 Assets)\n`;
    md += `> These assets are currently being resubmitted to Cloudinary with corrected "raw" formats.\n\n`;
    md += `| Asset Name | Type | Date | Potential Loss Context |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    pendingV3.forEach(i => {
        md += `| ${i.name} | ${i.type} | ${i.date} | ${i.summary} |\n`;
    });
    md += `\n`;

    md += `## ❌ Permanently Lost (22 Assets)\n`;
    md += `> Cloudinary was unable to recover these from Disaster Recovery. These are likely purged blocks.\n\n`;
    md += `| Asset Name | Type | Date | Loss Impact (Summary) |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    lost.forEach(i => {
        md += `| ${i.name} | ${i.type} | ${i.date} | ${i.summary} |\n`;
    });
    md += `\n`;

    fs.writeFileSync(REPORT_PATH, md);
    console.log(`✅ Damage report generated at: ${REPORT_PATH}`);

    await mongoose.disconnect();
}

run().catch(console.error);
