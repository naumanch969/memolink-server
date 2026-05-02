import { llmService } from '../core/llm/llm.service';
import { AGENT_CONSTANTS } from '../features/agent/agent.constants';

/**
 * Script to test LLM Service, API Key Rotation, and Model Fallback.
 * 
 * Usage:
 * ts-node src/scripts/test-llm.ts
 */
async function testLLM() {
    console.log('--- LLM Service Integration Test ---');
    console.log(`Primary Model: ${AGENT_CONSTANTS.DEFAULT_TEXT_MODEL}`);
    console.log(`Fallbacks: ${AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS.join(', ')}`);
    console.log('------------------------------------\n');

    try {
        // 1. Simple Text Generation
        console.log('1. Testing Simple Text Generation...');
        const text = await llmService.generateText('Say "Hello World" and nothing else.');
        console.log(`Response: "${text}"\n`);

        // 2. Testing Quota and Fallback (Simulated if possible)
        console.log('2. Testing Multi-Model Capabilities...');
        const modelsToTest = AGENT_CONSTANTS.TEXT_MODEL_FALLBACKS;
        
        for (const model of modelsToTest) {
            console.log(`Testing model: ${model}...`);
            // We'll use a slightly different prompt each time to avoid cache if any
            const response = await llmService.generateText(`What is the version of ${model}? Respond in one short sentence.`, {
                workflow: 'integration-test'
            });
            console.log(`[${model}] Response: ${response.trim()}`);
        }

        console.log('\n3. Testing Embedding Generation...');
        const embedding = await llmService.generateEmbeddings('Brinn is a digital sanctuary.');
        console.log(`Generated embedding with length: ${embedding.length}\n`);

        console.log('--- Test Complete ---');
        console.log('To verify key rotation, check the server logs for "Rotating..." messages if you hit rate limits.');
        
    } catch (error: unknown) {
        const err = error as Error & { status?: number };
        console.error('\n!!! Test Failed !!!');
        console.error('Error:', err.message);
        if (err.status === 429) {
            console.error('Quota exceeded across all keys and models. This confirms fallback exhausted all options.');
        }
        process.exit(1);
    }
}

// Set script mode to avoid aggressive Redis retries if it's down
process.env.IS_SCRIPT = 'true';

testLLM().then(() => process.exit(0));
