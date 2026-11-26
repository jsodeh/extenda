import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Execution, Workflow } from '@extenda/shared';

it(
    'consumes one owner-bound review per resolved write, survives restart, cancels and records required failures',
    { skip: !process.env.TEST_DATABASE_URL },
    async () => {
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
        const { pool } = await import('../../db/index.js');
        const { runMigrations } = await import('../../db/migrate.js');
        const { AgentOrchestrator } = await import('../../services/orchestrator.js');
        const { toolRegistry } = await import('../../tools/registry.js');
        const owner = randomUUID();
        const events: any[] = [];
        const server = {
            to: (room: string) => ({
                emit: (type: string, payload: any) => events.push({ room, type, ...payload })
            })
        };
        const runner = () => {
            const r = new AgentOrchestrator();
            r.setServer(server as any);
            return r;
        };
        const writes: string[] = [];
        toolRegistry.register({
            name: 'FixtureAdapter_get_record',
            execute: async () => ({ answer: 'verified' })
        } as any);
        toolRegistry.register({
            name: 'FixtureAdapter_write',
            execute: async (params: any) => {
                writes.push(params.value);
                return { ok: true };
            }
        } as any);
        toolRegistry.register({
            name: 'FixtureAdapter_get_failure',
            execute: async () => ({ success: false, error: 'required step failed' })
        } as any);
        const start = async (tools: string[]) => {
            const steps = tools.map((tool, i) => ({
                id: 's' + i,
                type: 'tool',
                tool,
                params: i ? { value: '{{s0.result.answer}}' } : {},
                dependencies: i ? ['s0'] : []
            }));
            const id = randomUUID();
            const workflow = {
                id,
                userId: owner,
                name: 'Fixture',
                intent: 'Fixture',
                definition: { steps },
                version: 1
            } as Workflow;
            await pool.query('INSERT INTO workflows(id,user_id,name,intent,definition) VALUES($1,$2,$3,$3,$4)', [
                id,
                owner,
                'Fixture',
                { steps }
            ]);
            const execution: Execution = {
                id: randomUUID(),
                userId: owner,
                workflowId: id,
                startedAt: new Date(),
                status: 'pending',
                context: { timestamp: new Date(), modelConfig: { apiKey: 'fixture-never-persist' } },
                steps: steps.map((s) => ({ stepId: s.id, status: 'pending', retryCount: 0 }))
            };
            await runner().execute(execution, workflow, false);
            return execution.id;
        };
        const state = async (id: string) =>
            (await pool.query('SELECT status,context FROM executions WHERE id=$1', [id])).rows[0];
        await runMigrations();
        try {
            await pool.query('INSERT INTO users(id,email) VALUES($1,$2)', [owner, owner + '@example.test']);
            const id = await start(['FixtureAdapter_get_record', 'FixtureAdapter_write', 'FixtureAdapter_write']);
            const paused = await state(id);
            assert.equal(paused.status, 'paused');
            assert.equal(paused.context.review.params.value, 'verified');
            assert.doesNotMatch(JSON.stringify(paused.context), /fixture-never-persist/);
            await assert.rejects(runner().resume(id, randomUUID(), true, paused.context.approval));
            const responses = await Promise.allSettled([
                runner().resume(id, owner, true, paused.context.approval),
                runner().resume(id, owner, true, paused.context.approval)
            ]);
            assert.equal(responses.filter((r) => r.status === 'fulfilled').length, 1);
            assert.deepEqual(writes, ['verified']);
            const next = await state(id);
            assert.equal(next.status, 'paused');
            assert.notEqual(paused.context.approval, next.context.approval);
            await runner().cancel(id, owner);
            assert.equal((await state(id)).status, 'cancelled');
            await assert.rejects(runner().resume(id, owner, true, next.context.approval));
            assert.equal(writes.length, 1);
            assert.equal((await state(await start(['FixtureAdapter_get_failure']))).status, 'failed');
            const interrupted = await start(['FixtureAdapter_write']);
            await pool.query(
                "UPDATE executions SET status='running',started_at=now()-interval '1 hour' WHERE id=$1",
                [interrupted]
            );
            const { WorkflowPersistence } = await import('../../services/workflow-persistence.js');
            await WorkflowPersistence.recoverInterrupted();
            assert.equal((await state(interrupted)).status, 'failed');
            assert.deepEqual(writes, ['verified']);
            assert.ok(events.every((e) => e.room === 'user:' + owner));
        } finally {
            await pool.query('DELETE FROM users WHERE id=$1', [owner]);
            await pool.end();
        }
    }
);
