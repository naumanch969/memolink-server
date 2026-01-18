import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { Entry } from '../../entry/entry.model';
import { TagService } from '../../tag/tag.service';

// Input Validation Schema
export const EntryTaggingInputSchema = z.object({
    entryId: z.string(),
    content: z.string(),
});

export type EntryTaggingInput = z.infer<typeof EntryTaggingInputSchema>;

// Output Schema
const TaggingOutputSchema = z.object({
    suggestedTags: z.array(z.string()).describe("A list of 1-5 relevant tags for the content. Prefer existing tags over new ones if they match conceptually."),
    sentiment: z.string().describe("The emotional tone of the entry (e.g., Happy, Anxious, Neutral)."),
});

export type TaggingOutput = z.infer<typeof TaggingOutputSchema>;

export async function runEntryTagging(userId: string, input: EntryTaggingInput): Promise<TaggingOutput> {
    logger.info(`Running Auto-Tagging for entry ${input.entryId}`);

    // 1. Fetch User's Existing Tags (to influence the LLM to reuse them)
    // We fetch top 50 most used tags to give context
    const tagService = new TagService();
    const existingTagsResult = await tagService.getUserTags(userId, { limit: 50, sort: 'usageCount' });
    const existingTags = existingTagsResult.tags.map(t => t.name).join(', ');

    // 2. Prepare Prompt
    const prompt = `
    Analyze the following journal entry written by the user.
    
    Current Entry Content:
    "${input.content}"

    User's Existing Tags (Prefer these if relevant):
    [${existingTags}]

    Task:
    1. Identify 1-5 highly relevant topics or themes. 
       - If a topic matches an Existing Tag (fuzzy match), use the Existing Tag name exactly.
       - If it's a new concept, create a concise, 1-2 word tag (Capitalized).
    2. Determine the sentiment/mood of the entry.

    Output strictly in JSON with the following keys:
    {
        "suggestedTags": ["tag1", "tag2"],
        "sentiment": "string"
    }
    `;

    // 3. Call LLM
    const result = await LLMService.generateJSON(prompt, TaggingOutputSchema, {
        temperature: 0.3, // Low temp for consistency
    });

    // 4. Post-Processing: Apply tags to the entry
    // We don't just return the result; the agent actually does the work of updating the entry.

    // Find entry
    const entry = await Entry.findById(input.entryId);
    if (!entry) {
        throw new Error(`Entry not found: ${input.entryId}`);
    }

    // Process suggested tags
    for (const tagName of result.suggestedTags) {
        // Find or create the tag
        const tag = await tagService.findOrCreateTag(userId, tagName);

        // Add to entry if not already present
        // Convert both to string to compare
        const isAlreadyTagged = entry.tags?.some(t => t.toString() === tag._id.toString());

        if (!isAlreadyTagged) {
            entry.tags = entry.tags || [];
            entry.tags.push(tag._id);
            // Increment usage
            await tagService.incrementUsage(userId, [tag._id.toString()]);
        }
    }

    // Update Mood if not set manually
    if (!entry.mood) {
        entry.mood = result.sentiment;
    }

    await entry.save();
    logger.info(`Auto-tagged entry ${input.entryId} with: ${result.suggestedTags.join(', ')}`);

    return result;
}
