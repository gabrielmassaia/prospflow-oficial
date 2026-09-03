"use server";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead } from "@/domain/repositories/ILeadRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";

type Result = { ok: true; data: { campaign: Campaign; leads: Lead[] } } | { ok: false };

export async function getCampaignDetailAction(campaignId: string): Promise<Result> {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  const campaign = await campaignRepo.findById(campaignId, companyId);
  if (!campaign) return { ok: false };

  const leadRepo = new DrizzleLeadRepository(db);
  const leads = await leadRepo.findByCampaign(campaignId, companyId);

  return { ok: true, data: { campaign, leads } };
}
