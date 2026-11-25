import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { banks, closeDb, getDb, transfusions } from "../index";
import { DEMO_PATIENTS } from "../seed-data";
config({ path: new URL("../../../../.env.local", import.meta.url).pathname, quiet: true });
/** One-off: replace the demo bank's transfusions with full patient records. */
const db = getDb({ max: 1 });
const [bank] = await db.select().from(banks).where(eq(banks.slug, "sahyog-pune"));
if (!bank) throw new Error("demo bank missing");
await db.delete(transfusions).where(eq(transfusions.bankId, bank.id));
await db.insert(transfusions).values(DEMO_PATIENTS.map((p) => ({ bankId: bank.id, ...p })));
console.log(`patients: ${DEMO_PATIENTS.length}`);
await closeDb();
