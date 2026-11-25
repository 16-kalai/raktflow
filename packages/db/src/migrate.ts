import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./index";

config({ path: new URL("../../../.env.local", import.meta.url).pathname });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const db = getDb({ url, max: 1 });
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
console.log("Migrations applied.");
await closeDb();
