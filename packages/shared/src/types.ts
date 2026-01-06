// Core Data Models for Extenda

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'free' | 'pro' | 'enterprise';
    createdAt: Date;
    settings: UserSettings;
}

export interface UserSettings {
    theme?: 'light' | 'dark' | 'system';
    notificationsEnabled?: boolean;
    [key: string]: any;
}

export interface Workflow {
    id: string;
    userId: string;
    name: string;
    description?: string;
    intent: string;
    definition: WorkflowDefinition;
    isTemplate: boolean;
    isPublic: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkflowDefinition {
    steps: Step[];
    dependencies?: string[]; // Simplified dependency tracking
    requiresApproval?: boolean;
}

export type WorkflowStep = Step;

export interface Step {
    id: string;
    type: 'tool' | 'decision' | 'approval' | 'wait';
    tool?: string;
    params?: Record<string, any>;
    description: string;
    requiresApproval: boolean;
    timeout?: number;
    dependencies?: string[];
    condition?: {
        type: 'if' | 'switch';
        expression: string;
        then?: Step[];
        else?: Step[];
    };
}

export interface Execution {
    id: string;
    workflowId: string;
    userId: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    startedAt: Date;
    completedAt?: Date;
    context: SessionContext;
    result?: any;
    error?: any;
    steps: StepExecution[];
}

export interface StepExecution {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    result?: any;
    error?: any;
    retryCount: number;
}

export interface SessionContext {
    sessionId?: string;
    activeTabId?: number;
    tabs?: Tab[];
    timestamp: Date;
    [key: string]: any;
}

export interface Tab {
    id: number;
    url: string;
    title: string;
    isActive: boolean;
    favIconUrl?: string;
}

export interface Tool {
    name: string;
    description: string;
    parameters: any; // JSON Schema
}

export type ToolDefinition = Tool;
