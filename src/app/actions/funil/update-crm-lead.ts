"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { UpdateCrmLead } from "@/use-cases/funil/UpdateCrmLead";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  niche: z.string().optional().nullable(),
  subniche: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function updateCrmLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { id, ...data } = parsed.data;
  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const useCase = new UpdateCrmLead(crmLeadRepo);

  return useCase.execute({ id, companyId, data });
}
