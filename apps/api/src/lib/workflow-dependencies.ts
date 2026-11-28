/**
 * Workflow dependency resolution and parallel execution utilities
 */

import type { WorkflowStep } from '@extenda/shared';

export interface StepBatch {
    steps: WorkflowStep[];
    batchIndex: number;
}

export class WorkflowDependencyResolver {
    /**
     * Build dependency graph and resolve execution order
     */
    static resolveDependencies(steps: WorkflowStep[]): StepBatch[] {
        // Build adjacency list
        const graph = new Map<string, string[]>();
        const inDegree = new Map<string, number>();

        // Check if ANY dependencies are defined in the entire workflow
        const hasExplicitDependencies = steps.some(s => s.dependencies && s.dependencies.length > 0);

        // Initialize
        steps.forEach((step, index) => {
            let deps = [...new Set([...(step.dependencies || []), ...this.extractDependencies(step.params)])];

            // Fallback: If no dependencies are defined anywhere, assume sequential order
            // This prevents "race conditions" where AI forgets to define dependencies
            if (!hasExplicitDependencies && index > 0) {
                deps = [...new Set([...deps,steps[index - 1].id])];
                console.log(`[Validation] Inferring sequential dependency: ${step.id} -> ${steps[index - 1].id}`);
            }

            graph.set(step.id, deps);
            inDegree.set(step.id, 0);
        });

        // Calculate in-degrees
        graph.forEach((deps, stepId) => {
            deps.forEach(depId => {
                inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
            });
        });

        // Topological sort with batching (Kahn's algorithm)
        const batches: StepBatch[] = [];
        const processed = new Set<string>();
        let batchIndex = 0;

        while (processed.size < steps.length) {
            // Find all steps with no unprocessed dependencies
            // We look at the ORIGINAL steps array to filter, but check dependencies using our GRAPH
            const currentBatch = steps.filter(step => {
                if (processed.has(step.id)) return false;
                // Get dependencies from our potentially modified graph, NOT the step object directly
                const deps = graph.get(step.id) || [];
                // Check if all dependencies are processed. 
                // Note: We need to ensure we're checking if the dependency *exists* in processed set.
                // If a dependency is NOT in the processed set, we cannot run this step.
                return deps.every(depId => processed.has(depId));
            });

            if (currentBatch.length === 0) {
                // Circular dependency detected
                const remaining = steps.filter(s => !processed.has(s.id));
                throw new Error(
                    `Circular dependency or unresolved dependency detected in steps: ${remaining.map(s => s.id).join(', ')}`
                );
            }

            batches.push({
                steps: currentBatch,
                batchIndex: batchIndex++
            });

            currentBatch.forEach(step => processed.add(step.id));
        }

        return batches;
    }

    /**
     * Extract step IDs that this step depends on from parameters (via placeholders)
     */
    static extractDependencies(params: any): string[] {
        if (!params) return [];

        const paramsStr = JSON.stringify(params);
        const dependencies = new Set<string>();

        // Match both {{step-1.output}} and ${step-1.output} patterns
        // Use the same regex as injectResults for consistency
        const unifiedRegex = /(\${([^{}]+)})|(\{\{([^{}]+)\}\})/g;
        const matches = Array.from(paramsStr.matchAll(unifiedRegex));


        console.log(`[extractDependencies] Found ${matches.length} matches`);

        for (const m of matches) {
            const placeholder = m[0];
            let path = '';
            if (placeholder.startsWith('$')) {
                path = placeholder.slice(2, -1);
            } else {
                // {{...}} pattern - slice off {{ and }}
                path = placeholder.slice(2, -2);
            }

            // Strip pipes if present
            if (path.includes('|')) {
                path = path.split('|')[0].trim();
            }

            // Extract step ID from path like "step-1.output" or "steps.step-1.result"
            const parts = path.split('.');
            let stepId = parts[0];
            if (stepId === 'steps' && parts.length > 1) {
                stepId = parts[1];
            }

            if (stepId) {
                console.log(`[extractDependencies] Found dependency: ${stepId} from ${placeholder}`);
                dependencies.add(stepId);
            }
        }

        return Array.from(dependencies);
    }

