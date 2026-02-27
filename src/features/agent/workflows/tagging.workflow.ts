import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { Entry } from '../../entry/entry.model';
import { MOOD_METADATA } from '../../entry/mood.config';
import { TagService } from '../../tag/tag.service';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';

// Output Schema
const TaggingOutputSchema = z.object({
    suggestedTags: z.array(z.string()).describe("A list of 1-5 relevant tags for the content. Prefer existing tags over new ones if they match conceptually."),
    sentiment: z.string().describe("The emotional tone of the entry (e.g., Happy, Anxious, Neutral)."),
    category: z.enum(['excellent', 'good', 'neutral', 'calm', 'focus', 'stressed', 'sad', 'angry']).optional(),
});

export type TaggingOutput = z.infer<typeof TaggingOutputSchema>;

export class TaggingWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.TAGGING;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId, inputData } = task;
        const { entryId, content } = (inputData as any) || {};

        if (!entryId || !content) {
            return { status: 'failed', error: 'Entry ID and content are required' };
        }

        try {
            logger.info(`Running Auto-Tagging for entry ${entryId}`);

            // 1. Fetch User's Existing Tags
            const tagService = new TagService();
            const existingTagsResult = await tagService.getUserTags(userId, { limit: 50, sort: 'usageCount' });
            const existingTags = existingTagsResult.tags.map(t => t.name).join(', ');

            // 2. Prepare Prompt
            const prompt = `
            Analyze the following journal entry written by the user.
            
            Current Entry Content:
            "${content}"
    
            User's Existing Tags (Prefer these if relevant):
            [${existingTags}]
    
            Task:
            1. Identify 1-5 highly relevant topics or themes. 
               - If a topic matches an Existing Tag (fuzzy match), use the Existing Tag name exactly.
               - If it's a new concept, create a concise, 1-2 word tag (Capitalized).
            2. Determine the emotional tone/mood of the entry.
               - Provide a descriptive word (e.g. "Peaceful", "Ecstatic", "A bit overwhelmed").
               - Also categorize it into one of these standard buckets: excellent, good, neutral, calm, focus, stressed, sad, angry.
    
            Output strictly in JSON with the following keys:
            {
                "suggestedTags": ["tag1", "tag2"],
                "sentiment": "string",
                "category": "excellent | good | neutral | calm | focus | stressed | sad | angry"
            }
            `;

            // 3. Call LLM
            const result = await LLMService.generateJSON(prompt, TaggingOutputSchema, {
                temperature: 0.3,
                workflow: 'tagging',
                userId,
            });

            // 4. Post-Processing: Apply tags to the entry
            const entry = await Entry.findById(entryId);
            if (!entry) {
                return { status: 'failed', error: `Entry not found: ${entryId}` };
            }

            for (const tagName of result.suggestedTags) {
                const tag = await tagService.findOrCreateTag(userId, tagName);
                const isAlreadyTagged = entry.tags?.some(t => t.toString() === tag._id.toString());

                if (!isAlreadyTagged) {
                    entry.tags = entry.tags || [];
                    entry.tags.push(tag._id as any);
                    await tagService.incrementUsage(userId, [tag._id.toString()]);
                }
            }

            const updateData: any = { tags: entry.tags };

            if (!entry.mood && result.sentiment) {
                updateData.mood = result.sentiment;
            }

            if (!entry.moodMetadata && result.category) {
                updateData.moodMetadata = MOOD_METADATA[result.category as any];
            }

            // Using un-validated updateOne specifically because the document retrieved from .findById 
            // doesn't populate all required fields correctly (like strict 'userId' string vs ObjectId), 
            // throwing a ValidationError on .save()
            await Entry.updateOne({ _id: entryId }, { $set: updateData });
            logger.info(`Auto-tagged entry ${entryId} with: ${result.suggestedTags.join(', ')}`);

            return { status: 'completed', result };
        } catch (error: any) {
            logger.error(`Tagging workflow failed for entry ${entryId}`, error);
            return { status: 'failed', error: error.message };
        }
    }
}

export const taggingWorkflow = new TaggingWorkflow();
