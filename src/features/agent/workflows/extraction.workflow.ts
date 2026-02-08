
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { KnowledgeEntity } from '../../entity/entity.model';
import { entityService } from '../../entity/entity.service';
import Entry from '../../entry/entry.model';
import { EdgeType, NodeType } from '../../graph/edge.model';
import { graphService } from '../../graph/graph.service';
import { AgentWorkflow } from '../agent.types';

const entitySchema = z.object({
    name: z.string().describe("Full name, title, or canonical name of the entity."),
    type: z.enum(['Person', 'Project', 'Organization', 'Topic', 'Emotion', 'Entity']).describe("The node type."),
    aliases: z.array(z.string()).optional().describe("Other names used to refer to this entity (e.g. 'The boss', 'Mom')."),
    role: z.string().optional().describe("Contextual role or nature of the entity."),
    sentiment: z.number().min(-1).max(1).describe("Sentiment: -1 to 1. 0 is neutral.").optional().default(0),
    summary: z.string().optional().describe("Brief 1-sentence summary of the interaction or context."),
    tags: z.array(z.string()).describe("Key attributes/facts.").optional().default([])
});

const extractionSchema = z.object({
    entities: z.array(entitySchema).describe("List of entities mentioned (Entity, Projects, Organizations, Topics, Emotions)."),
    relations: z.array(z.object({
        source: z.string().describe("Name of the source entity."),
        target: z.string().describe("Name of the target entity."),
        type: z.string().describe("Relationship type. MUST use: WORKS_AT, CONTRIBUTES_TO, MEMBER_OF, PART_OF, OWNED_BY, ASSOCIATED_WITH, BLOCKS, SUPPORTS, REQUIRES, INFLUENCES, TRIGGERS, KNOWS, INTERESTED_IN."),
        metadata: z.record(z.string(), z.any()).optional().describe("Additional context for the relationship.")
    })).optional().describe("Relationships BETWEEN entities mentioned in the text.")
});

