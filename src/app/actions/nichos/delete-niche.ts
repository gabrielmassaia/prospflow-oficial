"use server";

import { db } from "@/infrastructure/db";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { DeleteNiche } from "@/use-cases/nichos/DeleteNiche";
import { requireCompany, requireUser } from "@/lib/tenant";

export async function deleteNicheAction(id: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);
  const repo = new DrizzleNicheRepository(db);
  const useCase = new DeleteNiche(repo);
  return useCase.execute({ id, companyId });
}
