import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../index";
config({ path: new URL("../../../../.env.local", import.meta.url).pathname, quiet: true });
/** Demo helper: retry the demo contact's queued call now instead of after its backoff. */
const db = getDb({ max: 1 });
const r = await db.execute(sql`update call_jobs set next_attempt_at = now(), last_error = null
  where status = 'queued' and donor_id = (select id from donors where ref = 'donor_8f3a') returning id`);
console.log(`retrying ${r.rowCount} demo call job(s) now`);
await closeDb();
