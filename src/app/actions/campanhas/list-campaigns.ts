"use server";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";

export async function listCampaignsAction(): Promise<Campaign[]> {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  return campaignRepo.findAllByCompany(companyId);
}
