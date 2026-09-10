# Aula 2 · Parte 3 — 2. Detalhe da Campanha e Mapa

> Parte de `aula-2-parte-3`. Pré-requisito: `1_Lista-e-Formulario.md`. Próximo arquivo: `3_Verificacao-e-Armadilhas.md`.

---

### Passo 5 — Página de detalhe

`params` é uma `Promise` (convenção do Next.js 16 pra rotas dinâmicas) — precisa de `await` antes de usar `id`. Como o `Client Component` (próximo passo) já renderiza seu próprio cabeçalho rico, o `BasePageLayout` é usado **sem** `title` aqui.

```tsx
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
  // campanha de outra empresa (ou ID inexistente) — findById já filtra por
  // companyId, então "não encontrada" e "não é sua" dão o mesmo resultado:
  // redirect, sem vazar qual dos dois casos aconteceu
  if (!campaign) redirect("/prospeccao/campanhas");

  const nicheRepo = new DrizzleNicheRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);

  const [niche, leads] = await Promise.all([
    nicheRepo.findById(campaign.nicheId, companyId),
    leadRepo.findByCampaign(campaignId, companyId),
  ]);

  return <CampanhaDetailContent initialCampaign={campaign} initialNiche={niche} initialLeads={leads} />;
}
```

Salve como `src/app/(protected)/prospeccao/campanhas/[id]/page.tsx`.

---

### Passo 6 — `CampanhaDetailContent`: cabeçalho, métricas e mapa

Mesmo mecanismo de polling da lista (Parte 3, arquivo 1), mas aqui a leitura é do detalhe de uma campanha só (`getCampaignDetailAction`), não da lista inteira.

```tsx
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Play, Target, Users } from "lucide-react";
import { toast } from "sonner";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead } from "@/domain/repositories/ILeadRepository";
import type { Niche } from "@/domain/repositories/INicheRepository";
import { getCampaignDetailAction } from "@/app/actions/campanhas/get-campaign-detail";
import { runCampaignAction } from "@/app/actions/campanhas/run-campaign";
import { isQualifiedLead } from "@/domain/lead-qualification";
import { CAMPAIGN_STATUS_CLASSES, CAMPAIGN_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ver "Por que Leaflet precisa de dynamic(..., { ssr: false })" no 0_
const CampaignMap = dynamic(() => import("@/components/CampaignMap"), { ssr: false });

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface CampanhaDetailContentProps {
  initialCampaign: Campaign;
  initialNiche: Niche | null;
  initialLeads: Lead[];
}

export function CampanhaDetailContent({ initialCampaign, initialNiche, initialLeads }: CampanhaDetailContentProps) {
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [niche] = useState<Niche | null>(initialNiche);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (campaign.status !== "running") return;
    const timer = setInterval(async () => {
      const result = await getCampaignDetailAction(campaign.id);
      if (!result.ok) return;
      const fresh = result.data.campaign;
      if (fresh.status === "completed") {
        clearInterval(timer);
        setCampaign(fresh);
        setLeads(result.data.leads); // só troca a lista de leads quando termina — evita "piscar" a cada poll
        setTimeout(() => toast.success(`${fresh.totalFound} leads encontrados`), 0);
      } else if (fresh.status === "failed") {
        clearInterval(timer);
        setCampaign(fresh);
        setTimeout(() => toast.error("Campanha falhou ao buscar leads"), 0);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [campaign.status, campaign.id]);

  async function handleRun() {
    setRunning(true);
    setCampaign((c) => ({ ...c, status: "running" }));
    await runCampaignAction(campaign.id);
    setRunning(false);
  }

  const qualified = leads.filter((l) => isQualifiedLead(l.score)).length;
  const whatsappLikely = leads.filter((l) => l.whatsappStatus === "probable" || l.whatsappStatus === "confirmed").length;
  const reached = leads.filter((l) => ["whatsapp_opened", "message_sent", "responded"].includes(l.status)).length;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/prospeccao/campanhas"
          className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg border-transparent text-sm font-medium transition-colors hover:bg-accent hover:text-foreground")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {niche?.name} · {campaign.city}, {campaign.state}
            {campaign.cep ? ` (${campaign.cep.slice(0, 5)}-${campaign.cep.slice(5)})` : ""} · raio {campaign.radiusKm}km · máx{" "}
            {campaign.maxResults} resultados
          </p>
        </div>
        <Badge className={CAMPAIGN_STATUS_CLASSES[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
        <Button onClick={handleRun} disabled={running || campaign.status === "running"} size="sm">
          {running || campaign.status === "running" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          Executar busca
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Total encontrados" value={campaign.totalFound} icon={<Users className="h-4 w-4" />} color="bg-primary/10 text-primary" />
        <Metric label="Qualificados (70+)" value={qualified} icon={<Target className="h-4 w-4" />} color="bg-emerald-50 text-emerald-600" />
        <Metric label="WhatsApp provável" value={whatsappLikely} icon={<MessageCircle className="h-4 w-4" />} color="bg-green-50 text-green-600" />
        <Metric label="Abordados" value={reached} icon={<CheckCircle2 className="h-4 w-4" />} color="bg-violet-50 text-violet-600" />
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Parâmetros da busca</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Localização</span>
            <p className="font-medium">
              {campaign.city}, {campaign.state}
              {campaign.cep ? ` · ${campaign.cep.slice(0, 5)}-${campaign.cep.slice(5)}` : ""}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Coordenadas</span>
            <p className="font-medium tabular-nums">
              {campaign.latitude.toFixed(4)}, {campaign.longitude.toFixed(4)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Raio / Máximo</span>
            <p className="font-medium">
              {campaign.radiusKm}km · {campaign.maxResults} leads
            </p>
          </div>
        </div>
      </div>

      {leads.length > 0 ? (
        // flex-1 — o mapa estica pra preencher o espaço vertical restante da
        // tela, em vez de uma altura fixa em px (ver height na prop abaixo)
        <div className="flex min-h-[560px] flex-1 overflow-hidden rounded-xl border border-border/60 shadow-sm">
          <CampaignMap campaign={campaign} leads={leads} height="100%" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-20 text-sm text-muted-foreground">
          Execute a campanha para visualizar os leads no mapa
        </div>
      )}

      {leads.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Link
            href="/prospeccao/leads"
            className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-accent hover:text-foreground"
          >
            Ver todos os leads
          </Link>
        </div>
      )}
    </>
  );
}
```

