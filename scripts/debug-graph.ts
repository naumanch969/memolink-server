import mongoose from 'mongoose';
import { GraphEdge } from '../src/features/graph/edge.model';
import { redisConnection } from '../src/config/redis';

async function debug() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect('mongodb://localhost:27017/memolink');
        console.log('DB Connected.');

        const edges = await GraphEdge.find();
        console.log('GRAPH_EDGES_COUNT:', edges.length);
        if (edges.length > 0) {
            console.log('FIRST_EDGE:', JSON.stringify(edges[0], null, 2));
        }

        console.log('Checking Redis Stream...');
        const streamInfo = await redisConnection.xrange('memolink:events:v1', '-', '+', 'COUNT', 5);
        console.log('REDIS_STREAM_SAMPLE_SIZE:', streamInfo.length);
        if (streamInfo.length > 0) {
            console.log('FIRST_STREAM_EVENT:', streamInfo[0]);
        }
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
}
debug();
