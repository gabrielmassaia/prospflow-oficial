import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/infrastructure/db";
import { DrizzleCompanyRepository } from "@/infrastructure/repositories/DrizzleCompanyRepository";
import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function requireCompany(userId: string) {
  const companyRepo = new DrizzleCompanyRepository(db);
  const company = await companyRepo.findByUserId(userId);

  if (!company) {
    redirect("/login");
  }

  return { companyId: company.id, company };
}