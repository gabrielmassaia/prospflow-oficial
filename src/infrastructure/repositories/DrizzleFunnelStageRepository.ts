import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateFunnelStageData,
  FunnelStage,
  IFunnelStageRepository,
} from "@/domain/repositories/IFunnelStageRepository";
import { funnelStagesTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleFunnelStageRepository implements IFunnelStageRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<FunnelStage[]> {
    return this.db
      .select()
      .from(funnelStagesTable)
      .where(eq(funnelStagesTable.companyId, companyId))
      .orderBy(funnelStagesTable.position);
  }

  async findById(id: string, companyId: string): Promise<FunnelStage | null> {
    const [row] = await this.db
      .select()
      .from(funnelStagesTable)
      .where(and(eq(funnelStagesTable.id, id), eq(funnelStagesTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async countByCompany(companyId: string): Promise<number> {
    const rows = await this.db
      .select({ id: funnelStagesTable.id })
      .from(funnelStagesTable)
      .where(eq(funnelStagesTable.companyId, companyId));
    return rows.length;
  }

  async bulkCreate(stages: CreateFunnelStageData[]): Promise<FunnelStage[]> {
    return this.db.insert(funnelStagesTable).values(stages).returning();
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<CreateFunnelStageData>
  ): Promise<FunnelStage> {
    const [row] = await this.db
      .update(funnelStagesTable)
      .set(data)
      .where(and(eq(funnelStagesTable.id, id), eq(funnelStagesTable.companyId, companyId)))
      .returning();
    return row;
  }
}
