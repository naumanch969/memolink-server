
import { z } from 'zod';
import { LLMService } from '../../../core/llm/LLMService';
import Entry from '../../entry/entry.model';
import Person from '../../person/person.model';
import { AgentWorkflow } from '../agent.types';

const extractionSchema = z.object({
    names: z.array(z.string()).describe("List of people's names found in the text. Exclude famous public figures unless personally interacted with.")
});

export const runPeopleExtraction: AgentWorkflow = async (task) => {
    const { entryId, userId } = task.inputData;

    // 1. Fetch Entry
    const entry = await Entry.findById(entryId);
    if (!entry) throw new Error('Entry not found');
    if (!entry.content) return { status: 'completed', result: { names: [] } };

    // 2. TODO: Fetch Existing People (to help LLM context if needed, or simple direct extraction)
    // For now, we trust the LLM to extract names, and we resolve them against DB later.

    // 3. Call LLM
    const prompt = `
    Analyze the following journal entry and extract the names of people mentioned.
    
    Rules:
    1. Extract full names if available, or first names (e.g., "Sarah", "Dr. Smith").
    2. Ignore public figures, celebrities, or historical figures unless the text implies a personal interaction.
    3. Ignore generic terms like "mom", "dad", "my boss" unless a name is attached (e.g., "Mom (Linda)").
    4. Return a JSON object with a "names" key containing the array of strings. Example: { "names": ["John", "Sarah"] }

    Entry:
    "${entry.content}"
  `;

    const response = await LLMService.generateJSON(prompt, extractionSchema);
    const names = response.names || [];

    if (names.length === 0) {
        return { status: 'completed', result: { names: [] } };
    }

    // 4. Resolve Names to Person Entities
    const personIds: string[] = [];

    for (const name of names) {
        // Case-insensitive search
        let person = await Person.findOne({
            userId,
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            isDeleted: false
        });

        if (!person) {
            // Create new placeholder person
            person = await Person.create({
                userId,
                name: name, // Capitalize? The LLM usually returns nice easing.
                isPlaceholder: true,
                interactionCount: 1,
                lastInteractionAt: entry.date
            });
        } else {
            // Update interaction stats
            await Person.findByIdAndUpdate(person._id, {
                $inc: { interactionCount: 1 },
                $set: { lastInteractionAt: entry.date }
            });
        }

        personIds.push(person._id.toString());
    }

    // 5. Update Entry Mentions
    if (personIds.length > 0) {
        await Entry.findByIdAndUpdate(entryId, {
            $addToSet: { mentions: { $each: personIds } }
        });
    }

    return {
        status: 'completed',
        result: { names, count: names.length }
    };
};
