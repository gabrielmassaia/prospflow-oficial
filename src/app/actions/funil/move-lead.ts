"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";
import { MoveLead } from "@/use-cases/funil/MoveLead";

const schema = z.object({
  leadId: z.string().uuid(),
  toStageId: z.string().uuid(),
  toStageName: z.string().min(1),
  fromStageName: z.string().min(1),
});

export async function moveLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const leadActivityRepo = new DrizzleLeadActivityRepository(db);
  const useCase = new MoveLead(crmLeadRepo, leadActivityRepo);

  return useCase.execute({ ...parsed.data, companyId, userId: user.id });
}
