"use server";

import type { LeadStatus } from "@/domain/repositories/ILeadRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { UpdateLeadStatus } from "@/use-cases/leads/UpdateLeadStatus";

export async function updateLeadStatusAction(leadId: string, status: LeadStatus) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);
  const repo = new DrizzleLeadRepository(db);
  const useCase = new UpdateLeadStatus(repo);
  return useCase.execute({ leadId, companyId, status });
}
