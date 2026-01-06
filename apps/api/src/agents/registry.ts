import { Agent } from './types.js';

class AgentRegistry {
    private agents: Map<string, Agent> = new Map();

    register(agent: Agent) {
        console.log(`[AgentRegistry] Registering agent: ${agent.name}`);
        this.agents.set(agent.name, agent);
    }

    get(name: string): Agent | undefined {
        return this.agents.get(name);
    }

    getAll(): Agent[] {
        return Array.from(this.agents.values());
    }

    clear() {
        this.agents.clear();
    }
}

export const agentRegistry = new AgentRegistry();
