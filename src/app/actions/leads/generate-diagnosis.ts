"use server";

import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { GenerateDiagnosis } from "@/use-cases/leads/GenerateDiagnosis";
import { requireCompany, requireUser } from "@/lib/tenant";

export async function generateDiagnosisAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const leadRepo = new DrizzleLeadRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);
  const aiService = new CloudflareAIService();

  const useCase = new GenerateDiagnosis(leadRepo, nicheRepo, aiService);
  return useCase.execute({ leadId, companyId });
}
