"use server";

import { z } from "zod";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { CreateCampaign } from "@/use-cases/campanhas/CreateCampaign";
import { requireCompany, requireUser } from "@/lib/tenant";

const schema = z.object({
  nicheId: z.string().uuid(),
  name: z.string().min(2),
  cep: z.string().length(8).optional().nullable(),
  city: z.string().min(2),
  state: z.string().length(2),
  country: z.string().default("Brazil"),
  latitude: z.number(),
  longitude: z.number(),
  radiusKm: z.number().int().min(1).max(50).default(5),
  maxResults: z.number().int().min(10).max(200).default(50),
  additionalKeywords: z.array(z.string()).default([]),
});

export async function createCampaignAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const repo = new DrizzleCampaignRepository(db);
  const useCase = new CreateCampaign(repo);
  return useCase.execute({ ...parsed.data, cep: parsed.data.cep ?? null, companyId });
}
