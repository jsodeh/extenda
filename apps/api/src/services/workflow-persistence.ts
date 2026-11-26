import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { executions } from '../db/schema.js';

export class WorkflowPersistence {
    static async touch(id: string, owner: string) {
        const result = await pool.query(
            "UPDATE executions SET context=context || jsonb_build_object('lastActivity',extract(epoch from now())) WHERE id=$1 AND user_id=$2 AND status='running'",
            [id, owner]
        );
        if (!result.rowCount) throw new Error('Execution is no longer running. Check its history.');
    }

    static async recoverInterrupted() {
        // No replay after a crash during a remote write. A recorded review remains resumable.
        await pool.query(`UPDATE executions SET status='failed',completed_at=now(),
            error='{"message":"Workflow interrupted. Verify any external action before starting again."}'::jsonb
            WHERE status='running' AND (CASE WHEN jsonb_typeof(context->'lastActivity')='number' THEN (context->>'lastActivity')::numeric
                ELSE extract(epoch from started_at::timestamptz) END) < extract(epoch from now()-interval '30 minutes')`);
    }

    static async claimReview(id: string, owner: string, digest: string, approved: boolean) {
        const [claimed] = await db
            .update(executions)
            .set({
                status: approved ? 'running' : 'cancelled',
                context: sql`${executions.context} || jsonb_build_object('lastActivity',extract(epoch from now()))`
            })
            .where(
                and(
                    eq(executions.id, id),
                    eq(executions.userId, owner),
                    eq(executions.status, 'paused'),
                    sql`${executions.context}->>'approval' = ${digest}`
                )
            )
            .returning({ context: executions.context });
        if (!claimed) throw new Error('This approval expired or was already used');
        return claimed.context as { review?: { id: string } };
    }

    static async cancel(id: string, owner: string) {
        const [row] = await db
            .update(executions)
            .set({ status: 'cancelled', completedAt: new Date() })
            .where(
                and(
                    eq(executions.id, id),
                    eq(executions.userId, owner),
                    inArray(executions.status, ['pending', 'running', 'paused'])
                )
            )
            .returning({ workflowId: executions.workflowId });
        if (!row) throw new Error('No cancellable workflow');
        return row.workflowId;
    }
}
