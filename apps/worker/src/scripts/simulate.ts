import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { campaigns, closeDb, getDb } from "@raktflow/db";
import { simulateBookings } from "@raktflow/domain";
config({ path: new URL("../../../../.env.local", import.meta.url).pathname, quiet: true });
/** Demo helper: book N test donors into the active campaign. */
const n = Number(process.argv[2] ?? 10);
const db = getDb({ max: 2 });
const [c] = await db.select().from(campaigns).where(eq(campaigns.status, "active")).limit(1);
if (!c) { console.log("no active campaign"); process.exit(0); }
console.log(`booked ${await simulateBookings(db, c.bankId, c, n)} test donors`);
await closeDb();
