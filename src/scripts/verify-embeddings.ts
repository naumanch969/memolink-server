import dotenv from 'dotenv';
import path from 'path';

// Load env before imports
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { logger } from '../config/logger';
import { GeminiProvider } from '../core/llm/providers/gemini.provider';

async function verify() {
    console.log('--- Gemini Embedding Verification ---');
    console.log('Model:', 'text-embedding-004');

    const provider = new GeminiProvider();
    const testText = 'Memolink is a behavioral intelligence platform.';

    try {
        console.log('Requesting embeddings for:', `"${testText}"`);
        const startTime = Date.now();
        const embeddings = await provider.generateEmbeddings(testText);
        const duration = Date.now() - startTime;

        console.log('Success!');
        console.log('Vector Size:', embeddings.length);
        console.log('Duration:', duration, 'ms');
        console.log('First 5 values:', embeddings.slice(0, 5));

        if (embeddings.length > 0) {
            process.exit(0);
        } else {
            console.error('Failure: Empty embedding returned');
            process.exit(1);
        }
    } catch (error) {
        console.error('Embedding verification FAILED:');
        console.error(error);
        process.exit(1);
    }
}

// Silence the logger for this script
(logger as any).info = () => { };
(logger as any).debug = () => { };

verify();
