import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/infrastructure/db";
import * as schema from "@/infrastructure/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: false,
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        const bcrypt = await import("bcryptjs");
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        const bcrypt = await import("bcryptjs");
        return await bcrypt.compare(password, hash);
      },
    },
  },
  user: { modelName: "usersTable" },
  session: { modelName: "sessionsTable" },
  account: { modelName: "accountsTable" },
  verification: { modelName: "verificationsTable" },
  plugins: [nextCookies()],
});
