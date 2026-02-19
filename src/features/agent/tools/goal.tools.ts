import { GoalPeriod, GoalTrackingType } from '../../goal/goal.interfaces';
import { goalService } from '../../goal/goal.service';
import { AgentTool } from './types';

export const createGoalTool: AgentTool = {
    definition: {
        name: 'create_goal',
        description: 'Create a new long-term goal.',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: {
                    type: 'STRING',
                    description: 'The title of the goal.'
                },
                deadline: {
                    type: 'STRING',
                    description: 'Target completion date (ISO string).'
                },
                description: {
                    type: 'STRING',
                    description: 'Detailed description of the goal.'
                }
            },
            required: ['title']
        }
    },
    handler: async (userId, args) => {
        return await goalService.createGoal(userId, {
            title: args.title,
            description: args.description,
            deadline: args.deadline ? new Date(args.deadline) : undefined,
            period: GoalPeriod.INDEFINITE, // Default for now
            priority: 'medium',
            trackingConfig: {
                type: GoalTrackingType.BOOLEAN, // Simple done/not done default
                targetValue: 1
            }
        } as any); // Cast as any for tool strictness mismatch handling if needed
    }
};

export const listGoalsTool: AgentTool = {
    definition: {
        name: 'list_goals',
        description: 'List current active goals.',
        parameters: {
            type: 'OBJECT',
            properties: {
                status: {
                    type: 'STRING',
                    description: 'Filter by status (default: active). Options: active, completed, archived.'
                }
            },
            required: []
        }
    },
    handler: async (userId, args) => {
        const goals = await goalService.getGoals(userId, {
            status: args.status || 'active'
        });

        return goals.map(g => ({
            id: g._id,
            title: g.title,
            deadline: g.deadline,
            progress: g.progress,
            status: g.status
        }));
    }
};

export const updateGoalTool: AgentTool = {
    definition: {
        name: 'update_goal',
        description: 'Update a goal progress or status.',
        parameters: {
            type: 'OBJECT',
            properties: {
                goalId: {
                    type: 'STRING',
                    description: 'The ID of the goal to update.'
                },
                progressValue: {
                    type: 'NUMBER',
                    description: 'New progress value.'
                },
                progressMode: {
                    type: 'STRING',
                    description: 'Mode of update: "set" or "add". Default is set.'
                },
                status: {
                    type: 'STRING',
                    description: 'New status (active, completed, archived).'
                }
            },
            required: ['goalId']
        }
    },
    handler: async (userId, args) => {
        if (args.progressValue !== undefined) {
            await goalService.updateProgress(userId, args.goalId, {
                value: args.progressValue,
                mode: args.progressMode || 'set'
            });
        }

        if (args.status) {
            await goalService.updateGoal(userId, args.goalId, {
                status: args.status
            });
        }

        return { success: true, message: 'Goal updated' };
    }
};
