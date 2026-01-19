
import { z } from 'zod';
import { LLMService } from '../../../core/llm/LLMService';
import Entry from '../../entry/entry.model';
import Person from '../../person/person.model';
import Relation from '../../person/relation.model';
import { AgentWorkflow } from '../agent.types';

const extractionSchema = z.object({
    people: z.array(z.object({
        name: z.string().describe("Full name of the person."),
        role: z.string().optional().describe("Contextual role inferred (e.g., 'Project Manager', 'Sister')."),
        sentiment: z.number().min(-1).max(1).describe("Sentiment: -1 to 1. 0 matches neutral.").optional().default(0),
        summary: z.string().optional().describe("Brief 1-sentence summary of the interaction with this person."),
        tags: z.array(z.string()).describe("Key attributes/facts.").optional().default([])
    })).describe("List of people mentioned in the entry."),
    relations: z.array(z.object({
        source: z.string(),
        target: z.string(),
        type: z.string().describe("Relationship type (e.g., 'Spouse', 'Colleague').")
    })).optional().describe("Relationships between people mentioned in the text.")
});

export const runPeopleExtraction: AgentWorkflow = async (task) => {
    const { entryId, userId } = task.inputData;

    // 1. Fetch Entry
    const entry = await Entry.findById(entryId);
    if (!entry) throw new Error('Entry not found');
    if (!entry.content) return { status: 'completed', result: { names: [] } };

    // 2. Call LLM
    const prompt = `
    Analyze the journal entry and extract "Chief of Staff" level intelligence about people and relationships.
    
    Rules:
    1. Extract people mentioned with their roles, sentiment of interaction, key facts (tags), and a brief summary of the interaction.
    2. Extract relationships between people (e.g., "Bob is Alice's husband").
    3. Ignore public figures unless personally interacted with.
    4. Normalize names where possible (e.g., "Mom (Linda)" -> "Linda").
    5. Sentiment should be a decimal from -1.0 (Hostile/Bad) to 1.0 (Excellent/Loving), 0 is Neutral.

    Entry:
    "${entry.content}"
  `;

    const response = await LLMService.generateJSON(prompt, extractionSchema);
    const peopleData = response.people || [];
    const relationsData = response.relations || [];

    if (peopleData.length === 0) {
        return { status: 'completed', result: { names: [] } };
    }

    const personIds: string[] = [];
    const nameToIdMap: Record<string, string> = {};

    // 3. Upsert People
    for (const p of peopleData) {
        // Case-insensitive find
        let person = await Person.findOne({
            userId,
            name: { $regex: new RegExp(`^${p.name}$`, 'i') },
            isDeleted: false
        });

        if (!person) {
            person = await Person.create({
                userId,
                name: p.name,
                role: p.role,
                isPlaceholder: true,
                interactionCount: 1,
                lastInteractionAt: entry.date,
                lastInteractionSummary: p.summary,
                sentimentScore: p.sentiment, // Initial score
                tags: p.tags
            });
        } else {
            // Logic to update sentiment (Rolling Average)
            const oldScore = person.sentimentScore || 0;
            const count = person.interactionCount || 0;
            // Weigh recent interaction slightly more? For now, simple average
            const newScore = ((oldScore * count) + p.sentiment) / (count + 1);

            await Person.findByIdAndUpdate(person._id, {
                $inc: { interactionCount: 1 },
                $set: {
                    lastInteractionAt: entry.date,
                    lastInteractionSummary: p.summary,
                    sentimentScore: newScore
                },
                $addToSet: { tags: { $each: p.tags } },
                // Only set role if it wasn't set, or overwrite? Let's keep existing role if set, unless new one is specific. 
                // Simple: if no role, set key.
                ...(person.role ? {} : { role: p.role })
            });
        }

        personIds.push(person._id.toString());
        nameToIdMap[p.name.toLowerCase()] = person._id.toString();
    }

    // 4. Upsert Relations
    for (const rel of relationsData) {
        const sourceId = nameToIdMap[rel.source.toLowerCase()];
        const targetId = nameToIdMap[rel.target.toLowerCase()];

        if (sourceId && targetId && sourceId !== targetId) {
            // Find existing link to avoid duplicates or update type
            await Relation.updateOne(
                { userId, sourceId, targetId },
                {
                    $set: { type: rel.type, strength: 5 }, // Default strength
                    $setOnInsert: { userId, sourceId, targetId }
                },
                { upsert: true }
            );
        }
    }

    // 5. Update Entry Mentions
    if (personIds.length > 0) {
        await Entry.findByIdAndUpdate(entryId, {
            $addToSet: { mentions: { $each: personIds } }
        });
    }

    return {
        status: 'completed',
        result: { names: peopleData.map(p => p.name), count: peopleData.length }
    };
};
