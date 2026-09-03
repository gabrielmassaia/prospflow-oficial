import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { companiesTable, companyMembersTable } from "@/infrastructure/db/schema";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleCompanyRepository implements ICompanyRepository {
  constructor(private db: DB) {}

  async create(data: { name: string; slug: string; ownerId: string }) {
    return await this.db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companiesTable)
        .values({ name: data.name, slug: data.slug, ownerId: data.ownerId })
        .returning({ id: companiesTable.id, name: companiesTable.name, slug: companiesTable.slug });

      await tx.insert(companyMembersTable).values({
        companyId: company.id,
        userId: data.ownerId,
        role: "owner",
      });

      return company;
    });
  }

  async findByUserId(userId: string) {
    const result = await this.db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        slug: companiesTable.slug,
      })
      .from(companyMembersTable)
      .innerJoin(companiesTable, eq(companyMembersTable.companyId, companiesTable.id))
      .where(eq(companyMembersTable.userId, userId))
      .limit(1);

    return result[0] ?? null;
  }
}
