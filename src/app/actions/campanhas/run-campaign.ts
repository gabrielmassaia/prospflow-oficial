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
    try {
      const nicheRepo = new DrizzleNicheRepository(db);
      const leadRepo = new DrizzleLeadRepository(db);
      const geoService = new OverpassGeoService();
      const aiService = new CloudflareAIService();

      const useCase = new RunCampaign(campaignRepo, nicheRepo, leadRepo, geoService, aiService);
      await useCase.execute({ campaignId, companyId });
    } catch (e) {
      // rede de segurança: RunCampaign já trata as falhas que conhece
      // internamente, mas qualquer coisa inesperada que escape daqui (ex: o
      // próprio construtor de uma dependência lançando) não pode deixar a
      // campanha presa em "running" para sempre, sem nenhum jeito de tentar de novo
      console.error("[runCampaignAction] erro não tratado no after()", e);
      await campaignRepo.updateStatus(campaignId, companyId, "failed");
    }
  });

  return { ok: true as const, queued: true };
}
