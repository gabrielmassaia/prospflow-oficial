import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { LeadsContent } from "./_components/LeadsContent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Leads" };
}

export default function LeadsPage() {
  return (
    <BasePageLayout>
      <Suspense fallback={<LoadingContent title="Carregando leads..." withHeader={false} rows={6} />}>
        <LeadsDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

async function LeadsDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const leadRepo = new DrizzleLeadRepository(db);
  const campaignRepo = new DrizzleCampaignRepository(db);

  const [leads, campaigns] = await Promise.all([
    leadRepo.findAllByCompany(companyId),
    campaignRepo.findAllByCompany(companyId),
  ]);

  return <LeadsContent initialLeads={leads} initialCampaigns={campaigns} />;
}
