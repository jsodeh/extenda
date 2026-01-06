"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENTS_SERVER = exports.EVENTS_CLIENT = void 0;
// Client -> Server Events
exports.EVENTS_CLIENT = {
    WORKFLOW_START: 'workflow:start',
    WORKFLOW_APPROVE: 'workflow:approve',
    WORKFLOW_CANCEL: 'workflow:cancel',
    WORKFLOW_PAUSE: 'workflow:pause',
    WORKFLOW_RESUME: 'workflow:resume',
    SESSION_SYNC: 'session:sync',
    SESSION_HEARTBEAT: 'session:heartbeat',
    FEEDBACK_SUBMIT: 'feedback:submit',
    TOOL_RESULT: 'tool:result'
};
// Server -> Client Events
exports.EVENTS_SERVER = {
    WORKFLOW_PLAN: 'workflow:plan',
    WORKFLOW_STEP_START: 'workflow:step_start',
    WORKFLOW_STEP_COMPLETE: 'workflow:step_complete',
    WORKFLOW_APPROVAL_NEEDED: 'workflow:approval_needed',
    WORKFLOW_COMPLETE: 'workflow:complete',
    WORKFLOW_ERROR: 'workflow:error',
    AGENT_THINKING: 'agent:thinking',
    AGENT_WAITING: 'agent:waiting',
    TOOL_EXECUTE: 'tool:execute'
};
