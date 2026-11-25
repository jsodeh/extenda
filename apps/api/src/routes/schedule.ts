import { Hono } from 'hono';
import { authMiddleware, AuthEnv } from '../lib/auth.js';
import { pool } from '../db/index.js';
import { validTimezone } from '../lib/scheduling.js';
const schedule=new Hono<AuthEnv>();
schedule.use('*',authMiddleware);
schedule.get('/',async c=>{
    const {rows}=await pool.query('SELECT id,action,due_at,timezone,recurrence,status,result,approved_payload FROM scheduled_jobs WHERE user_id=$1 ORDER BY due_at DESC LIMIT 100',[c.get('user').id]);
    return c.json({jobs:rows, timezone:(c.get('user').settings as any)?.timezone || 'UTC'});
});
schedule.put('/timezone',async c=>{
    try {
        const timezone=validTimezone((await c.req.json()).timezone);
        await pool.query("UPDATE users SET settings=coalesce(settings,'{}') || $2::jsonb WHERE id=$1",[c.get('user').id,{timezone}]);
        return c.json({timezone});
    } catch { return c.json({error:'Invalid timezone'},400); }
});
schedule.post('/reminders',async c=>{
    const {rows}=await pool.query(`UPDATE personal_reminders r SET delivered=true FROM scheduled_jobs j
        WHERE r.job_id=j.id AND j.user_id=$1 AND NOT r.delivered RETURNING r.message`,[c.get('user').id]);
    return c.json(rows);
});
schedule.delete('/:id',async c=>{
    const r=await pool.query("UPDATE scheduled_jobs SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending'",[c.req.param('id'),c.get('user').id]);
    return r.rowCount ? c.json({success:true}) : c.json({error:'Job unavailable or already claimed'},409);
});
export default schedule;
