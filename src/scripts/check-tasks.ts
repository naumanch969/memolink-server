import mongoose from 'mongoose';
import { config } from '../config/env';
import { AgentTask } from '../features/agent/agent.model';

async function checkTasks() {
    await mongoose.connect(config.MONGODB_URI);
    const count = await AgentTask.countDocuments({
        createdAt: { $gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    });
    console.log(`Tasks created in last 48h: ${count}`);

    const statusCounts = await AgentTask.aggregate([
        { $match: { createdAt: { $gt: new Date(Date.now() - 48 * 60 * 60 * 1000) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Status counts:', JSON.stringify(statusCounts, null, 2));

    const lastErrors = await AgentTask.find({
        status: 'FAILED',
        createdAt: { $gt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
    })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type error createdAt');

    console.log('Last 5 errors:', JSON.stringify(lastErrors, null, 2));

    await mongoose.disconnect();
}

checkTasks().catch(console.error);