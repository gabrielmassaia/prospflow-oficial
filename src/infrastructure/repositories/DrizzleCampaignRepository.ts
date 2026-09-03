import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { Campaign, CampaignStatus, CreateCampaignData, ICampaignRepository } from "@/domain/repositories/ICampaignRepository";
import { prospectingCampaignsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleCampaignRepository implements ICampaignRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<Campaign[]> {
    return this.db
      .select()
      .from(prospectingCampaignsTable)
      .where(eq(prospectingCampaignsTable.companyId, companyId))
      .orderBy(prospectingCampaignsTable.createdAt);
  }

  async findById(id: string, companyId: string): Promise<Campaign | null> {
    const [row] = await this.db
      .select()
      .from(prospectingCampaignsTable)
      .where(and(eq(prospectingCampaignsTable.id, id), eq(prospectingCampaignsTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async create(data: CreateCampaignData): Promise<Campaign> {
    const [row] = await this.db.insert(prospectingCampaignsTable).values(data).returning();
    return row;
  }

  async updateStatus(id: string, companyId: string, status: CampaignStatus, totalFound?: number): Promise<void> {
    await this.db
      .update(prospectingCampaignsTable)
      .set({
        status,
        ...(totalFound !== undefined ? { totalFound, lastRunAt: new Date() } : {}),
      })
      .where(and(eq(prospectingCampaignsTable.id, id), eq(prospectingCampaignsTable.companyId, companyId)));
  }
}
