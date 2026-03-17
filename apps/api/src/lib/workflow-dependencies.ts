/**
 * Workflow dependency resolution and parallel execution utilities
 */

import { WorkflowStep } from '@extenda/shared';

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
            let deps = step.dependencies || [];

            // Fallback: If no dependencies are defined anywhere, assume sequential order
            // This prevents "race conditions" where AI forgets to define dependencies
            if (!hasExplicitDependencies && index > 0) {
                deps = [steps[index - 1].id];
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

        console.log(`[extractDependencies] Params: ${paramsStr.substring(0, 200)}...`);
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
        if (!params) return params;

        const paramsStr = JSON.stringify(params);
        let result = paramsStr;

        // MATCH BOTH PATTERNS: 
        // 1. ${stepId.path} -> Standard JS-like template
        // 2. {{stepId.path}} -> Mustache/Handlebars style (commonly used by LLMs)
        const regex = /(\$|\{)\{([^}]+)\}\}?/g;

        // We will process matches and replace them
        // Note: matchAll returns an iterator.

        // We need to capture the variable path.
        // For ${foo}, Match 1 is '$', Match 2 is 'foo'
        // For {{foo}}, Match 1 is '{', Match 2 is 'foo' (roughly, need to be careful with regex)

        // Let's use a simpler approach: multiple replacers or a unified regex.
        // Unified regex: /(\${([^{}]+)})|(\{\{([^{}]+)\}\})/g
        const unifiedRegex = /(\${([^{}]+)})|(\{\{([^{}]+)\}\})/g;

        const matches = Array.from(result.matchAll(unifiedRegex));

        // Iterate matches and replace
        // Since replacing changes string length, we should replace strings uniquely or do simpler replace call.
        // But JSON.stringify replacement is tricky if we replace with Objects.

        // Better approach:
        // If the WHOLE string is a variable, e.g. "{{step1.result}}", we should return the OBJECT directly if possible
        // but parameters are usually a complex object.

        // Let's iterate over unique matches found to avoid re-scanning modified string issues?
        // Or just let string replacement replace all occurrences.

        // Get unique placeholders first
        const placeholders = new Set<string>();
        for (const m of matches) {
            placeholders.add(m[0]); // The full match string, e.g. {{step1.output}}
        }

        for (const placeholder of placeholders) {
            // Extract path. 
            // If starts with $, path is inside ${...} -> slice(2, -1)
            // If starts with {, path is inside {{...}} -> slice(2, -2)
            let path = '';
            if (placeholder.startsWith('$')) {
                path = placeholder.slice(2, -1);
            } else {
                path = placeholder.slice(2, -2);
            }

            // ROBUSTNESS: Strip any pipes/filters the AI might have hallucinated (e.g. {{step.output | map...}})
            if (path.includes('|')) {
                console.log(`[DependencyResolver] Stripping pipe from path: ${path}`);
                path = path.split('|')[0].trim();
            } else {
                path = path.trim(); // Ensure no leading/trailing spaces
            }

            const value = this.getValueFromPath(path, stepResults);

            if (value !== undefined) {
                console.log(`[DependencyResolver] Injecting ${path} with type ${typeof value}`);

                // CRITICAL: Handle the replacement carefully to preserve JSON validity.
                const quotedPlaceholder = `"${placeholder}"`;

                if (result.includes(quotedPlaceholder)) {
                    result = result.replace(quotedPlaceholder, JSON.stringify(value));
                } else {
                    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    const safeStrValue = JSON.stringify(strValue).slice(1, -1);
                    result = result.replace(placeholder, safeStrValue);
                }
            } else {
                console.warn(`[DependencyResolver] Context variable not found: ${path} (Placeholder: ${placeholder})`);
            }
        }

        try {
            return JSON.parse(result);
        } catch (e) {
            return params;
        }
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

        if (!stepResult) {
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
        try {
            // Replace ${step.result} with actual values
            let evalExpr = expression;
            const matches = expression.matchAll(/\$\{([^}]+)\}/g);

            for (const match of matches) {
                const value = this.getValueFromPath(match[1], stepResults);
                evalExpr = evalExpr.replace(match[0], JSON.stringify(value));
            }

            // Safe evaluation (very basic, consider using a proper expression evaluator)
            // For now, support simple comparisons
            if (evalExpr.includes('===')) {
                const [left, right] = evalExpr.split('===').map(s => s.trim());
                return eval(left) === eval(right);
            }
            if (evalExpr.includes('!==')) {
                const [left, right] = evalExpr.split('!==').map(s => s.trim());
                return eval(left) !== eval(right);
            }
            if (evalExpr.includes('>')) {
                const [left, right] = evalExpr.split('>').map(s => s.trim());
                return eval(left) > eval(right);
            }
            if (evalExpr.includes('<')) {
                const [left, right] = evalExpr.split('<').map(s => s.trim());
                return eval(left) < eval(right);
            }

            // Default: try to evaluate as boolean
            return Boolean(eval(evalExpr));
        } catch (error) {
            console.error('Condition evaluation failed:', error);
            return false;
        }
    }
}
