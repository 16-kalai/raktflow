import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { banks, getDb, memberships, schema } from "@raktflow/db";

/**
 * Email + password accounts. New users join the demo bank as coordinators;
 * a real deployment would invite users into their own bank instead.
 */
function createAuth() {
  const db = getDb();
  return betterAuth({
  appName: "RaktFlow",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  rateLimit: { enabled: true, window: 60, max: 30 },
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          const [demo] = await db.select({ id: banks.id }).from(banks).where(eq(banks.slug, "sahyog-pune")).limit(1);
          if (demo) await db.insert(memberships).values({ userId: created.id, bankId: demo.id, role: "coordinator" }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
/** Created on first use, so builds don't need a database connection. */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
