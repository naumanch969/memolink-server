export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface AgentTool {
    definition: ToolDefinition;
    handler: (userId: string, args: any) => Promise<any>;
}
