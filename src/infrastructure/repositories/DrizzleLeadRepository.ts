import { and, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { QUALIFIED_SCORE_THRESHOLD } from "@/domain/lead-qualification";
import type { CreateLeadData, ILeadRepository, Lead, LeadFilters } from "@/domain/repositories/ILeadRepository";
import { prospectingLeadsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleLeadRepository implements ILeadRepository {
  constructor(private db: DB) {}

  async findByCampaign(campaignId: string, companyId: string): Promise<Lead[]> {
    return this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(eq(prospectingLeadsTable.campaignId, campaignId), eq(prospectingLeadsTable.companyId, companyId)))
      .orderBy(prospectingLeadsTable.score);
  }

  async findAllByCompany(companyId: string, filters?: LeadFilters): Promise<Lead[]> {
    const conditions = [eq(prospectingLeadsTable.companyId, companyId)];
    if (filters?.campaignId) conditions.push(eq(prospectingLeadsTable.campaignId, filters.campaignId));
    if (filters?.status) conditions.push(eq(prospectingLeadsTable.status, filters.status));
    if (filters?.minScore) conditions.push(gte(prospectingLeadsTable.score, filters.minScore));
    if (filters?.onlyWhatsapp) conditions.push(eq(prospectingLeadsTable.hasWhatsapp, true));

    return this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(...conditions))
      .orderBy(prospectingLeadsTable.score);
  }

  async findById(id: string, companyId: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(eq(prospectingLeadsTable.id, id), eq(prospectingLeadsTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async bulkCreate(leads: CreateLeadData[]): Promise<Lead[]> {
    if (leads.length === 0) return [];
    return this.db.insert(prospectingLeadsTable).values(leads).returning();
  }

  async update(id: string, companyId: string, data: Partial<Lead>): Promise<Lead> {
    const [row] = await this.db
      .update(prospectingLeadsTable)
      .set(data)
      .where(and(eq(prospectingLeadsTable.id, id), eq(prospectingLeadsTable.companyId, companyId)))
      .returning();
    return row;
  }

  async countByCompany(companyId: string): Promise<{ total: number; qualified: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        qualified: sql<number>`count(*) filter (where score >= ${QUALIFIED_SCORE_THRESHOLD})::int`,
      })
      .from(prospectingLeadsTable)
      .where(eq(prospectingLeadsTable.companyId, companyId));
    return row ?? { total: 0, qualified: 0 };
  }
}
