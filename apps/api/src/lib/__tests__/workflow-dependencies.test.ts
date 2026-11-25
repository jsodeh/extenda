import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkflowStep } from '@extenda/shared';
import { WorkflowDependencyResolver } from '../workflow-dependencies.js';

describe('WorkflowDependencyResolver', () => {
    describe('resolveDependencies', () => {
        it('should resolve simple dependency chain', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test' },
                { id: 'B', type: 'tool', tool: 'test', dependencies: ['A'] },
                { id: 'C', type: 'tool', tool: 'test', dependencies: ['B'] }
            ];

            const batches = WorkflowDependencyResolver.resolveDependencies(steps);

            assert.equal(batches.length, 3);
            assert.deepEqual(batches[0].steps.map(s => s.id), ['A']);
            assert.deepEqual(batches[1].steps.map(s => s.id), ['B']);
            assert.deepEqual(batches[2].steps.map(s => s.id), ['C']);
        });

        it('should identify parallel steps', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test' },
                { id: 'B', type: 'tool', tool: 'test' },
                { id: 'C', type: 'tool', tool: 'test' },
                { id: 'D', type: 'tool', tool: 'test', dependencies: ['A', 'B', 'C'] }
            ];

            const batches = WorkflowDependencyResolver.resolveDependencies(steps);

            assert.equal(batches.length, 2);
            assert.equal(batches[0].steps.length, 3); // A, B, C in parallel
            assert.deepEqual(batches[1].steps.map(s => s.id), ['D']);
        });

        it('should detect circular dependencies', () => {
            const steps: WorkflowStep[] = [
                { id: 'A', type: 'tool', tool: 'test', dependencies: ['B'] },
                { id: 'B', type: 'tool', tool: 'test', dependencies: ['A'] }
            ];

            assert.throws(() => {
                WorkflowDependencyResolver.resolveDependencies(steps);
            }, /Circular dependency/);
        });
    });

    describe('injectResults', () => {
        it('should inject simple result', () => {
            const params = { email: '${step1.result}' };
            const stepResults = new Map([['step1', 'test@example.com']]);

            const result = WorkflowDependencyResolver.injectResults(params, stepResults);

            assert.equal(result.email, 'test@example.com');
        });

        it('should inject nested result', () => {
            const params = { email: '${step1.result.email}' };
            const stepResults = new Map([['step1', { email: 'test@example.com' }]]);

            const result = WorkflowDependencyResolver.injectResults(params, stepResults);

            assert.equal(result.email, 'test@example.com');
        });
    });

    describe('evaluateCondition', () => {
        it('should evaluate equality condition', () => {
            const expression = '${step1.result} === "success"';
            const stepResults = new Map([['step1', 'success']]);

            const result = WorkflowDependencyResolver.evaluateCondition(expression, stepResults);

            assert.equal(result, true);
        });

        it('should evaluate greater than condition', () => {
            const expression = '${step1.result.count} > 5';
            const stepResults = new Map([['step1', { count: 10 }]]);

            const result = WorkflowDependencyResolver.evaluateCondition(expression, stepResults);

            assert.equal(result, true);
        });
    });
});
