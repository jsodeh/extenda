import { Execution, Step, SessionContext, Tab, ModelConfig } from './types';

// Client -> Server Events
export const EVENTS_CLIENT = {
    WORKFLOW_START: 'workflow:start',
    WORKFLOW_APPROVE: 'workflow:approve',
    WORKFLOW_CANCEL: 'workflow:cancel',
    WORKFLOW_PAUSE: 'workflow:pause',
    WORKFLOW_RESUME: 'workflow:resume',
    SESSION_SYNC: 'session:sync',
    SESSION_HEARTBEAT: 'session:heartbeat',
    FEEDBACK_SUBMIT: 'feedback:submit',
    TOOL_RESULT: 'tool:result'
} as const;

// Server -> Client Events
export const EVENTS_SERVER = {
    WORKFLOW_PLAN: 'workflow:plan',
    WORKFLOW_STEP_START: 'workflow:step_start',
    WORKFLOW_STEP_COMPLETE: 'workflow:step_complete',
    WORKFLOW_APPROVAL_NEEDED: 'workflow:approval_needed',
    WORKFLOW_COMPLETE: 'workflow:complete',
    WORKFLOW_ERROR: 'workflow:error',
    AGENT_THINKING: 'agent:thinking',
    AGENT_WAITING: 'agent:waiting',
    TOOL_EXECUTE: 'tool:execute'
} as const;

// Types for Event Payloads
export interface WorkflowStartPayload {
    intent: string;
    context: SessionContext;
    sessionId?: string;
    modelConfig?: ModelConfig;
}

export interface WorkflowResumePayload {
    executionId: string;
    approved: boolean;
    modelConfig?: ModelConfig;
}

export interface WorkflowApprovePayload {
    executionId: string;
    approved: boolean;
}

export interface SessionSyncPayload {
    tabs: Tab[];
    activeTabId?: number;
}

export interface WorkflowStepStartPayload {
    workflowId: string;
    step: Step;
}

export interface WorkflowStepCompletePayload {
    workflowId: string;
    step: Step;
    result: any;
}


export interface ToolExecutionRequest {
    executionId: string;
    stepId: string;
    tool: string;
    params: any;
}

export interface ToolExecutionResult {
    executionId: string;
    stepId: string;
    status: 'success' | 'error';
    result?: any;
    error?: string;
}

