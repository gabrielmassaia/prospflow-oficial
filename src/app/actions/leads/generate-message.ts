"use server";

import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { GenerateMessage } from "@/use-cases/leads/GenerateMessage";
import { requireCompany, requireUser } from "@/lib/tenant";

export async function generateMessageAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const leadRepo = new DrizzleLeadRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);
  const aiService = new CloudflareAIService();

  const useCase = new GenerateMessage(leadRepo, nicheRepo, aiService);
  return useCase.execute({ leadId, companyId });
}
