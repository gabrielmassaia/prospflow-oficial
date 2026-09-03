import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleFunnelStageRepository } from "@/infrastructure/repositories/DrizzleFunnelStageRepository";
import { SeedFunnelStages } from "@/use-cases/funil/SeedFunnelStages";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { FunilContent } from "./_components/FunilContentLoader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Funil" };
}

export default function FunilPage() {
  return (
    <BasePageLayout>
      <Suspense
        fallback={<LoadingContent title="Carregando funil..." withHeader={false} rows={6} />}
      >
        <FunilDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

async function FunilDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const stageRepo = new DrizzleFunnelStageRepository(db);
  const crmLeadRepo = new DrizzleCrmLeadRepository(db);

  const seedResult = await new SeedFunnelStages(stageRepo).execute({ companyId });
  const stages = seedResult.ok ? seedResult.data : await stageRepo.findAllByCompany(companyId);
  const leads = await crmLeadRepo.findAllByCompany(companyId);

  return <FunilContent initialStages={stages} initialLeads={leads} />;
}
