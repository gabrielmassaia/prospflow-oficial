"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";
import { CreateCrmLead } from "@/use-cases/funil/CreateCrmLead";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  niche: z.string().optional().nullable(),
  subniche: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  stageId: z.string().uuid(),
});

export async function createCrmLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const leadActivityRepo = new DrizzleLeadActivityRepository(db);
  const useCase = new CreateCrmLead(crmLeadRepo, leadActivityRepo);

  return useCase.execute({
    companyId,
    prospectingLeadId: null,
    stageId: parsed.data.stageId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    niche: parsed.data.niche || null,
    subniche: parsed.data.subniche || null,
    origin: "manual",
    value: parsed.data.value ?? null,
    notes: parsed.data.notes || null,
    createdBy: user.id,
  });
}
