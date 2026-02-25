import { IAgentWorkflowRegistry } from "./agent.interfaces";
import { AgentTaskType, IAgentWorkflow } from './agent.types';

export class AgentWorkflowRegistry implements IAgentWorkflowRegistry {
    private workflows: Map<AgentTaskType, IAgentWorkflow> = new Map();

    register(workflow: IAgentWorkflow) {
        const type = workflow.type as AgentTaskType;
        if (this.workflows.has(type)) {
            throw new Error(`Workflow for task type ${type} is already registered.`);
        }
        this.workflows.set(type, workflow);
    }

    getWorkflow(type: AgentTaskType): IAgentWorkflow {
        const workflow = this.workflows.get(type);
        if (!workflow) {
            throw new Error(`No workflow registered for task type: ${type}`);
        }
        return workflow;
    }

    hasWorkflow(type: AgentTaskType): boolean {
        return this.workflows.has(type);
    }
}

export const agentWorkflowRegistry = new AgentWorkflowRegistry();
