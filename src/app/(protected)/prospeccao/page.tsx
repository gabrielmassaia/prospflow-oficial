import Link from "next/link";
import { Map, Tag, TrendingUp, Users } from "lucide-react";

import { QUALIFIED_SCORE_THRESHOLD } from "@/domain/lead-qualification";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { CAMPAIGN_STATUS_CLASSES, CAMPAIGN_STATUS_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const nicheRepo = new DrizzleNicheRepository(db);
  const campaignRepo = new DrizzleCampaignRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);

  const [niches, campaigns, leadCounts] = await Promise.all([
    nicheRepo.findAllByCompany(companyId),
    campaignRepo.findAllByCompany(companyId),
    leadRepo.countByCompany(companyId),
  ]);

  const activeNiches = niches.filter((n) => n.isActive).length;
  const completedCampaigns = campaigns.filter((c) => c.status === "completed").length;
  const recentCampaigns = [...campaigns].reverse().slice(0, 5);

  const stats = [
    { label: "Nichos ativos", value: activeNiches, icon: Tag, color: "bg-primary/10 text-primary", href: "/prospeccao/nichos" },
    { label: "Campanhas concluídas", value: completedCampaigns, icon: Map, color: "bg-violet-50 text-violet-600", href: "/prospeccao/campanhas" },
    { label: "Leads prospectados", value: leadCounts.total, icon: Users, color: "bg-amber-50 text-amber-600", href: "/prospeccao/leads" },
    {
      label: `Qualificados (score ${QUALIFIED_SCORE_THRESHOLD}+)`,
      value: leadCounts.qualified,
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600",
      href: "/prospeccao/leads",
    },
  ];

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da prospecção ativa</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">Campanhas recentes</h2>
        {recentCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
            <Link href="/prospeccao/campanhas" className="mt-3 inline-block text-sm text-primary hover:text-primary/75">
              Criar primeira campanha →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCampaigns.map((c) => (
              <Link key={c.id} href={`/prospeccao/campanhas/${c.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3.5 shadow-sm transition-colors hover:bg-accent/60">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.city}, {c.state}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-foreground">{c.totalFound} leads</span>
                    <Badge className={CAMPAIGN_STATUS_CLASSES[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
