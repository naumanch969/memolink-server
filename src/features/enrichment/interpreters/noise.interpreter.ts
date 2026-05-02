import { llmService } from '../../../core/llm/llm.service';

export class NoiseInterpreter {

    // Minimal path: just generate embeddings for global searchability.
    async process(content: string): Promise<{ embedding: number[] }> {
        const embedding = await llmService.generateEmbeddings(content);
        return { embedding };
    }
}

export const noiseInterpreter = new NoiseInterpreter();
