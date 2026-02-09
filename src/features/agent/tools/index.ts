import { createEntryTool, findSimilarEntriesTool, getRecentEntriesTool, searchEntriesTool } from './entry.tools';
import { createGoalTool, listGoalsTool, updateGoalTool } from './goal.tools';
import { exploreAssociationsTool, searchKnowledgeEntitiesTool } from './graph.tools';
import { createReminderTool, getRemindersTool } from './reminder.tools';
import { AgentTool } from './types';

export const agentTools: AgentTool[] = [
    createEntryTool,
    searchEntriesTool,
    getRecentEntriesTool,
    findSimilarEntriesTool,
    createGoalTool,
    listGoalsTool,
    updateGoalTool,
    createReminderTool,
    getRemindersTool,
    searchKnowledgeEntitiesTool,
    exploreAssociationsTool
];

export const agentToolDefinitions = agentTools.map(t => t.definition);

export const agentToolHandlers: Record<string, (userId: string, args: any) => Promise<any>> =
    agentTools.reduce((acc, tool) => {
        acc[tool.definition.name] = tool.handler;
        return acc;
    }, {} as any);
