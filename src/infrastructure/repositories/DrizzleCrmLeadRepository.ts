import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateCrmLeadData,
  CrmLead,
  ICrmLeadRepository,
} from "@/domain/repositories/ICrmLeadRepository";
import { crmLeadsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;
type CrmLeadRow = typeof crmLeadsTable.$inferSelect;

function toDomain(row: CrmLeadRow): CrmLead {
  return { ...row, value: row.value == null ? null : Number(row.value) };
}

function normalizeValue(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value == null ? null : String(value);
}

export class DrizzleCrmLeadRepository implements ICrmLeadRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<CrmLead[]> {
    const rows = await this.db
      .select()
      .from(crmLeadsTable)
      .where(eq(crmLeadsTable.companyId, companyId))
      .orderBy(crmLeadsTable.createdAt);
    return rows.map(toDomain);
  }

  async findById(id: string, companyId: string): Promise<CrmLead | null> {
    const [row] = await this.db
      .select()
      .from(crmLeadsTable)
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByProspectingLeadId(
    prospectingLeadId: string,
    companyId: string
  ): Promise<CrmLead | null> {
    const [row] = await this.db
      .select()
      .from(crmLeadsTable)
      .where(
        and(
          eq(crmLeadsTable.prospectingLeadId, prospectingLeadId),
          eq(crmLeadsTable.companyId, companyId)
        )
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findConvertedProspectingLeadIds(companyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ prospectingLeadId: crmLeadsTable.prospectingLeadId })
      .from(crmLeadsTable)
      .where(eq(crmLeadsTable.companyId, companyId));
    return rows
      .map((r) => r.prospectingLeadId)
      .filter((id): id is string => id !== null);
  }

  async create(data: CreateCrmLeadData): Promise<CrmLead> {
    const [row] = await this.db
      .insert(crmLeadsTable)
      .values({ ...data, value: normalizeValue(data.value) })
      .returning();
    return toDomain(row);
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<Omit<CreateCrmLeadData, "stageId">>
  ): Promise<CrmLead> {
    const [row] = await this.db
      .update(crmLeadsTable)
      .set({ ...data, value: normalizeValue(data.value) })
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .returning();
    return toDomain(row);
  }

  async updateStage(id: string, companyId: string, stageId: string): Promise<CrmLead> {
    const [row] = await this.db
      .update(crmLeadsTable)
      .set({ stageId })
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .returning();
    return toDomain(row);
  }
}
