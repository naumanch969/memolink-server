import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to DB');

    const db = mongoose.connection.db;
    const collections = await db!.listCollections().toArray();
    console.log('Collections:', collections.map((c: any) => c.name).filter((name: string) => name === 'lists' || name === 'widgets'));

    const listsCount = await db!.collection('lists').countDocuments();
    let widgetsCount = 0;
    if (collections.some((c: any) => c.name === 'widgets')) {
        widgetsCount = await db!.collection('widgets').countDocuments();
    }

    console.log(`Lists count: ${listsCount}`);
    console.log(`Widgets count: ${widgetsCount}`);

    if (widgetsCount > 0) {
        console.log('Migrating widgets to lists...');
        const widgets = await db!.collection('widgets').find({}).toArray();
        await db!.collection('lists').insertMany(widgets);
        console.log(`Migrated ${widgets.length} items from widgets to lists.`);
        await db!.collection('widgets').drop();
        console.log('Dropped widgets collection.');
    }

    // Update all lists to add isSystem flag
    await db!.collection('lists').updateMany(
        { isSystem: { $exists: false } },
        { $set: { isSystem: false } }
    );
    console.log('Set isSystem=false on existing lists');

    await mongoose.disconnect();
}

check().catch(console.error);
