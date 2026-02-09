import { default as mongooseNative } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { KnowledgeEntity } from '../../entity/entity.model';
import { entityService } from '../../entity/entity.service';
import Entry from '../../entry/entry.model';
import { EdgeType, NodeType } from '../../graph/edge.model';
import { graphService } from '../../graph/graph.service';
import { AgentWorkflow } from '../agent.types';

const extractionSchema = z.object({
    entities: z.array(z.object({
        name: z.string(),
        otype: z.nativeEnum(NodeType),
        summary: z.string().optional(),
        aliases: z.array(z.string()).optional()
    })).optional(),
    relations: z.array(z.object({
        source: z.string(),
        target: z.string(),
        type: z.nativeEnum(EdgeType),
        metadata: z.record(z.string(), z.any()).optional()
    })).optional()
});

export const runEntityExtraction: AgentWorkflow = async (task) => {
    const { entryId, userId } = task.inputData;

    const session = await mongooseNative.startSession();
    session.startTransaction();

    try {
        // 1. Fetch Entry
        const entry = await Entry.findById(entryId).session(session);
        if (!entry) throw new Error('Entry not found');
        if (!entry.content) {
            await session.commitTransaction();
            return { status: 'completed', result: { names: [] } };
        }

        // 2. Fetch Existing Entity Names for Disambiguation
        const entityRegistry = await entityService.getEntityRegistry(userId);
        const knownNames = Object.keys(entityRegistry);

        // 2.5 Fetch Negative Context (Refutations)
        const refutedRelations = await graphService.getRefutationContext(userId);
        const negativeContext = refutedRelations.length > 0
            ? `\nREJECTED RELATIONSHIPS (Do not extract these unless specifically mentioned as a change):\n${refutedRelations.join('\n')}`
            : '';

        // 3. Call LLM
        const prompt = `
        Analyze the journal entry and extract "Chief of Staff" level intelligence about entities and their relationships.
        
        KNOWN ENTITIES for this user:
        ${knownNames.join(', ')}
        ${negativeContext}

        Rules:
        1. If an entity matches or is an alias for a KNOWN ENTITY, use the EXACT name from the list above.
        2. Extract relationships BETWEEN them.
        3. Relationship types MUST use: WORKS_AT, CONTRIBUTES_TO, MEMBER_OF, PART_OF, OWNED_BY, ASSOCIATED_WITH, BLOCKS, SUPPORTS, REQUIRES, INFLUENCES, TRIGGERS, KNOWS, INTERESTED_IN.
        4. If a relationship matches one in "REJECTED RELATIONSHIPS", ONLY extract it if the entry explicitly mentions a change of state (e.g. "John now works at...").

        Entry:
        "${entry.content}"
      `;

        const response: z.infer<typeof extractionSchema> = await LLMService.generateJSON(prompt, extractionSchema);
        let entitiesData = (response as any).entities || [];
        let relationsData = (response as any).relations || [];

        // 3.5 THE CRITIC PASS (Verification Loop)
        // We verify the extraction to reduce hallucinations and ensure precision
        if (entitiesData.length > 0) {
            const criticPrompt = `
            You are the "Intelligence Critic" for MemoLink. Review the following extraction from a journal entry.
            Source Text: "${entry.content}"
            ${negativeContext}
            
            Initial Extraction:
            Entities: ${JSON.stringify(entitiesData)}
            Relations: ${JSON.stringify(relationsData)}
            
            Instructions:
            1. Verify every entity exists in the source text. Remove hallucinations.
            2. Check if any "KNOWN ENTITIES" (${knownNames.join(', ')}) were missed or misnamed.
            3. Ensure relationship types are strictly from the allowed list: WORKS_AT, CONTRIBUTES_TO, MEMBER_OF, PART_OF, OWNED_BY, ASSOCIATED_WITH, BLOCKS, SUPPORTS, REQUIRES, INFLUENCES, TRIGGERS, KNOWS, INTERESTED_IN.
            4. If a relationship was previously REJECTED, ensure the source text supports a change in reality before keeping it.
            5. Refine the extraction. If it's 100% correct, return it as is.
            
            Return the refined JSON in the same format.
            `;

            try {
                const refinedResponse: z.infer<typeof extractionSchema> = await LLMService.generateJSON(criticPrompt, extractionSchema);
                entitiesData = (refinedResponse as any).entities || entitiesData;
                relationsData = (refinedResponse as any).relations || relationsData;
                logger.debug(`Critic pass completed for entry ${entryId}. ${entitiesData.length} entities refined.`);
            } catch (criticError) {
                logger.warn(`Critic pass failed for entry ${entryId}, falling back to initial extraction.`, criticError);
            }
        }

        if (entitiesData.length === 0) {
            // Even if no entities, we mark as processed to avoid re-extraction
            entry.status = 'processed';
            await entry.save({ session });
            await session.commitTransaction();
            return { status: 'completed', result: { names: [] } };
        }

        const entityIds: string[] = [];
        const nameToIdMap: Record<string, { id: string, type: NodeType }> = {};

        // 4. Upsert Entities
        for (const e of entitiesData) {
            const otype = e.type as NodeType;

            let entity = await KnowledgeEntity.findOne({
                userId,
                $or: [
                    { name: { $regex: new RegExp(`^${e.name.trim()}$`, 'i') } },
                    { aliases: { $in: [e.name.trim()] } }
                ],
                isDeleted: false
            }).session(session);

            if (!entity) {
                entity = await entityService.createEntity(userId, {
                    name: e.name,
                    otype,
                    aliases: e.aliases,
                    summary: e.summary,
                    tags: e.tags,
                    jobTitle: otype === NodeType.PERSON ? e.role : undefined
                }, { session }) as any;
            } else {
                const oldScore = entity.sentimentScore || 0;
                const count = entity.interactionCount || 0;
                const newScore = ((oldScore * count) + (e.sentiment || 0)) / (count + 1);
                const newAliases = Array.from(new Set([...(entity.aliases || []), ...(e.aliases || [])]));

                await entityService.updateEntity(entity._id.toString(), userId, {
                    lastInteractionAt: entry.date,
                    lastInteractionSummary: e.summary,
                    sentimentScore: newScore,
                    interactionCount: count + 1,
                    aliases: newAliases,
                    tags: Array.from(new Set([...(entity.tags || []), ...(e.tags || [])]))
                }, { session });
            }

            const sid = entity!._id.toString();
            entityIds.push(sid);
            nameToIdMap[e.name.toLowerCase()] = { id: sid, type: otype };
            (e.aliases || []).forEach(alias => {
                nameToIdMap[alias.toLowerCase()] = { id: sid, type: otype };
            });

            // 5. Create "MENTIONED_IN" Edge (Provenance Tracking)
            await graphService.createAssociation({
                fromId: sid,
                fromType: otype,
                toId: entryId,
                toType: NodeType.CONTEXT,
                relation: EdgeType.MENTIONED_IN,
                sourceEntryId: entryId,
                metadata: { entryDate: entry.date, name: e.name, isExtraction: true }
            }, { session });

            // 6. Create Ego-Edge
            const egoRelation = otype === NodeType.PERSON ? EdgeType.KNOWS : EdgeType.INTERESTED_IN;
            await graphService.createAssociation({
                fromId: userId,
                fromType: NodeType.USER,
                toId: sid,
                toType: otype,
                relation: egoRelation,
                sourceEntryId: entryId,
                metadata: { name: e.name, sentiment: e.sentiment, originEntryId: entryId, isExtraction: true }
            }, { session }).catch(err => logger.debug(`Ego-edge failed for ${e.name}`));
        }

        // 7. Upsert Relationships
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
                    sourceEntryId: entryId,
                    metadata: { ...rel.metadata, sourceName: rel.source, targetName: rel.target, originEntryId: entryId }
                }, { session }).catch(err => logger.warn(`Relation ${rel.type} failed: ${err.message}`));
            }
        }

        // 8. Update Entry Mentions & STATUS (The Integrity Lock)
        entry.mentions = Array.from(new Set([...(entry.mentions || []), ...entityIds.map(id => new mongooseNative.Types.ObjectId(id))])) as any;
        entry.status = 'processed';
        await entry.save({ session });

        await session.commitTransaction();
        return {
            status: 'completed',
            result: { names: entitiesData.map(e => e.name), count: entitiesData.length }
        };

    } catch (error) {
        await session.abortTransaction();
        logger.error(`[ExtractionWorkflow] Failed: ${error.message}`, { entryId, userId });
        throw error;
    } finally {
        session.endSession();
    }
};