    /**
     * Inject results from previous steps into parameters
     */
    /**
     * Inject results from previous steps into parameters
     */
    static injectResults(
        params: any,
        stepResults: Map<string, any>
    ): any {
        if (Array.isArray(params)) return params.map(value=>this.injectResults(value,stepResults));
        if (params && typeof params==='object') return Object.fromEntries(Object.entries(params).map(([key,value])=>[key,this.injectResults(value,stepResults)]));
        if (typeof params!=='string') return params;
        const reference = /\$\{([^{}]+)\}|\{\{([^{}]+)\}\}/g;
        const resolve = (path:string) => {
            const value=this.getValueFromPath(path.split('|')[0].trim(),stepResults);
            if (value===undefined) throw new Error('Workflow dependency unavailable: '+path);
            return value;
        };
        const matches=[...params.matchAll(reference)];
        if (matches.length===1 && matches[0][0]===params) return resolve(matches[0][1] || matches[0][2]);
        return params.replace(reference,(_,a,b)=>{
            const value=resolve(a || b);
            return typeof value==='object' ? JSON.stringify(value) : String(value);
        });
    }

    /**
     * Get value from path like "step1.result.email"
     */
    private static getValueFromPath(
        path: string,
        stepResults: Map<string, any>
    ): any {
        const parts = path.split('.');

        // Handle "steps.step-1.result" vs "step-1.result"
        let stepId = parts[0];
        let startIndex = 1;

        if (stepId === 'steps' && parts.length > 1) {
            stepId = parts[1];
            startIndex = 2; // Skip 'steps' and 'stepId'
        }

        const stepResult = stepResults.get(stepId);

        if (stepResult === undefined) {
            // Fuzzy search? Check if we have a stepId that ends with this name?
            // console.warn(`[DependencyResolver] Step ID ${stepId} not found in results: ${Array.from(stepResults.keys())}`);
            return undefined;
        }

        // Navigate path
        let value = stepResult;
        for (let i = startIndex; i < parts.length; i++) {
            const part = parts[i];

            // Robustness: Handle "step.result.field" or "step.output.field" vs "step.field"
            // If the AI uses "result" or "output" property but it doesn't exist, skip it 
            // and treat the current object as the result/output directly.
            if (i === startIndex && (part === 'result' || part === 'output') && value && value[part] === undefined) {
                // Skip 'result' or 'output' if it's not explicitly in the object
                console.log(`[DependencyResolver] Skipping non-existent '${part}' wrapper, treating step result as direct output`);
                continue;
            }

            // Robustness: Handle AI using 'files', 'items', 'emails', 'messages', 'results' etc when value IS already an array
            // E.g., AI writes step-1.output.files.length but output is already [file1, file2, ...]
            if (Array.isArray(value) && ['files', 'items', 'emails', 'messages', 'results', 'data', 'records', 'list'].includes(part)) {
                console.log(`[DependencyResolver] Skipping '${part}' - value is already an array of ${value.length} items`);
                continue;
            }

            // Robustness: Handle AI trying to access an index on an object that wraps an array
            // E.g., AI writes step-1.output.0 but output is { emails: [...] }
            if (value && typeof value === 'object' && !Array.isArray(value) && !isNaN(Number(part))) {
                const arrayProps = Object.values(value).filter(v => Array.isArray(v));
                if (arrayProps.length === 1) {
                    console.log(`[DependencyResolver] Auto-unwrapping object to array for index '${part}' access`);
                    value = arrayProps[0];
                } else if (value.emails && Array.isArray(value.emails)) {
                    value = value.emails;
                } else if (value.messages && Array.isArray(value.messages)) {
                    value = value.messages;
                } else if (value.data && Array.isArray(value.data)) {
                    value = value.data;
                } else if (value.items && Array.isArray(value.items)) {
                    value = value.items;
                }
            }

            value = value?.[part];
            if (value === undefined) break;
        }

        return value;
    }

    /**
     * Evaluate condition expression
     */
    static evaluateCondition(
        expression: string,
        stepResults: Map<string, any>
    ): boolean {
        const operand = (source: string) => {
            const variable = /^\$\{([^{}]+)\}$/.exec(source.trim());
            return variable ? this.getValueFromPath(variable[1], stepResults) : JSON.parse(source.trim());
        };
        const comparison = /^(.+?)\s*(===|!==|>|<)\s*(.+)$/.exec(expression);
        if (!comparison) return Boolean(operand(expression));
        const left = operand(comparison[1]);
        const right = operand(comparison[3]);
        switch (comparison[2]) {
            case '===': return left === right;
            case '!==': return left !== right;
            case '>': return left > right;
            default: return left < right;
        }
    }
}
