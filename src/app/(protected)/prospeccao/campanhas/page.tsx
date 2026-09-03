import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { CampanhasContent } from "./_components/CampanhasContent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Campanhas" };
}

export default function CampanhasPage() {
  return (
    <BasePageLayout title="Campanhas" description="Buscas georreferenciadas por nicho">
      <Suspense fallback={<LoadingContent title="Carregando campanhas..." withHeader={false} rows={5} />}>
        <CampanhasDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

async function CampanhasDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);

  const [campaigns, niches] = await Promise.all([
    campaignRepo.findAllByCompany(companyId),
    nicheRepo.findAllByCompany(companyId),
  ]);

  return <CampanhasContent initialCampaigns={campaigns} initialNiches={niches} />;
}
