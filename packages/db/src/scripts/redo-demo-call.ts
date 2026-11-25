import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../index";
config({ path: new URL("../../../../.env.local", import.meta.url).pathname, quiet: true });
/** Demo helper: put the demo contact's finished call back in the queue so it rings again. */
const db = getDb({ max: 1 });
const r = await db.execute(sql`update call_jobs set status='queued', outcome=null, next_attempt_at=now(), claimed_by=null,
  lease_until=null, sarvam_attempt_id=null, transcript=null, health_answers=null, last_error=null, simulated=false
  where donor_id = (select id from donors where ref='donor_8f3a')
    and campaign_id = (select id from campaigns where status='active' order by created_at desc limit 1) returning id`);
console.log(`requeued ${r.rowCount} demo call`);
await closeDb();
