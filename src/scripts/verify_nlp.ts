
import { LLMService } from '../core/llm/LLMService';
import { AgentIntentType } from '../features/agent/agent.intent';
import { agentMemory } from '../features/agent/agent.memory';
import { agentService } from '../features/agent/agent.service';

// Mock DB and Redis if we can't connect, but for now assuming we run this as a "manual integration test"
// Ideally we mock the LLMService to avoid cost/latency and purely test the logic.

async function mockLLM() {
    // Override LLMService with a mock
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    LLMService.generateJSON = async (prompt, _schema) => {
        console.log("MOCK LLM called with prompt length:", prompt.length);

        // Return a mock based on the prompt content roughly
        return {
            intent: AgentIntentType.JOURNALING,
            confidence: 0.9,
            extractedEntities: {
                date: 'tomorrow'
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    };
}

async function runTest() {
    console.log("Starting NLP Flow Test...");

    // 1. Mock External Services
    await mockLLM();

    // Mock Mongoose Create (since we might not have a running DB connected in this script execution context 
    // without full server boot). 
    // If we want to test REAL flow, we need to connect to DB. 
    // Let's mock create to avoid Side Effects and DB connection errors if .env is missing.
    const mockTask = { _id: "task-123", type: "BRAIN_DUMP", status: "PENDING" };

    agentService.createTask = async (_userId, type, payload) => {
        console.log(`[Mock] createTask called: ${type}`, payload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return mockTask as any;
    };

    agentMemory.getHistory = async () => [];

    agentMemory.addMessage = async (_uid, role, content) => {
        console.log(`[Mock] Memory Add: ${role} -> ${content}`);
    }

    // 2. Execute Flow
    const userId = "test-user-1";
    const userText = "I felt great today, remind me to do it again tomorrow.";

    console.log(`\nProcessing input: "${userText}"`);
    const result = await agentService.processNaturalLanguage(userId, userText);

    console.log("\nResult Task:", result);

    // 3. Verify
    if (result._id === "task-123") {
        console.log("SUCCESS: Task created via NLP flow.");
    } else {
        console.log("FAILURE: Task not returned.");
    }
}

runTest().catch(console.error);
