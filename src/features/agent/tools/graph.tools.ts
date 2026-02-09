
import { entityService } from '../../entity/entity.service';
import { graphService } from '../../graph/graph.service';
import { AgentTool } from './types';

/**
 * Tool: Search for entities by name or alias.
 * Essential for the Agent to find the correct node before exploring the graph.
 */
export const searchKnowledgeEntitiesTool: AgentTool = {
    definition: {
        name: "search_knowledge_entities",
        description: "Search for specific people, projects, organizations, or topics in your long-term memory graph by name.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "The name of the entity to find (e.g. 'John', 'Opstin', 'AI')." },
                otype: { type: "string", description: "Optional filter by type (Person, Project, Organization, Topic, Emotion, Entity)." }
            },
            required: ["query"]
        }
    },
    handler: async (userId, args) => {
        const result = await entityService.listEntities(userId, {
            search: args.query,
            otype: args.otype,
            limit: 10
        });

        return result.entities.map(e => ({
            id: e._id,
            name: e.name,
            type: e.otype,
            summary: e.summary || e.lastInteractionSummary,
            aliases: e.aliases
        }));
    }
};

/**
 * Tool: Explore connections for a specific node (N-Hop Traversal).
 * Allows the Agent to follow associations between entities.
 */
export const exploreAssociationsTool: AgentTool = {
    definition: {
        name: "explore_associations",
        description: "Explore the connections of a specific entity to see how it relates to others. Follow connections to discover deeper insights.",
        parameters: {
            type: "object",
            properties: {
                nodeId: { type: "string", description: "The ID of the entity/node to explore." }
            },
            required: ["nodeId"]
        }
    },
    handler: async (userId, args) => {
        const { nodeId } = args;

        // 1. Get 1-hop outbounds and inbounds
        const [outbounds, inbounds] = await Promise.all([
            graphService.getOutbounds(nodeId),
            graphService.getInbounds(nodeId)
        ]);

        const formatEdge = (edge: any, isOutbound: boolean) => {
            const partnerNode = isOutbound ? edge.to : edge.from;
            const partnerName = isOutbound ? (edge.metadata?.targetName || edge.metadata?.name) : (edge.metadata?.sourceName || edge.metadata?.name);

            return {
                relation: edge.relation,
                direction: isOutbound ? "outbound" : "inbound",
                connectedTo: {
                    id: partnerNode.id,
                    type: partnerNode.type,
                    name: partnerName || "Unknown"
                },
                metadata: edge.metadata
            };
        };

        const connections = [
            ...outbounds.map(e => formatEdge(e, true)),
            ...inbounds.map(e => formatEdge(e, false))
        ].filter(c => !c.metadata?.isInverse);

        return {
            nodeId,
            connectionCount: connections.length,
            connections
        };
    }
};
