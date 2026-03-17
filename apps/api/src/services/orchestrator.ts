import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { toolRegistry } from '../tools/registry.js';
import { adapterRegistry } from '../adapters/index.js';
import { knowledgeBase } from './knowledge-base.js';
import { generateText } from '../lib/gemini.js';
import { WorkflowDependencyResolver } from '../lib/workflow-dependencies.js';
import { EVENTS_SERVER, EVENTS_CLIENT, User, Workflow, Execution, WorkflowStep, ToolExecutionResult } from '@extenda/shared';
import { db } from '../db/index.js';
import { workflows, executions, stepExecutions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

import { chatService } from './chat-service.js';
import { agentRegistry } from '../agents/registry.js';
import { SpecializedAgent } from '../agents/specialized-agent.js';

export class AgentOrchestrator {
    private io: Server | null = null;
    private activeExecutions: Map<string, Execution> = new Map();
    // Removed in-memory history
    // ...

    setServer(io: Server) {
        this.io = io;
    }


    // Initialize Agents
    private initializeAgents() {
        const adapters = adapterRegistry.getAll();
        // Register specialized agents
        adapters.forEach(adapter => {
            if (!agentRegistry.get(adapter.name + ' Agent')) {
                agentRegistry.register(SpecializedAgent.fromAdapter(adapter));
            }
        });

        // Register General Agent (default tools)
        if (!agentRegistry.get('General Agent')) {
            const generalTools = toolRegistry.getAll()
                .filter(t => !t.name.includes('_')) // basic tools
                .map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                    execute: (t as any).execute
                }));

            agentRegistry.register({
                name: 'General Agent',
                description: 'Handles general queries, small talk, and tasks not covered by specific integrations.',
                systemPrompt: 'You are a General AI Assistant. You handle general inquiries and tasks.',
                tools: generalTools
            });
        }
    }

    async plan(intent: string, user: User, sessionId: string): Promise<Workflow> {
        this.initializeAgents(); // Ensure initialized
        console.log(`Planning workflow for intent: ${intent}`);

        // Get conversation history for context
        const history = await this.getConversationHistory(sessionId);
        const historyContext = history.length > 0
            ? `\n\nConversation History (last 5 messages):\n${history.slice(-5).join('\n')}`
            : '';

        // Fetch user preferences
        const preferences = await import('./preferences-service.js').then(m => m.PreferencesService.get(user.id as any));

        // UNIFIED TOOL ACCESS: Aggregate ALL enabled tools for multi-tool workflows
        const enabledTools = preferences?.enabledTools as string[] | undefined;
        const shouldFilter = Array.isArray(enabledTools) && enabledTools.length > 0;

        // Collect all tools from all adapters
        const allAgentTools = agentRegistry.getAll().flatMap(agent => {
            if (shouldFilter) {
                // Filter tools based on user preferences
                return agent.tools.filter(t =>
                    agent.name === 'General Agent' || enabledTools.includes(t.name)
                );
            }
            return agent.tools;
        });

        console.log(`[Planner] Available tools from all agents: ${allAgentTools.length}`);

        // RAG: Search knowledge base
        const relevantDocs = await knowledgeBase.search(user.id, intent);
        const knowledgeContext = relevantDocs.length > 0
            ? `\n\nRelevant Knowledge Base Information:\n${relevantDocs.join('\n---\n')}`
            : '';

        const toolsContext = allAgentTools.map(t =>
            `- ${t.name}: ${t.description} (Params: ${JSON.stringify(t.parameters)})`
        ).join('\n');

        // Add core client tools always? (Notifier, TabManager)
        // Or should they be injected into every agent?
        // Let's inject them here for now
        const clientTools = [
            '- Notifier: Show notifications to user. Params: { "action": "notify", "message": "text" }',
            '- TabManager: Manage browser tabs. Params: { "action": "get_active_tab" | "open_tab", "url": "..." }'
        ].join('\n');

        const aiTools = [
            '- AIProcessor: Process text. Params: { "action": "summarize" | "analyze" | "categorize", "content": "..." }'
        ].join('\n');

        const fullToolsContext = `
AGENT TOOLS:
${toolsContext}

CLIENT TOOLS:
${clientTools}

AI TOOLS:
${aiTools}
`;

        let persona = 'You are Extenda, an AI Executive Assistant. You help users by orchestrating tools to accomplish their tasks efficiently.';
        let customContext = '';

        if (preferences) {
            if (preferences.aiSettings?.businessType) persona += ` You are assisting a ${preferences.aiSettings.businessType}.`;
            if (preferences.aiSettings?.goals) persona += ` Top goals: ${(preferences.aiSettings.goals as string[]).join(', ')}.`;
            if (preferences.customPrompt) customContext += `\n\nUSER CUSTOM INSTRUCTIONS:\n${preferences.customPrompt}`;
        }

        // console.log(`AI has access to ${allTools.length} tools...`); // Simplified log
        console.log('Generating plan with tools context and knowledge base...');

        // Add user context to prevent hallucinations
        const userContext = user ? `
User Name: ${user.name || 'User'}
User Email: ${user.email}` : '';

        const prompt = `
      ${persona}
      Current Time: ${new Date().toISOString()}${userContext}
      User Request: "${intent}"${historyContext}${knowledgeContext}${customContext}
      
      Available Tools (Use these exact names):
      ${fullToolsContext}
      
      Goal: Create a JSON execution plan to fulfill the User Request.

      
      Instructions:
      1. Analyze which tools can fulfill the request.
      2. USE GENERIC TOOLS CORRECTLY:
         - For AIProcessor: tool="AIProcessor", params={ "action": "summarize", "content": ... }
         - DO NOT combine generic tool names and actions (e.g. "AIProcessor_summarize" is INVALID).
      3. HANDLING VARIABLES:
         - Use {{step-ID.output}} or {{step-ID.result.field}} to reference previous steps.
         - DO NOT use pipes or filters (e.g. "| map" or "| join" are NOT supported).
         - The variable replacement only supports direct JSON or string injection.
      4. If a tool matches (e.g., "summary of emails" -> "list_emails"), you MUST use it.
      5. UX GUIDELINES:
         - For SEARCH/RETRIEVAL tasks (e.g. "summarize emails", "check calendar"):
           - ALWAYS end with an 'AIProcessor' step (action="summarize" or "analyze") to consolidate findings into a single, natural language summary.
           - The summary should be friendly and actionable.
           - DO NOT use 'Notifier' for long text summaries; use it ONLY for brief alerts.
      6. APPROVAL REQUIREMENTS - Set "requiresApproval": true ONLY if:
         - Sending/writing data (emails, posts, messages)
         - Creating or deleting items (events, files, tasks)
         - Modifying existing data
         - Making external API calls that cost money
         
         Set "requiresApproval": false for:
         - Reading data (listing emails, viewing calendar, fetching information)
         - Searching or analyzing
         - Summarizing or processing text
         - Browser navigation or UI interactions
      7. Return ONLY valid JSON matching this structure:
      {
        "steps": [
          { 
            "id": "step-1", 
            "type": "tool", 
            "tool": "ToolName", 
            "params": { "param": "value" }, 
            "requiresApproval": boolean, 
            "dependencies": ["step-id"],
            "description": "Explanation of action" 
          }
        ]
      }
    `;

        try {
            // Add timeout to planning phase
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Planning timeout')), 45000)
            );

            const aiResponse = await Promise.race([
                generateText(prompt),
                timeoutPromise
            ]) as string;

            console.log('Orchestrator Raw AI Response:', aiResponse);

            // Robust JSON extraction
            const jsonStart = aiResponse.indexOf('{');
            const jsonEnd = aiResponse.lastIndexOf('}');

            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No JSON found in AI response');
            }

            let cleanJson = aiResponse.substring(jsonStart, jsonEnd + 1);

            // Sanitize common JSON issues from AI responses
            // 1. Remove trailing commas before ] or }
            cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1');
            // 2. Fix unescaped quotes in string values (basic fix)
            // 3. Remove any control characters
            cleanJson = cleanJson.replace(/[\x00-\x1F\x7F]/g, ' ');

            let planData;
            try {
                planData = JSON.parse(cleanJson);
            } catch (parseError: any) {
                // Log the problematic section around the error position
                const position = parseError.message.match(/position (\d+)/)?.[1];
                if (position) {
                    const pos = parseInt(position);
                    const start = Math.max(0, pos - 50);
                    const end = Math.min(cleanJson.length, pos + 50);
                    console.error(`JSON error near position ${pos}:`, cleanJson.substring(start, end));
                }
                console.error('Full extracted JSON:', cleanJson);
                throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
            }

            const workflow: Workflow = {
                id: randomUUID(),
                userId: user.id,
                name: intent.slice(0, 50),
                intent,
                definition: {
                    steps: planData.steps || [],
                    requiresApproval: planData.requiresApproval ?? false
                },
                isTemplate: false,
                isPublic: false,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Persist workflow
            await db.insert(workflows).values({
                id: workflow.id as any, // Cast for UUID
                userId: user.id as any,
                name: workflow.name,
                intent: workflow.intent,
                definition: workflow.definition,
                isTemplate: workflow.isTemplate,
                isPublic: workflow.isPublic,
                version: workflow.version
            });

            return workflow;
        } catch (e) {
            console.error('Planning failed:', e);
            throw e;
        }
    }

    async execute(execution: Execution, workflow: Workflow, requiresApproval: boolean = false) {
        console.log(`Starting execution: ${execution.id}`);
        this.activeExecutions.set(execution.id, execution);

        // Persist execution
        await db.insert(executions).values({
            id: execution.id as any,
            workflowId: execution.workflowId as any,
            userId: execution.userId as any,
            status: execution.status,
            startedAt: execution.startedAt,
            context: execution.context,
            result: execution.result,
            error: execution.error
        });

        // Notify client of plan
        this.io?.emit(EVENTS_SERVER.WORKFLOW_PLAN, {
            workflowId: execution.workflowId,
            executionId: execution.id,
            plan: workflow
        });

        // HITL: Global check removed in favor of step-level approval in runWorkflowLoop
        // if (requiresApproval) { ... }

        await this.runWorkflowLoop(execution, workflow);
    }

    async resume(executionId: string, approved: boolean) {
        console.log(`Resuming execution ${executionId}, approved: ${approved}`);
        let execution = this.activeExecutions.get(executionId);
        let storedWorkflow: Workflow | undefined;

        // Restore from DB if missing (Stateless/Restart handling)
        if (!execution) {
            console.log(`Execution ${executionId} not found in memory, fetching from DB...`);
            const dbExecution = await db.query.executions.findFirst({
                where: eq(executions.id, executionId as any),
                with: {
                    // @ts-ignore
                    workflow: true // Relies on Drizzle relation definitions if present, but let's query manually if needed
                }
            });

            if (!dbExecution) {
                throw new Error(`Execution ${executionId} not found`);
            }

            // Fetch workflow definition
            const dbWorkflow = await db.query.workflows.findFirst({
                where: eq(workflows.id, dbExecution.workflowId as any)
            });

            if (!dbWorkflow) {
                throw new Error(`Workflow for execution ${executionId} not found`);
            }

            // Reconstruct execution object
            storedWorkflow = {
                ...dbWorkflow,
                definition: dbWorkflow.definition as any,
                id: dbWorkflow.id as string,
                userId: dbWorkflow.userId as string,
                // Cast logic for safe types
            } as Workflow;

            // Reconstruct execution steps state from step_executions
            const dbSteps = await db.query.stepExecutions.findMany({
                where: eq(stepExecutions.executionId, executionId as any)
            });

            // Map workflow definition steps to execution status
            const executionSteps = storedWorkflow.definition.steps.map(s => {
                const run = dbSteps.find(r => r.stepId === s.id);
                return {
                    stepId: s.id,
                    status: (run?.status || 'pending') as any,
                    result: run?.result,
                    error: run?.error,
                    retryCount: run?.retryCount || 0
                };
            });

            execution = {
                id: dbExecution.id as string,
                workflowId: dbExecution.workflowId as string,
                userId: dbExecution.userId as string,
                status: dbExecution.status as any,
                startedAt: dbExecution.startedAt!,
                context: dbExecution.context as any,
                result: dbExecution.result as any,
                error: dbExecution.error as any,
                steps: executionSteps
            };

            (execution as any)._workflow = storedWorkflow;
            this.activeExecutions.set(execution.id, execution);
        } else {
            storedWorkflow = (execution as any)._workflow as Workflow;
        }

        if (execution.status !== 'paused') {
            // For robustness, if DB says paused but we are here, trust DB/Logic or just warn
            // But valid resume assumes paused.
            // throw new Error(`Execution ${executionId} is not paused`);
        }

        if (approved) {
            execution.status = 'running';
            await db.update(executions).set({ status: 'running' }).where(eq(executions.id, executionId as any));

            this.io?.emit('agent:status', { state: 'executing', message: 'Resuming workflow...' });

            if (storedWorkflow) {
                // Find the step we are causing to resume (the paused one)
                // It's the first step that is NOT completed and requires approval
                const steps = storedWorkflow.definition.steps;
                const completedStepIds = new Set(
                    execution.steps
                        .filter(s => s.status === 'completed')
                        .map(s => s.stepId)
                );

                const pausedStep = steps.find(s =>
                    !completedStepIds.has(s.id) && s.requiresApproval
                );

                await this.runWorkflowLoop(execution, storedWorkflow, pausedStep?.id);
            } else {
                console.error("Workflow definition missing for resume");
            }

        } else {
            console.log(`Execution cancelled by user: ${executionId}`);
            execution.status = 'cancelled';
            await db.update(executions).set({ status: 'cancelled' }).where(eq(executions.id, executionId as any));

            this.activeExecutions.delete(executionId);
            this.io?.emit('agent:status', { state: 'error', message: 'Workflow cancelled' });
            this.io?.emit(EVENTS_SERVER.WORKFLOW_COMPLETE, { workflowId: execution.workflowId });
        }
    }

    private async runWorkflowLoop(execution: Execution, workflow: Workflow, approvedStepId?: string) {
        try {
            // Resolve dependencies and get execution batches
            const steps = workflow.definition.steps as WorkflowStep[];
            const batches = WorkflowDependencyResolver.resolveDependencies(steps);
            console.log(`Resolved ${batches.length} execution batches for ${steps.length} steps`);

            // Re-hydrate step results from execution history to avoid re-running steps
            const stepResults = new Map<string, any>();
            const failedSteps = new Set<string>(); // Track failed steps
            execution.steps.forEach(s => {
                if (s.status === 'completed' && s.result !== undefined) {
                    stepResults.set(s.stepId, s.result);
                } else if (s.status === 'failed') {
                    failedSteps.add(s.stepId);
                }
            });

            // Execute batches sequentially, steps within batch in parallel
            for (const batch of batches) {
                console.log(`Processing batch ${batch.batchIndex}`);

                // Filter out steps that are already completed
                const pendingSteps = batch.steps.filter(step => !stepResults.has(step.id));

                if (pendingSteps.length === 0) {
                    continue; // Batch completed
                }

                // HITL Step Check: specific steps in this batch requiring approval?
                // We stop at the first unapproved step in the batch
                const stepNeedingApproval = pendingSteps.find(step => step.requiresApproval);

                if (stepNeedingApproval) {
                    // Check if this specific step was just approved
                    const wasJustApproved = approvedStepId === stepNeedingApproval.id;

                    if (!wasJustApproved) {
                        // PAUSE - first time encountering this approval gate
                        console.log(`Workflow paused for approval at step: ${stepNeedingApproval.id}`);
                        execution.status = 'paused';
                        this.io?.emit('agent:status', { state: 'paused', message: `Waiting for approval: ${stepNeedingApproval.description}` });

                        this.io?.emit(EVENTS_SERVER.WORKFLOW_PLAN, {
                            workflowId: execution.workflowId,
                            executionId: execution.id,
                            plan: workflow,
                            status: 'paused',
                            pendingStepId: stepNeedingApproval.id
                        });

                        // Persist paused state
                        await db.update(executions).set({ status: 'paused' }).where(eq(executions.id, execution.id as any));

                        return; // PAUSE EXECUTION
                    } else {
                        // Step was just approved - continue execution
                        console.log(`Step ${stepNeedingApproval.id} explicitly approved. Proceeding.`);
                    }
                }

                // Execute pending steps in batch concurrently
                const batchPromises = pendingSteps.map(async (step) => {
                    // Check if any dependency failed - if so, skip this step
                    const dependencies = WorkflowDependencyResolver.extractDependencies(step.params);
                    const hasFailedDependency = dependencies.some(dep => failedSteps.has(dep));

                    if (hasFailedDependency) {
                        console.log(`Skipping step ${step.id} due to failed dependency`);
                        failedSteps.add(step.id);

                        // Notify client of skipped step
                        this.io?.emit(EVENTS_SERVER.WORKFLOW_STEP_COMPLETE, {
                            workflowId: execution.workflowId,
                            stepId: step.id,
                            status: 'failed',
                            error: 'Skipped: dependency step failed'
                        });

                        return { status: 'skipped', reason: 'dependency failed' };
                    }

                    // Inject results from previous steps
                    const paramsWithResults = WorkflowDependencyResolver.injectResults(
                        step.params,
                        stepResults
                    );

                    // Check conditional execution
                    if (step.condition) {
                        const conditionMet = WorkflowDependencyResolver.evaluateCondition(
                            step.condition.expression,
                            stepResults
                        );

                        if (!conditionMet && step.condition.else) {
                            // Execute else branch
                            return this.executeStep(execution, step.condition.else[0], stepResults);
                        } else if (!conditionMet) {
                            // Skip step
                            return { status: 'skipped', reason: 'condition not met' };
                        }
                    }

                    try {
                        return await this.executeStep(execution, { ...step, params: paramsWithResults }, stepResults);
                    } catch (error) {
                        console.error(`Step ${step.id} failed:`, error);
                        failedSteps.add(step.id);
                        throw error; // Re-throw to propagate
                    }
                });

                // Wait for all steps in batch to complete (use allSettled to continue even if some fail)
                const settledResults = await Promise.allSettled(batchPromises);

                // Store results and track failures
                pendingSteps.forEach((step, index) => {
                    const settled = settledResults[index];
                    if (settled.status === 'fulfilled') {
                        stepResults.set(step.id, settled.value);
                    } else {
                        failedSteps.add(step.id);
                    }
                });

                // ABORT: If any step in this batch failed, skip all remaining batches
                if (failedSteps.size > 0) {
                    console.log(`Workflow aborting: ${failedSteps.size} step(s) failed. Skipping remaining steps.`);

                    // Mark remaining steps as skipped
                    for (const remainingBatch of batches.slice(batches.indexOf(batch) + 1)) {
                        for (const remainingStep of remainingBatch.steps) {
                            if (!stepResults.has(remainingStep.id)) {
                                this.io?.emit(EVENTS_SERVER.WORKFLOW_STEP_COMPLETE, {
                                    workflowId: execution.workflowId,
                                    stepId: remainingStep.id,
                                    status: 'failed',
                                    error: 'Skipped: previous step failed'
                                });
                            }
                        }
                    }

                    // Exit the batch loop
                    break;
                }
            }

            // Only emit complete if no failures
            if (failedSteps.size === 0) {
                // Generate user-friendly summary of the workflow results
                try {
                    const lastStepId = Array.from(stepResults.keys()).pop();
                    const lastResult = lastStepId ? stepResults.get(lastStepId) : null;

                    if (lastResult && execution.context?.sessionId) {
                        const resultStr = typeof lastResult === 'string'
                            ? lastResult
                            : JSON.stringify(lastResult, null, 2);

                        // Generate a user-friendly summary using AI
                        const summaryPrompt = `You are a helpful assistant. The user asked: "${workflow.intent}"

The workflow completed successfully with this result:
${resultStr.slice(0, 2000)}

Generate a brief, friendly, conversational response summarizing the result for the user. Be concise but informative. 
- If it's a list of files, mention how many were found and list their names briefly.
- If it's an email action, confirm it was sent.
- If it's a form, provide the link.
Do NOT return JSON. Return a natural language response.`;

                        const summary = await generateText(summaryPrompt);

                        // Send the friendly summary to the user
                        await this.addMessage(execution.context.sessionId, 'assistant', summary);
                        this.io?.to(`user:${execution.userId}`).emit('chat:response', {
                            sessionId: execution.context.sessionId,
                            content: summary,
                            role: 'assistant'
                        });
                    }
                } catch (summaryError) {
                    console.error('Failed to generate workflow summary:', summaryError);
                    // Fall back to workflow complete without summary
                }

                this.io?.emit(EVENTS_SERVER.WORKFLOW_COMPLETE, { workflowId: execution.workflowId });
            }
        } catch (error) {
            console.error('Workflow execution failed:', error);
            this.io?.emit(EVENTS_SERVER.WORKFLOW_ERROR, {
                workflowId: execution.workflowId,
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            if (execution.status !== 'paused') {
                this.activeExecutions.delete(execution.id);
                // Final update
                await db.update(executions).set({
                    status: 'completed',
                    completedAt: new Date()
                }).where(eq(executions.id, execution.id as any));
            }
        }
    }

    // Helper for uuid gen if needed, or just let DB handle it?
    // We need to insert generic tool steps too
    // For simplicity, let's just use the persistence logic inside executeStep which handles all tools.
    // Wait, I inserted persistence logic ONLY for TabManager above? No, I need it for ALL.

    // REFACTOR: Moving persistence to executeStep start/end to cover ALL tools
    // I will undo the change to TabManager block in next chunk and put it in executeStep.

    private async executeStep(
        execution: Execution,
        step: WorkflowStep,
        stepResults: Map<string, any>
    ): Promise<any> {
        // Notify step start
        this.io?.emit(EVENTS_SERVER.WORKFLOW_STEP_START, { workflowId: execution.workflowId, step });

        // Granular status update
        const statusMsg = step.description || `Running ${step.tool}...`;
        this.io?.emit('agent:status', { state: 'executing', message: statusMsg });

        // PERSISTENCE: Step Start
        // We use a query to check if it exists (retry capability?) or just insert? 
        // Simple append log for now.
        // Actually we want to update the status.
        await db.insert(stepExecutions).values({
            executionId: execution.id as any,
            stepId: step.id,
            status: 'running',
            startedAt: new Date()
        } as any).catch(err => console.error("Failed to log step start", err));

        try {
            console.log(`[Orchestrator] Executing step ${step.id} (DEPLOYMENT_CHECK_V3). Tool: '${step.tool}', Type: ${step.type}`);

            let result;
            if (step.type === 'tool' && step.tool) {
                const toolName = step.tool.trim();
                const toolNameLower = toolName.toLowerCase();

                // Check if tool is client-side or server-side (Case insensitive check)
                const WORKFLOW_CLIENT_TOOLS = ['tabmanager', 'notifier', 'domreader', 'formfiller', 'gmailscraper', 'screenshot', 'smartclick'];
                if (WORKFLOW_CLIENT_TOOLS.includes(toolNameLower)) {
                    console.log(`[Orchestrator] Routing ${toolName} to client.`);
                    result = await this.executeClientTool(
                        execution.id,
                        step.id,
                        toolName,
                        step.params,
                        undefined,  // socket (not available in workflows)
                        execution.userId  // userId for room broadcasting
                    );
                } else {
                    const adapter = adapterRegistry.getAll().find(a =>
                        toolName.startsWith(a.name + '_')
                    );

                    if (adapter && step.tool) {
                        const actionName = step.tool.replace(adapter.name + '_', '');
                        result = await adapter.execute(actionName, step.params, execution.context);
                    } else {
                        // Add fallback for direct tool name (e.g. "GmailScraper")
                        const toolDef = toolRegistry.get(toolName);
                        if (toolDef) {
                            console.log(`[Orchestrator] Executing direct tool ${toolName}`);
                            // Mock context if not provided by adapter
                            result = await (toolDef as any).execute(step.params, { ...execution.context, user: { id: execution.userId } } as any);
                        } else {
                            result = { status: 'skipped' };
                        }
                    }
                }
            } else {
                throw new Error(`Step type ${step.type} not supported or tool missing`);
            }

            // Notify step complete
            this.io?.emit(EVENTS_SERVER.WORKFLOW_STEP_COMPLETE, {
                workflowId: execution.workflowId,
                stepId: step.id,
                result
            });

            // PERSISTENCE: Step Complete
            await db.update(stepExecutions)
                .set({ status: 'completed', result: result as any, completedAt: new Date() })
                .where(eq(stepExecutions.executionId, execution.id as any) && eq(stepExecutions.stepId, step.id))
                .catch(err => {
                    // Fallback if update fails (maybe row didn't exist? though we inserted above)
                    // Or if we can't reliably match the row without the specific ID from insert.
                    console.error("Failed to log step complete", err);
                });

            // Update execution state for persistence/resume
            const execStep = execution.steps.find(s => s.stepId === step.id);
            if (execStep) {
                execStep.status = 'completed';
                execStep.result = result;
            }

            // Step completion logging (disabled to reduce UI clutter)
            // Users see the result in the final workflow summary instead
            if (execution.context?.sessionId) {
                const resultSummary = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 200) + '...';
                console.log(`[AgentOrchestrator] Step ${step.id} completed: ${resultSummary}`);

                // DISABLED: Step completion messages cluttered the UI
                // const messageContent = `✅ Step Completed: **${step.tool}**\\nResult: ${resultSummary}`;
                // await chatService.addMessage(execution.context.sessionId, 'assistant', messageContent, { stepId: step.id, type: 'step_result' });
                // this.io?.to(execution.context.sessionId).emit('chat:response', { ... });
            }

            return result;
        } catch (error) {
            console.error(`Step ${step.id} failed:`, error);

            // Log failure to chat history
            if (execution.context?.sessionId) {
                const messageContent = `❌ Step Failed: **${step.tool}**\nError: ${(error as Error).message}`;

                await chatService.addMessage(
                    execution.context.sessionId,
                    'assistant',
                    messageContent,
                    { stepId: step.id, type: 'step_error' }
                );

                this.io?.to(execution.context.sessionId).emit('chat:response', {
                    sessionId: execution.context.sessionId,
                    message: messageContent,
                    role: 'assistant',
                    timestamp: new Date(),
                    metadata: { stepId: step.id, type: 'step_error' }
                });

                this.io?.emit('chat:response', {
                    sessionId: execution.context.sessionId,
                    message: messageContent,
                    role: 'assistant',
                    timestamp: new Date(),
                    metadata: { stepId: step.id, type: 'step_error' }
                });
            }

            throw error;
        }
    }

    async executeDirectCommand(options: {
        tool: string;
        params: any;
        userId: string;
        sessionId: string;
        socket: any;  // Socket.IO socket instance
    }): Promise<any> {
        const { tool, params, userId, sessionId, socket } = options;

        console.log(`[DirectExecution] Executing ${tool} with params:`, params);

        // Client-side tools (TabManager, Notifier, DOMReader, FormFiller, GmailScraper)
        const CLIENT_SIDE_TOOLS = ['TabManager', 'Notifier', 'DOMReader', 'FormFiller', 'GmailScraper', 'Screenshot', 'SmartClick'];
        if (CLIENT_SIDE_TOOLS.includes(tool)) {
            const executionId = randomUUID();
            const stepId = randomUUID();

            return await this.executeClientTool(
                executionId,
                stepId,
                tool,
                params,
                socket,
                userId  // Pass userId for room broadcast
            );
        }

        // Server-side tools
        const toolDef = toolRegistry.get(tool);
        if (toolDef && (toolDef as any).execute) {
            return await (toolDef as any).execute(params, { userId, sessionId });
        }

        throw new Error(`Unknown tool for direct execution: ${tool}`);
    }

    private executeClientTool(
        executionId: string,
        stepId: string,
        tool: string,
        params: any,
        socket?: any,  // Optional for backward compatibility with workflows
        userId?: string  // Add userId for room broadcasting
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.io) {
                reject(new Error('No io instance available'));
                return;
            }

            // Generate unique request ID to prevent cross-contamination
            const requestId = `${executionId}_${stepId}`;
            console.log(`[ToolExecution] Starting client tool ${tool} with requestId: ${requestId}`);

            // CRITICAL: Always broadcast to user room for client-side tools
            // The background worker has a SEPARATE socket connection from the sidepanel
            // Using socket.emit() would only reach the sidepanel, not the background worker that handles tools
            if (userId) {
                console.log(`[ToolExecution] Broadcasting to room user:${userId}`);
                this.io.to(`user:${userId}`).emit(EVENTS_SERVER.TOOL_EXECUTE, {
                    executionId,
                    stepId,
                    tool,
                    params
                });
            } else {
                // Fallback - broadcast to all (for workflows without userId)
                console.warn('[ToolExecution] No userId - using broadcast fallback');
                this.io.emit(EVENTS_SERVER.TOOL_EXECUTE, {
                    executionId,
                    stepId,
                    tool,
                    params
                });
            }

            // 2. Setup one-time listener for result
            // CRITICAL: Always use io.on() because tool:result comes from the BACKGROUND WORKER socket,
            // not the sidepanel socket. Both are in the user room, but they're DIFFERENT sockets.
            const handleResult = (data: ToolExecutionResult) => {
                if (data.executionId === executionId && data.stepId === stepId) {
                    console.log(`[ToolExecution] Received result for requestId: ${requestId}`);
                    clearTimeout(timeoutHandle);

                    // Cleanup listener immediately
                    this.io?.off(EVENTS_CLIENT.TOOL_RESULT as any, handleResult);

                    if (data.status === 'success') {
                        resolve(data.result);
                    } else {
                        reject(new Error(data.error || 'Tool execution failed'));
                    }
                }
            };

            // 3. Listen for response from ANY client socket in the user's room
            // Background worker emits tool:result on its own socket, so we must use io.on()
            this.io.on(EVENTS_CLIENT.TOOL_RESULT as any, handleResult);

            // 4. Timeout with proper cleanup
            const timeoutHandle = setTimeout(() => {
                console.error(`[ToolExecution] Timeout for requestId: ${requestId}`);

                // Remove listener to prevent memory leak
                this.io?.off(EVENTS_CLIENT.TOOL_RESULT as any, handleResult);

                reject(new Error(`Tool execution timed out after 30s (${tool})`));
            }, 30000);
        });
    }

    async addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any) {
        await chatService.addMessage(sessionId, role, content, metadata);
    }

    async getConversationHistory(sessionId: string): Promise<string[]> {
        const messages = await chatService.getMessages(sessionId);
        // Format for context
        return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`);
    }

    getAvailableToolsContext(preferences?: any): string {
        const enabledTools = preferences?.enabledTools as string[] | undefined;
        // If enabledTools is defined but empty, it might mean "no tools enabled" or "not configured". 
        // Let's assume if it's undefined or null, we show ALL (default).
        // If it's an array (even empty), we respect it.
        const shouldFilter = Array.isArray(enabledTools);

        const clientTools = [
            '- Notifier: Show notifications to user. Params: { "action": "notify", "message": "text" }',
            '- TabManager: Manage browser tabs. Params: { "action": "get_active_tab" | "open_tab", "url": "..." }'
        ].join('\n');

        const aiTools = [
            '- AIProcessor: Process text. Params: { "action": "summarize" | "analyze" | "categorize", "content": "..." }'
        ].join('\n');

        const adapterTools = adapterRegistry.getAll().flatMap(adapter =>
            adapter.actions
                .filter(action => {
                    const toolName = `${adapter.name}_${action.name}`;
                    return !shouldFilter || enabledTools.includes(toolName);
                })
                .map(action => {
                    let outputHint = '';
                    if (adapter.name === 'GmailAdapter' && action.name === 'list_emails') {
                        outputHint = ' (Output: { emails: [{ subject, from, snippet, date, body }] })';
                    }
                    return `- ${adapter.name}_${action.name}: ${action.description} (Params: ${JSON.stringify(action.parameters)})${outputHint}`;
                })
        ).join('\n');

        const otherTools = toolRegistry.getAll()
            .filter(t => t.name !== 'Notifier' && t.name !== 'TabManager' && t.name !== 'AIProcessor' && !t.name.includes('_'))
            .filter(t => !shouldFilter || enabledTools.includes(t.name))
            .map(t => `- ${t.name}: ${t.description} (Params: ${JSON.stringify(t.parameters)})`)
            .join('\n');

        return `
CLIENT TOOLS (Browser/User Interface):
${clientTools}

AI CAPABILITIES:
${aiTools}

INTEGRATIONS (External Services):
${adapterTools}

OTHER TOOLS:
${otherTools}
`;
    }
}

export const orchestrator = new AgentOrchestrator();