export const runEntityExtraction: AgentWorkflow = async (task) => {
    const { entryId, userId } = task.inputData;

    // 1. Fetch Entry
    const entry = await Entry.findById(entryId);
    if (!entry) throw new Error('Entry not found');
    if (!entry.content) return { status: 'completed', result: { names: [] } };

    // 2. Fetch Existing Entity Names for Disambiguation (TAO Prompting)
    const entityRegistry = await entityService.getEntityRegistry(userId);
    const knownNames = Object.keys(entityRegistry);

    // 3. Call LLM
    const prompt = `
    Analyze the journal entry and extract "Chief of Staff" level intelligence about entities and their relationships.
    
    Entities:
    - Person: Individuals.
    - Project: Initiatives, apps, specific efforts.
    - Organization: Companies, schools, groups.
    - Topic: Abstract concepts (e.g., "AI", "Climate Change").
    - Emotion: Strong emotional states mentioned as objects of discussion.
    - Entity: Anything else important.

    KNOWN ENTITIES for this user:
    ${knownNames.join(', ')}

    Rules:
    1. If an entity matches or is an alias for a KNOWN ENTITY, use the EXACT name from the list above.
    2. Extract relationships BETWEEN them. Use semantic labels in metadata if the relationship is unique.
    3. Sentiment: -1.0 (Bad) to 1.0 (Excellent), 0 is Neutral.
    4. Relationship types MUST follow MUST use: WORKS_AT, CONTRIBUTES_TO, MEMBER_OF, PART_OF, OWNED_BY, ASSOCIATED_WITH, BLOCKS, SUPPORTS, REQUIRES, INFLUENCES, TRIGGERS, KNOWS, INTERESTED_IN.

    Entry:
    "${entry.content}"
  `;

    const response = await LLMService.generateJSON(prompt, extractionSchema);
    const entitiesData = response.entities || [];
    const relationsData = response.relations || [];

    if (entitiesData.length === 0) {
        return { status: 'completed', result: { names: [] } };
    }

    const entityIds: string[] = [];
    const nameToIdMap: Record<string, { id: string, type: NodeType }> = {};

    // 4. Upsert Entities
    for (const e of entitiesData) {
        const otype = e.type as NodeType;

        // Find or Create (Try name first, then aliases if we have a registry hit)
        let entity = await KnowledgeEntity.findOne({
            userId,
            $or: [
                { name: { $regex: new RegExp(`^${e.name.trim()}$`, 'i') } },
                { aliases: { $in: [e.name.trim()] } }
            ],
            isDeleted: false
        });

        if (!entity) {
            entity = await entityService.createEntity(userId, {
                name: e.name,
                otype,
                aliases: e.aliases,
                summary: e.summary,
                tags: e.tags,
                jobTitle: otype === NodeType.PERSON ? e.role : undefined
            }) as any;
        } else {
            const oldScore = entity.sentimentScore || 0;
            const count = entity.interactionCount || 0;
            const newScore = ((oldScore * count) + (e.sentiment || 0)) / (count + 1);

            // Add new aliases if found
            const newAliases = Array.from(new Set([...(entity.aliases || []), ...(e.aliases || [])]));

            await entityService.updateEntity(entity._id.toString(), userId, {
                lastInteractionAt: entry.date,
                lastInteractionSummary: e.summary,
                sentimentScore: newScore,
                interactionCount: count + 1,
                aliases: newAliases,
                tags: Array.from(new Set([...(entity.tags || []), ...(e.tags || [])]))
            });
        }

        entityIds.push(entity!._id.toString());
        nameToIdMap[e.name.toLowerCase()] = { id: entity!._id.toString(), type: otype };
        // Map aliases to same ID for relation mapping
        (e.aliases || []).forEach(alias => {
            nameToIdMap[alias.toLowerCase()] = { id: entity!._id.toString(), type: otype };
        });

        // 5. Create "MENTIONED_IN" Edge (Entity -> Entry)
        await graphService.createAssociation({
            fromId: entity!._id.toString(),
            fromType: otype,
            toId: entryId,
            toType: NodeType.CONTEXT,
            relation: EdgeType.MENTIONED_IN,
            metadata: { entryDate: entry.date, name: e.name, isExtraction: true }
        });

        // 6. Create Ego-Edge (User -> Entity)
        const egoRelation = otype === NodeType.PERSON ? EdgeType.KNOWS : EdgeType.INTERESTED_IN;
        await graphService.createAssociation({
            fromId: userId,
            fromType: NodeType.USER,
            toId: entity!._id.toString(),
            toType: otype,
            relation: egoRelation,
            metadata: {
                name: e.name,
                sentiment: e.sentiment,
                originEntryId: entryId,
                isExtraction: true
            }
        }).catch(err => logger.debug(`[Extraction] Ego-edge failed for ${e.name}`));
    }

    // 7. Upsert Relationships (Between Entities)
    for (const rel of relationsData) {
        const source = nameToIdMap[rel.source.toLowerCase()];
        const target = nameToIdMap[rel.target.toLowerCase()];

        if (source && target && source.id !== target.id) {
            await graphService.createAssociation({
                fromId: source.id,
                fromType: source.type,
                toId: target.id,
                toType: target.type,
                relation: rel.type as EdgeType,
                metadata: {
                    ...rel.metadata,
                    sourceName: rel.source,
                    targetName: rel.target,
                    originEntryId: entryId
                }
            }).catch(err => logger.warn(`[Extraction] Relation ${rel.type} failed: ${err.message}`));
        }
    }

    // 6. Update Entry Mentions (Forward compatibility)
    if (entityIds.length > 0) {
        await Entry.findByIdAndUpdate(entryId, {
            $addToSet: { mentions: { $each: entityIds } }
        });
    }

    return {
        status: 'completed',
        result: { names: entitiesData.map(e => e.name), count: entitiesData.length }
    };
};
