import '../env.js';
import { WorkflowPersistence } from '../services/workflow-persistence.js';
import { executeDueJobs } from '../services/scheduler.js';
import { pool } from '../db/index.js';
try {
    await WorkflowPersistence.recoverInterrupted();
    await executeDueJobs();
} finally {
    await pool.end();
}
