import { WorkflowDependencyResolver, WorkflowStep } from '../workflow-dependencies';

describe('WorkflowDependencyResolver', () => {
    describe('resolveDependencies', () => {
        it('should resolve simple dependency chain', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test' },
                { id: 'B', type: 'tool', tool: 'test', dependencies: ['A'] },
                { id: 'C', type: 'tool', tool: 'test', dependencies: ['B'] }
            ];

            const batches = WorkflowDependencyResolver.resolveDependencies(steps);

            expect(batches).toHaveLength(3);
            expect(batches[0].steps.map(s => s.id)).toEqual(['A']);
            expect(batches[1].steps.map(s => s.id)).toEqual(['B']);
            expect(batches[2].steps.map(s => s.id)).toEqual(['C']);
        });

        it('should identify parallel steps', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test' },
                { id: 'B', type: 'tool', tool: 'test' },
                { id: 'C', type: 'tool', tool: 'test' },
                { id: 'D', type: 'tool', tool: 'test', dependencies: ['A', 'B', 'C'] }
            ];

            const batches = WorkflowDependencyResolver.resolveDependencies(steps);

            expect(batches).toHaveLength(2);
            expect(batches[0].steps).toHaveLength(3); // A, B, C in parallel
            expect(batches[1].steps.map(s => s.id)).toEqual(['D']);
        });

        it('should detect circular dependencies', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test', dependencies: ['B'] },
                { id: 'B', type: 'tool', tool: 'test', dependencies: ['A'] }
            ];

            expect(() => {
                WorkflowDependencyResolver.resolveDependencies(steps);
            }).toThrow('Circular dependency');
        });
    });

    describe('injectResults', () => {
        it('should inject simple result', () => {
            const params = { email: '${step1.result}' };
            const stepResults = new Map([['step1', 'test@example.com']]);

            const result = WorkflowDependencyResolver.injectResults(params, stepResults);

            expect(result.email).toBe('test@example.com');
        });

        it('should inject nested result', () => {
            const params = { email: '${step1.result.email}' };
            const stepResults = new Map([['step1', { email: 'test@example.com' }]]);

            const result = WorkflowDependencyResolver.injectResults(params, stepResults);

            expect(result.email).toBe('test@example.com');
        });
    });

    describe('evaluateCondition', () => {
        it('should evaluate equality condition', () => {
            const expression = '${step1.result} === "success"';
            const stepResults = new Map([['step1', 'success']]);

            const result = WorkflowDependencyResolver.evaluateCondition(expression, stepResults);

            expect(result).toBe(true);
        });

        it('should evaluate greater than condition', () => {
            const expression = '${step1.result.count} > 5';
            const stepResults = new Map([['step1', { count: 10 }]]);

            const result = WorkflowDependencyResolver.evaluateCondition(expression, stepResults);

            expect(result).toBe(true);
        });
    });
});
