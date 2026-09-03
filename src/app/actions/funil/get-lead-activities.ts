"use server";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";

export async function getLeadActivitiesAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const repo = new DrizzleLeadActivityRepository(db);
  const activities = await repo.findByLead(leadId, companyId);
  return { ok: true as const, data: activities };
}
