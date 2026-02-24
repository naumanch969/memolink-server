import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function listModels() {
    console.log('Key:', process.env.GEMINI_API_KEY?.slice(0, 10), '...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;

    try {
        const response = await fetch(url);
        const data: any = await response.json();

        if (data.models) {
            console.log('Available Models:');
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log('No models found in response:', data);
        }
    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

listModels();
