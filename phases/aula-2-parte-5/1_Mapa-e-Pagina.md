# Aula 2 · Parte 5 — 1. Mapa e Página

> Parte de `aula-2-parte-5`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Lista-Filtros-e-Sheet.md`.

---

### Passo 1 — `LeadsMap`

Mesma técnica de `CampaignMap` (Parte 3): Leaflet imperativo dentro de `useEffect`, CSS estático no topo, DOM em vez de HTML string no popup. As diferenças: aqui não existe um "centro da busca" fixo (o mapa mostra leads de campanhas diferentes ao mesmo tempo, se nenhum filtro de campanha estiver ativo) e cada marcador é clicável — abre o sheet de detalhe (Parte 5, arquivo 2).

```tsx
"use client";

/* eslint-disable @typescript-eslint/no-require-imports */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import type { Lead } from "@/domain/repositories/ILeadRepository";

function markerColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#94a3b8";
}

interface LeadsMapProps {
  leads: Lead[];
  center?: [number, number];
  zoom?: number;
  height?: number | string;
  onSelect?: (lead: Lead) => void; // dispara o sheet de detalhe ao clicar num marcador
}

export default function LeadsMap({ leads, center, zoom = 13, height = 520, onSelect }: LeadsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  // sem center explícito, usa o primeiro lead da lista como ponto de partida —
  // fallback pra Florianópolis se não houver nenhum lead (mapa nunca fica "sem centro")
  const mapCenter: [number, number] = center ?? (leads[0] ? [leads[0].latitude, leads[0].longitude] : [-27.5954, -48.548]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = require("leaflet");

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const map = L.map(containerRef.current).setView(mapCenter, zoom);
    mapRef.current = map;

    // tiles do OpenStreetMap — gratuito, sem chave (ver Armadilha 4 em
    // aula-2-parte-3/3_Verificacao-e-Armadilhas.md sobre o CartoDB antigo)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leads.forEach((lead) => {
      const color = markerColor(lead.score);
      const radius = Math.max(10, Math.min(22, lead.score / 5));
      const marker = L.circleMarker([lead.latitude, lead.longitude], {
        radius,
        fillColor: color,
        color,
        weight: 1.5,
        fillOpacity: 0.7,
      }).addTo(map);

      const popup = document.createElement("div");
      const nameEl = document.createElement("strong");
      nameEl.textContent = lead.name;
      const br1 = document.createElement("br");
      const scoreEl = document.createTextNode(`Score: ${lead.score}`);
      const br2 = document.createElement("br");
      const addrEl = document.createTextNode(lead.address ?? "");
      popup.append(nameEl, br1, scoreEl, br2, addrEl);
      marker.bindPopup(popup);

      // clique no marcador == clique na linha da tabela: os dois abrem o
      // mesmo sheet de detalhe, via a mesma prop onSelect
      if (onSelect) {
        marker.on("click", () => onSelect(lead));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: "0.5rem" }} />;
}
```

Salve como `src/components/LeadsMap.tsx`.

---

### Passo 2 — Página de leads

Mesmo padrão thin-page das outras listagens. O `BasePageLayout` é usado sem `title` porque `LeadsContent` (próximo arquivo) já renderiza seu próprio cabeçalho — título + contador + os botões de alternância Lista/Mapa.

```tsx
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

  // busca TODOS os leads da empresa (não só de uma campanha) — o filtro por
  // campanha acontece client-side, dentro de LeadsContent
  const [leads, campaigns] = await Promise.all([
    leadRepo.findAllByCompany(companyId),
    campaignRepo.findAllByCompany(companyId),
  ]);

  return <LeadsContent initialLeads={leads} initialCampaigns={campaigns} />;
}
```

Salve como `src/app/(protected)/prospeccao/leads/page.tsx`.
