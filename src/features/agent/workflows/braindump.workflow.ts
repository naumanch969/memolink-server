import { z } from 'zod';
import { LLMService } from '../../../core/llm/LLMService';
import { Entry } from '../../entry/entry.model';
import { AgentWorkflow } from '../agent.types';

const splitEntriesSchema = z.object({
    entries: z.array(z.object({
        title: z.string().describe("Brief title for this segment (e.g., 'Morning Coffee', 'Project Update')"),
        content: z.string().describe("The actual content/text of this entry segment"),
        tags: z.array(z.string()).optional().describe("Suggested tags for this entry"),
        mood: z.string().optional().describe("Detected mood if any (e.g., 'happy', 'stressed')")
    })).describe("Array of split entry segments extracted from the raw text")
});

export const runBrainDump: AgentWorkflow = async (task) => {
    const { text, date } = task.inputData;
    const userId = task.userId;

    if (!text) return { status: 'failed', error: 'No text provided' };

    const prompt = `You are an AI assistant helping to organize a user's brain dump into structured journal entries.

The user has provided the following unstructured text (possibly from voice-to-text):
"""
${text}
"""

Your task:
1. Split this text into logical, coherent journal entry segments
2. Each segment should be a complete thought or topic
3. Provide a brief title for each segment
4. Extract the main content
5. Suggest relevant tags (e.g., "work", "family", "health")
6. Detect the mood if evident (e.g., "happy", "stressed", "excited")

Guidelines:
- If the text is already a single coherent entry, return it as one segment
- If there are multiple topics, split them logically
- Preserve the original voice and tone
- Don't add information that isn't in the original text`;

    const response = await LLMService.generateJSON(prompt, splitEntriesSchema);

    const splitEntries = response.entries || [];
    const createdIds = [];
    const baseDate = date ? new Date(date) : new Date();

    for (const item of splitEntries) {
        const entry = await Entry.create({
            userId,
            content: item.content,
            type: 'text',
            tags: [], // Tags will be processed by auto-tagging agent
            mentions: [],
            media: [],
            isPrivate: false,
            mood: item.mood,
            date: baseDate,
            isEdited: false
        });

        createdIds.push(entry._id);
    }

    return {
        status: 'completed',
        result: { count: createdIds.length, entryIds: createdIds }
    };
};
