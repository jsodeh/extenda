import { Step, SessionContext, Tab } from './types';
export declare const EVENTS_CLIENT: {
    readonly WORKFLOW_START: "workflow:start";
    readonly WORKFLOW_APPROVE: "workflow:approve";
    readonly WORKFLOW_CANCEL: "workflow:cancel";
    readonly WORKFLOW_PAUSE: "workflow:pause";
    readonly WORKFLOW_RESUME: "workflow:resume";
    readonly SESSION_SYNC: "session:sync";
    readonly SESSION_HEARTBEAT: "session:heartbeat";
    readonly FEEDBACK_SUBMIT: "feedback:submit";
    readonly TOOL_RESULT: "tool:result";
};
export declare const EVENTS_SERVER: {
    readonly WORKFLOW_PLAN: "workflow:plan";
    readonly WORKFLOW_STEP_START: "workflow:step_start";
    readonly WORKFLOW_STEP_COMPLETE: "workflow:step_complete";
    readonly WORKFLOW_APPROVAL_NEEDED: "workflow:approval_needed";
    readonly WORKFLOW_COMPLETE: "workflow:complete";
    readonly WORKFLOW_ERROR: "workflow:error";
    readonly AGENT_THINKING: "agent:thinking";
    readonly AGENT_WAITING: "agent:waiting";
    readonly TOOL_EXECUTE: "tool:execute";
};
export interface WorkflowStartPayload {
    intent: string;
    context: SessionContext;
    sessionId?: string;
}
export interface WorkflowResumePayload {
    executionId: string;
    approved: boolean;
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
