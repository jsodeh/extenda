import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/extenda',
});

export class WorkflowPersistence {
    /**
     * Save workflow state
     */
    static async saveState(
        executionId: string,
        state: any,
        canResume: boolean = true
    ): Promise<void> {
        await pool.query(
            `UPDATE executions 
             SET state = $1, can_resume = $2, updated_at = NOW()
             WHERE id = $1`,
            [state, canResume, executionId]
        );
    }

    /**
     * Pause workflow
     */
    static async pauseWorkflow(executionId: string): Promise<void> {
        await pool.query(
            `UPDATE executions 
             SET paused_at = NOW(), can_resume = true
             WHERE id = $1`,
            [executionId]
        );
    }

    /**
     * Resume workflow
     */
    static async resumeWorkflow(executionId: string): Promise<any> {
        const result = await pool.query(
            `UPDATE executions 
             SET resumed_at = NOW(), paused_at = NULL
             WHERE id = $1
             RETURNING state`,
            [executionId]
        );

        return result.rows[0]?.state;
    }

    /**
     * Get resumable workflows for user
     */
    static async getResumableWorkflows(userId: number): Promise<any[]> {
        const result = await pool.query(
            `SELECT e.id, e.workflow_id, e.state, e.paused_at, w.name, w.intent
             FROM executions e
             JOIN workflows w ON e.workflow_id = w.id
             WHERE e.user_id = $1 AND e.can_resume = true AND e.paused_at IS NOT NULL
             ORDER BY e.paused_at DESC
             LIMIT 10`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Mark workflow as non-resumable
     */
    static async markComplete(executionId: string): Promise<void> {
        await pool.query(
            `UPDATE executions SET can_resume = false WHERE id = $1`,
            [executionId]
        );
    }
}