Salve como `src/app/(protected)/prospeccao/campanhas/[id]/_components/CampanhaDetailContent.tsx`. O link "Ver todos os leads" aponta pra uma rota que só existe a partir de `aula-2-parte-5/` — até lá, clicar nele dá 404 (só aparece quando há leads, ou seja, só depois de rodar uma campanha com sucesso).

---

### Passo 7 — `CampaignMap`

```tsx
"use client";

/* eslint-disable @typescript-eslint/no-require-imports */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead } from "@/domain/repositories/ILeadRepository";

function markerColor(score: number): string {
  if (score >= 70) return "#10b981"; // verde — qualificado
  if (score >= 40) return "#f59e0b"; // âmbar — morno
  return "#94a3b8"; // cinza — frio
}

interface CampaignMapProps {
  campaign: Campaign;
  leads: Lead[];
  height?: number | string; // aceita "100%" — ver o wrapper flex-1 no Passo 6
}

export default function CampaignMap({ campaign, leads, height = 560 }: CampaignMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    // guarda contra re-inicializar o mapa se o efeito rodar de novo
    // (ex: React Strict Mode em dev) — Leaflet não aceita montar duas vezes
    // no mesmo container
    if (!containerRef.current || mapRef.current) return;

    const L = require("leaflet");

    // os ícones padrão do Leaflet referenciam imagens por caminho relativo
    // que quebra com bundlers — aponta pro CDN explicitamente
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const center: [number, number] = [campaign.latitude, campaign.longitude];
    const map = L.map(containerRef.current).setView(center, 13);
    mapRef.current = map;

    // tiles do próprio OpenStreetMap — gratuito, sem chave. O CartoDB "light_all"
    // (usado numa versão anterior) passou a estampar "API KEY REQUIRED" nos tiles
    // pra quem acessa sem credencial — ver Armadilha 4
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // marcador padrão pro centro da busca — distingue visualmente "onde a
    // campanha buscou" dos círculos coloridos "o que ela encontrou"
    L.marker(center).addTo(map).bindPopup(`Centro: ${campaign.city}, ${campaign.state}`);

    leads.forEach((lead) => {
      const color = markerColor(lead.score);
      const radius = Math.max(8, Math.min(18, lead.score / 5)); // raio proporcional ao score, dentro de limites legíveis

      // DOM em vez de HTML string — ver "Popup do mapa" no 0_
      const popup = document.createElement("div");
      const nameEl = document.createElement("strong");
      nameEl.textContent = lead.name;
      const br = document.createElement("br");
      const scoreEl = document.createTextNode(`Score: ${lead.score}`);
      popup.append(nameEl, br, scoreEl);

      L.circleMarker([lead.latitude, lead.longitude], {
        radius,
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: 0.7,
      })
        .addTo(map)
        .bindPopup(popup);
    });

    // cleanup: sem isso, navegar pra fora e voltar pra essa página deixaria
    // instâncias de mapa Leaflet vazando na memória
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: "0.5rem" }} />;
}
```

Salve como `src/components/CampaignMap.tsx`.
