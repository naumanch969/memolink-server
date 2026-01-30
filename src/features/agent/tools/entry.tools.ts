import { entryService } from '../../entry/entry.service';
import { AgentTool } from './types';

export const createEntryTool: AgentTool = {
    definition: {
        name: 'create_entry',
        description: 'Create a new journal entry or note.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: {
                    type: 'STRING',
                    description: 'The main text content of the entry.'
                },
                date: {
                    type: 'STRING',
                    description: 'Optional date for the entry (ISO string). Use this if the user specifies a past or future date.'
                },
                mood: {
                    type: 'STRING',
                    description: 'Optional mood associated with the entry (e.g., Happy, Sad, Productive).'
                },
                isPrivate: {
                    type: 'BOOLEAN',
                    description: 'Whether the entry should be marked as private.'
                },
                tags: {
                    type: 'ARRAY',
                    items: {
                        type: 'STRING'
                    },
                    description: 'List of tags to categorize the entry.'
                }
            },
            required: ['content']
        }
    },
    handler: async (userId, args) => {
        return await entryService.createEntry(userId, {
            content: args.content,
            mood: args.mood,
            isPrivate: args.isPrivate || false,
            tags: args.tags || [],
            type: 'text',
            date: args.date ? new Date(args.date) : new Date()
        });
    }
};

export const searchEntriesTool: AgentTool = {
    definition: {
        name: 'search_entries',
        description: 'Search for past journal entries. Returns paginated results with metadata.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: {
                    type: 'STRING',
                    description: 'Keywords to search for in entry content.'
                },
                dateFrom: {
                    type: 'STRING',
                    description: 'Start date (ISO string) for the search range.'
                },
                dateTo: {
                    type: 'STRING',
                    description: 'End date (ISO string) for the search range.'
                },
                limit: {
                    type: 'NUMBER',
                    description: 'Results per page. Default 20. Max 100.'
                },
                page: {
                    type: 'NUMBER',
                    description: 'Page number to retrieve. Default 1.'
                }
            },
            required: []
        }
    },
    handler: async (userId, args) => {
        const result = await entryService.searchEntries(userId, {
            q: args.query,
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
            limit: args.limit || 20,
            page: args.page || 1
        });

        // Return metadata so the agent knows if there is more data to fetch
        return {
            metadata: {
                total: result.total,
                page: result.page,
                totalPages: result.totalPages,
                hasMore: result.page < result.totalPages
            },
            entries: result.entries.map(e => ({
                id: e._id,
                content: e.content,
                date: e.date,
                mood: e.mood,
                tags: e.tags
            }))
        };
    }
};

export const getRecentEntriesTool: AgentTool = {
    definition: {
        name: 'get_recent_entries',
        description: 'Get the most recent journal entries.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: {
                    type: 'NUMBER',
                    description: 'Number of entries to retrieve (default 5).'
                }
            },
            required: []
        }
    },
    handler: async (userId, args) => {
        const result = await entryService.getFeed(userId, {
            limit: args.limit || 5
        });
        return result.entries.map(e => ({
            id: e._id,
            content: e.content,
            date: e.date,
            mood: e.mood
        }));
    }
};

export const findSimilarEntriesTool: AgentTool = {
    definition: {
        name: 'find_similar_entries',
        description: 'Find past memories and journal entries that are semantically similar to a given topic or thought.',
        parameters: {
            type: 'OBJECT',
            properties: {
                text: {
                    type: 'STRING',
                    description: 'The topic, thought, or text to find similar entries for.'
                },
                limit: {
                    type: 'NUMBER',
                    description: 'Number of entries to retrieve (default 5).'
                }
            },
            required: ['text']
        }
    },
    handler: async (userId, args) => {
        const { agentService } = await import('../agent.service');
        const results = await agentService.findSimilarEntries(userId, args.text, args.limit || 5);
        return results.map(r => ({
            content: r.content,
            date: r.date,
            score: r.score,
            type: r.type
        }));
    }
};
