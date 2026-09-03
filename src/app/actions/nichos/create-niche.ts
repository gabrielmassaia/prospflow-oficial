"use server";

import { z } from "zod";

import { db } from "@/infrastructure/db";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { CreateNiche } from "@/use-cases/nichos/CreateNiche";
import { requireCompany, requireUser } from "@/lib/tenant";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  targetServices: z.array(z.string()).default([]),
  commonPains: z.array(z.string()).default([]),
  baseMessageTemplate: z.string().default(""),
  isActive: z.boolean().default(true),
});

export async function createNicheAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const repo = new DrizzleNicheRepository(db);
  const useCase = new CreateNiche(repo);
  return useCase.execute({ ...parsed.data, companyId });
}
