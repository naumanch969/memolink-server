import mongoose from 'mongoose';
import { GraphEdge } from '../src/features/graph/edge.model';
import { config } from '../src/config/env';

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink');
    const count = await GraphEdge.countDocuments();
    console.log('Total Graph Edges:', count);
    const edges = await GraphEdge.find().limit(5);
    console.log('Sample Edges:', JSON.stringify(edges, null, 2));
    process.exit(0);
}
check();
