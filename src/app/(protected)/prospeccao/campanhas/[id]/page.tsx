import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { CampanhaDetailContent } from "./_components/CampanhaDetailContent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Detalhe da campanha" };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampanhaDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <BasePageLayout>
      <Suspense fallback={<LoadingContent title="Carregando campanha..." withHeader={false} rows={4} />}>
        <CampanhaDetailDataLoader campaignId={id} />
      </Suspense>
    </BasePageLayout>
  );
}

async function CampanhaDetailDataLoader({ campaignId }: { campaignId: string }) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  const campaign = await campaignRepo.findById(campaignId, companyId);
  if (!campaign) redirect("/prospeccao/campanhas");

  const nicheRepo = new DrizzleNicheRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);

  const [niche, leads] = await Promise.all([
    nicheRepo.findById(campaign.nicheId, companyId),
    leadRepo.findByCampaign(campaignId, companyId),
  ]);

  return <CampanhaDetailContent initialCampaign={campaign} initialNiche={niche} initialLeads={leads} />;
}
