import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { CreateNicheData, INicheRepository, Niche } from "@/domain/repositories/INicheRepository";
import { prospectingNichesTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleNicheRepository implements INicheRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<Niche[]> {
    return this.db
      .select()
      .from(prospectingNichesTable)
      .where(eq(prospectingNichesTable.companyId, companyId))
      .orderBy(prospectingNichesTable.createdAt);
  }

  async findById(id: string, companyId: string): Promise<Niche | null> {
    const [row] = await this.db
      .select()
      .from(prospectingNichesTable)
      .where(and(eq(prospectingNichesTable.id, id), eq(prospectingNichesTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async create(data: CreateNicheData): Promise<Niche> {
    const [row] = await this.db.insert(prospectingNichesTable).values(data).returning();
    return row;
  }

  async update(id: string, companyId: string, data: Partial<CreateNicheData>): Promise<Niche> {
    const [row] = await this.db
      .update(prospectingNichesTable)
      .set(data)
      .where(and(eq(prospectingNichesTable.id, id), eq(prospectingNichesTable.companyId, companyId)))
      .returning();
    return row;
  }

  async delete(id: string, companyId: string): Promise<void> {
    await this.db
      .delete(prospectingNichesTable)
      .where(and(eq(prospectingNichesTable.id, id), eq(prospectingNichesTable.companyId, companyId)));
  }
}
