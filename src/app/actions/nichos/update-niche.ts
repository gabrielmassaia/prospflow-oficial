"use server";

import { z } from "zod";

import { db } from "@/infrastructure/db";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { UpdateNiche } from "@/use-cases/nichos/UpdateNiche";
import { requireCompany, requireUser } from "@/lib/tenant";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetServices: z.array(z.string()).optional(),
  commonPains: z.array(z.string()).optional(),
  baseMessageTemplate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function updateNicheAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { id, ...data } = parsed.data;
  const repo = new DrizzleNicheRepository(db);
  const useCase = new UpdateNiche(repo);
  return useCase.execute({ id, companyId, data });
}
