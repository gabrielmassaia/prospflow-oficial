import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { usersTable } from "@/infrastructure/db/schema";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: DB) {}

  async findById(id: string) {
    const result = await this.db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return result[0] ?? null;
  }
}
