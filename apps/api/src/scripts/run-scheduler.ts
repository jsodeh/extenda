import '../env.js';
import { executeDueJobs } from '../services/scheduler.js';
import { pool } from '../db/index.js';
try { await executeDueJobs(); } finally { await pool.end(); }
