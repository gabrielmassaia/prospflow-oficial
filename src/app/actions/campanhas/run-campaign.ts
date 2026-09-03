"use server";

import { after } from "next/server";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { OverpassGeoService } from "@/infrastructure/services/OverpassGeoService";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { RunCampaign } from "@/use-cases/campanhas/RunCampaign";

export async function runCampaignAction(campaignId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  await campaignRepo.updateStatus(campaignId, companyId, "running");

  after(async () => {
    const campaignRepo = new DrizzleCampaignRepository(db);
    const nicheRepo = new DrizzleNicheRepository(db);
    const leadRepo = new DrizzleLeadRepository(db);
    const geoService = new OverpassGeoService();
    const aiService = new CloudflareAIService();

    const useCase = new RunCampaign(campaignRepo, nicheRepo, leadRepo, geoService, aiService);
    await useCase.execute({ campaignId, companyId });
  });

  return { ok: true as const, queued: true };
}
