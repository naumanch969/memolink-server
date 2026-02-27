import { Types } from "mongoose";
import { logger } from "../../../config/logger";
import { integrationRegistry } from "../integration.registry";
import { AgentTool } from "./tool.interface";

class ToolRegistry {
    private tools: Map<string, AgentTool> = new Map();

    register(tool: AgentTool) {
        this.tools.set(tool.name, tool);
        logger.info(`Registered tool: ${tool.name}`);
    }

    get(name: string): AgentTool {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool ${name} not found`);
        return tool;
    }

    getAllDefinitions() {
        return Array.from(this.tools.values()).map(tool => tool.getDefinition());
    }

    async executeToolCall(toolName: string, args: any, userId: string | Types.ObjectId): Promise<any> {
        try {
            const tool = this.get(toolName);

            // Validate integration connectivity before executing if required
            if (tool.requiredIntegration) {
                const provider = integrationRegistry.get(tool.requiredIntegration);
                const isConnected = await provider.verifyConnection(userId.toString());

                // Allow some grace period or refresh checking logic depending on requirement,
                // for now we just verify it exists.
                if (!isConnected) {
                    return {
                        error: `User has not connected their ${provider.name} account. Cannot execute tool.`
                    };
                }
            }

            return await tool.execute(args, userId);
        } catch (error: any) {
            logger.error(`Error executing tool ${toolName}`, error);
            // We return the error string back to the LLM so it can correct itself or inform the user
            return { error: `Failed to execute ${toolName}: ${error.message}` };
        }
    }
}

export const toolRegistry = new ToolRegistry();
