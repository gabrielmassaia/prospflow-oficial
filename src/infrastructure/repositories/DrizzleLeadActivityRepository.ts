import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateLeadActivityData,
  ILeadActivityRepository,
  LeadActivity,
} from "@/domain/repositories/ILeadActivityRepository";
import { leadActivitiesTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleLeadActivityRepository implements ILeadActivityRepository {
  constructor(private db: DB) {}

  async findByLead(leadId: string, companyId: string): Promise<LeadActivity[]> {
    return this.db
      .select()
      .from(leadActivitiesTable)
      .where(
        and(eq(leadActivitiesTable.leadId, leadId), eq(leadActivitiesTable.companyId, companyId))
      )
      .orderBy(leadActivitiesTable.createdAt);
  }

  async create(data: CreateLeadActivityData): Promise<LeadActivity> {
    const [row] = await this.db.insert(leadActivitiesTable).values(data).returning();
    return row;
  }
}
