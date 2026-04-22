import { Types } from "mongoose";
import { IntegrationProviderIdentifier } from "../integration.interface";

export abstract class AgentTool {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: any;

    // The identifier of the integration required
    // If undefined, the tool doesn't require an external integration connection.
    abstract readonly requiredIntegration?: IntegrationProviderIdentifier;


    // Executes the tool logic
    abstract execute(args: any, userId: string | Types.ObjectId): Promise<any>;

    // Gets the tool definition formatted for Gemini
    getDefinition() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }
}
