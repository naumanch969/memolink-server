
import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import KnowledgeEntity from '../features/entity/entity.model';
import { EdgeStatus, EdgeType, GraphEdge, NodeType } from '../features/graph/edge.model';
import { graphService } from '../features/graph/graph.service';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink';

async function runTest() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Get a User
        const User = mongoose.model('User', new mongoose.Schema({ name: String, email: String }));
        const user = await User.findOne();

        if (!user) {
            console.error('No user found to test with.');
            process.exit(1);
        }
        const userId = user._id.toString();
        console.log(`Running test for user: ${user.name} (${userId})`);

        // 2. Create a specific Test Entity
        const testEntityName = "Protocol Omega";
        let entity = await KnowledgeEntity.findOne({ userId, name: testEntityName });

        if (!entity) {
            entity = await KnowledgeEntity.create({
                userId,
                name: testEntityName,
                otype: NodeType.ENTITY,
                rawMarkdown: "A secret test protocol for verifying system integrity."
            });
            console.log('Created Test Entity:', testEntityName);
        } else {
            console.log('Found existing Test Entity:', testEntityName);
        }

        // 3. Clean up any existing edges for this test to ensure clean state
        await GraphEdge.deleteMany({
            "from.id": new Types.ObjectId(userId),
            "to.id": entity._id
        });
        console.log('Cleaned up old test edges.');

        // 4. Create an Edge and REFUTE it immediately (Simulating past history)
        await GraphEdge.create({
            userId,
            from: { id: new Types.ObjectId(userId), type: NodeType.USER },
            to: { id: entity._id, type: NodeType.ENTITY },
            relation: EdgeType.AVOIDS,
            status: EdgeStatus.REFUTED,
            refutedAt: new Date(),
            weight: 1,
            metadata: { source: 'test-script-history' }
        });
        console.log('Step 1: Generated History - User previously REFUTED that they "AVOID" Protocol Omega.');

        // 5. Simulate AI re-extraction
        console.log('Step 2: Simulation - AI attempts to re-add "AVOIDS" edge...');

        const result = await graphService.createAssociation({
            fromId: userId,
            fromType: NodeType.USER,
            toId: entity._id.toString(),
            toType: NodeType.ENTITY,
            relation: EdgeType.AVOIDS,
            metadata: { source: 'new-ai-extraction', extractionConfidence: 0.95 }
        });

        // 6. Verify Result
        if (result.status === EdgeStatus.PROPOSED) {
            console.log('\n✅ SUCCESS! System detected the conflict.');
            console.log(`   Edge Status is: ${result.status} (Expected: proposed)`);
            console.log('   The AI did NOT overwrite your correction. Instead, it proposed a conflict.');
            console.log('\n👉 NOW: Go to your Frontend Graph View.');
            console.log(`   Look for "${testEntityName}".`);
            console.log('   You should see an ORANGE edge labeled "AVOIDS".');
            console.log('   Click it to Resolve (Accept/Reject).');
        } else {
            console.log('\nFAILED. Edge status is:', result.status);
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

runTest();
