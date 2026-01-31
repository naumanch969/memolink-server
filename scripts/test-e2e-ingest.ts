import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../src/config/env';
import { EventType } from '../src/core/events/types';
import { EdgeType, GraphEdge } from '../src/features/graph/edge.model';

// Standalone setup
const API_URL = `http://localhost:${config.PORT}/api`;
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

async function main() {
    console.log("🧪 Starting E2E Ingest Test...");

    // 1. Forge a Token
    const token = jwt.sign({ userId: TEST_USER_ID, email: 'test@example.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`🔑 Forged Test Token for User: ${TEST_USER_ID}`);

    // 2. Send Event via API
    console.log("📤 Sending Event to API...");
    const taskId = new mongoose.Types.ObjectId().toString();

    try {
        const response = await axios.post(`${API_URL}/events`, {
            events: [
                {
                    type: EventType.TASK_CREATED,
                    timestamp: Date.now(),
                    payload: {
                        taskId: taskId,
                        title: "E2E Test Task"
                    },
                    source: {
                        deviceId: 'e2e-script',
                        platform: 'server',
                        version: '1.0.0'
                    }
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 200) {
            console.log("✅ API Accepted Events");
        } else {
            console.error(`❌ API Error: ${response.status} ${JSON.stringify(response.data)}`);
            process.exit(1);
        }

    } catch (err: any) {
        console.error(`❌ Request Failed: ${err.message}`);
        if (err.response) console.error(err.response.data);
        process.exit(1);
    }

    // 3. Connect to DB to Verify Side Effect
    console.log("🕵️‍♀️ Waiting for Worker to Process (3s)...");
    await new Promise(r => setTimeout(r, 3000));

    try {
        await mongoose.connect(config.MONGODB_URI);

        const edge = await GraphEdge.findOne({
            "from.id": new mongoose.Types.ObjectId(TEST_USER_ID),
            "to.id": new mongoose.Types.ObjectId(taskId),
            relation: EdgeType.HAS_TASK
        });

        if (edge) {
            console.log("✅ Graph Edge FOUND in MongoDB!");
            console.log(JSON.stringify(edge.toJSON(), null, 2));
            console.log("🚀 E2E FLOW CONFIRMED: Client -> API -> Redis -> Worker -> Mongo");
        } else {
            console.error("❌ Graph Edge NOT FOUND. Worker failed or too slow.");
            // Print out all edges for this user to see if something else happened
            const allEdges = await GraphEdge.find({ "from.id": new mongoose.Types.ObjectId(TEST_USER_ID) });
            console.log("Debug: All Edges for User:", JSON.stringify(allEdges, null, 2));
            process.exit(1);
        }

    } catch (err) {
        console.error("❌ DB Check Failed", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
