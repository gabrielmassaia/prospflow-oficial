# Aula 2 · Parte 2 — 1. Domínio e Infraestrutura

> Parte de `aula-2-parte-2`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Use-Cases-e-Actions.md`.

---

### Passo 1 — Domínio de Campanhas

```typescript
export type CampaignStatus = "draft" | "running" | "completed" | "failed";

export interface Campaign {
  id: string;
  companyId: string;
  nicheId: string;
  name: string;
  cep: string | null;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  maxResults: number;
  additionalKeywords: string[];
  status: CampaignStatus;
  totalFound: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// tudo que create() recebe: o Campaign inteiro menos o que só existe depois
// de rodar (status/totalFound/lastRunAt nascem "draft"/0/null) e o que o banco gera
export type CreateCampaignData = Omit<
  Campaign,
  "id" | "status" | "totalFound" | "lastRunAt" | "createdAt" | "updatedAt"
>;

export interface ICampaignRepository {
  findAllByCompany(companyId: string): Promise<Campaign[]>;
  findById(id: string, companyId: string): Promise<Campaign | null>;
  create(data: CreateCampaignData): Promise<Campaign>;
  updateStatus(id: string, companyId: string, status: CampaignStatus, totalFound?: number): Promise<void>;
}
```

Salve como `src/domain/repositories/ICampaignRepository.ts`. Repare que não existe `update()` genérico — só `updateStatus()`. Uma campanha, depois de criada, só muda por causa da execução (`draft → running → completed/failed`); não existe fluxo de "editar campanha" nesta fase, então a interface não promete um método que ninguém chama.

---

### Passo 2 — `IGeoService`: o contrato de busca georreferenciada

```typescript
// as 6 chaves que o Overpass (OpenStreetMap) usa pra categorizar estabelecimentos —
// ver o prompt de IA em RunCampaign, que gera esses valores a partir do nicho
export interface OsmTags {
  amenity?: string[];
  shop?: string[];
  craft?: string[];
  tourism?: string[];
  office?: string[];
  leisure?: string[];
}

export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  keywords: string[]; // fallback de busca por nome, usado só se osmTags vier vazio
  osmTags?: OsmTags; // query primária, gerada por IA
  maxResults: number;
}

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  phone?: string;
  website?: string;
  tags: Record<string, string>; // tags OSM cruas — RunCampaign usa pra calcular score
}

export interface IGeoService {
  search(params: GeoSearchParams): Promise<GeoResult[]>;
}
```

Salve como `src/domain/services/IGeoService.ts`. Este contrato não sabe que existe Overpass, OSM ou qualquer provedor específico — poderia ser implementado amanhã com Google Places sem `RunCampaign` mudar uma linha.

---

### Passo 3 — Domínio de Leads (necessário já aqui — ver `0_Conceitos-e-Mapa-de-Arquivos.md`)

```typescript
export type LeadStatus =
  | "new"
  | "qualified"
  | "not_qualified"
  | "whatsapp_opened"
  | "message_sent"
  | "responded"
  | "lost"
  | "do_not_contact";

export type WhatsappStatus = "unknown" | "probable" | "confirmed" | "invalid";

export interface Lead {
  id: string;
  companyId: string;
  campaignId: string;
  nicheId: string;
  source: string;
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  websiteUrl: string | null;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  score: number;
  status: LeadStatus;
  whatsappStatus: WhatsappStatus;
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasWhatsapp: boolean;
  rating: number | null;
  reviewCount: number | null;
  aiOverview: string | null; // preenchido só na Parte 4 (IA de diagnóstico)
  suggestedOffer: string | null; // idem
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateLeadData = Omit<Lead, "id" | "createdAt" | "updatedAt">;

export interface LeadFilters {
  campaignId?: string;
  status?: LeadStatus;
  minScore?: number;
  onlyWhatsapp?: boolean;
}

export interface ILeadRepository {
  findByCampaign(campaignId: string, companyId: string): Promise<Lead[]>;
  findAllByCompany(companyId: string, filters?: LeadFilters): Promise<Lead[]>;
  findById(id: string, companyId: string): Promise<Lead | null>;
  bulkCreate(leads: CreateLeadData[]): Promise<Lead[]>; // RunCampaign usa este agora
  update(id: string, companyId: string, data: Partial<Lead>): Promise<Lead>; // consumido na Parte 4
  countByCompany(companyId: string): Promise<{ total: number; qualified: number }>; // consumido no Dashboard, Parte 6
}
```

Salve como `src/domain/repositories/ILeadRepository.ts`. `findAllByCompany`, `findById`, `update` e `countByCompany` não têm consumidor nesta parte — só `bulkCreate` é chamado por `RunCampaign`. É a mesma exceção ao YAGNI já usada na Aula 1 pra `DrizzleUserRepository`: a interface nasce completa porque as próximas partes (3, 4, 5, 6) vão precisar de cada método, e não faz sentido fatiar uma interface coesa em pedaços que chegariam em momentos diferentes.

---

### Passo 4 — Regra de domínio: lead qualificado

```typescript
// Regra de negócio: a partir de qual score (0–100) um lead é "qualificado".
// Fica no domínio, não repetido em SQL/UI/dashboard, porque é uma decisão de
// negócio — não um detalhe de implementação de nenhuma dessas camadas
export const QUALIFIED_SCORE_THRESHOLD = 70;

export function isQualifiedLead(score: number): boolean {
  return score >= QUALIFIED_SCORE_THRESHOLD;
}
```

Salve como `src/domain/lead-qualification.ts`. `DrizzleLeadRepository.countByCompany` (próximo passo) importa essa constante — é o primeiro caso do projeto em que a **infraestrutura importa do domínio**, o que é a direção permitida pela regra de dependência (de fora pra dentro).

---

### Passo 5 — `DrizzleCampaignRepository`

```typescript
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { Campaign, CampaignStatus, CreateCampaignData, ICampaignRepository } from "@/domain/repositories/ICampaignRepository";
import { prospectingCampaignsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleCampaignRepository implements ICampaignRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<Campaign[]> {
    return this.db
      .select()
      .from(prospectingCampaignsTable)
      .where(eq(prospectingCampaignsTable.companyId, companyId))
      .orderBy(prospectingCampaignsTable.createdAt);
  }

  async findById(id: string, companyId: string): Promise<Campaign | null> {
    const [row] = await this.db
      .select()
      .from(prospectingCampaignsTable)
      .where(and(eq(prospectingCampaignsTable.id, id), eq(prospectingCampaignsTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async create(data: CreateCampaignData): Promise<Campaign> {
    const [row] = await this.db.insert(prospectingCampaignsTable).values(data).returning();
    return row;
  }

  async updateStatus(id: string, companyId: string, status: CampaignStatus, totalFound?: number): Promise<void> {
    await this.db
      .update(prospectingCampaignsTable)
      .set({
        status,
        // totalFound e lastRunAt só são setados quando a chamada vem de uma
        // execução real (RunCampaign) — a transição pra "running" não tem contagem ainda
        ...(totalFound !== undefined ? { totalFound, lastRunAt: new Date() } : {}),
      })
      .where(and(eq(prospectingCampaignsTable.id, id), eq(prospectingCampaignsTable.companyId, companyId)));
  }
}
```

Salve como `src/infrastructure/repositories/DrizzleCampaignRepository.ts`.

---

### Passo 6 — `DrizzleLeadRepository`

```typescript
import { and, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { QUALIFIED_SCORE_THRESHOLD } from "@/domain/lead-qualification";
import type { CreateLeadData, ILeadRepository, Lead, LeadFilters } from "@/domain/repositories/ILeadRepository";
import { prospectingLeadsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleLeadRepository implements ILeadRepository {
  constructor(private db: DB) {}

  async findByCampaign(campaignId: string, companyId: string): Promise<Lead[]> {
    return this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(eq(prospectingLeadsTable.campaignId, campaignId), eq(prospectingLeadsTable.companyId, companyId)))
      .orderBy(prospectingLeadsTable.score); // score crescente — a UI (Parte 3) inverte pra mostrar os melhores primeiro
  }

  async findAllByCompany(companyId: string, filters?: LeadFilters): Promise<Lead[]> {
    // monta a lista de condições dinamicamente — só entra no WHERE o que foi
    // de fato filtrado, evita um método por combinação de filtro
    const conditions = [eq(prospectingLeadsTable.companyId, companyId)];
    if (filters?.campaignId) conditions.push(eq(prospectingLeadsTable.campaignId, filters.campaignId));
    if (filters?.status) conditions.push(eq(prospectingLeadsTable.status, filters.status));
    if (filters?.minScore) conditions.push(gte(prospectingLeadsTable.score, filters.minScore));
    if (filters?.onlyWhatsapp) conditions.push(eq(prospectingLeadsTable.hasWhatsapp, true));

    return this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(...conditions))
      .orderBy(prospectingLeadsTable.score);
  }

  async findById(id: string, companyId: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(prospectingLeadsTable)
      .where(and(eq(prospectingLeadsTable.id, id), eq(prospectingLeadsTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async bulkCreate(leads: CreateLeadData[]): Promise<Lead[]> {
    // Overpass pode devolver zero resultados — inserir array vazio no Drizzle
    // lança erro ("values() called with empty array"), então corta aqui antes
    if (leads.length === 0) return [];
    return this.db.insert(prospectingLeadsTable).values(leads).returning();
  }

  async update(id: string, companyId: string, data: Partial<Lead>): Promise<Lead> {
    const [row] = await this.db
      .update(prospectingLeadsTable)
      .set(data)
      .where(and(eq(prospectingLeadsTable.id, id), eq(prospectingLeadsTable.companyId, companyId)))
      .returning();
    return row;
  }

  async countByCompany(companyId: string): Promise<{ total: number; qualified: number }> {
    // count(*) filter (where ...) — um único SELECT calcula os dois números,
    // em vez de duas queries (uma pro total, outra pros qualificados)
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        qualified: sql<number>`count(*) filter (where score >= ${QUALIFIED_SCORE_THRESHOLD})::int`,
      })
      .from(prospectingLeadsTable)
      .where(eq(prospectingLeadsTable.companyId, companyId));
    return row ?? { total: 0, qualified: 0 };
  }
}
```

Salve como `src/infrastructure/repositories/DrizzleLeadRepository.ts`.

---

### Passo 7 — `OverpassGeoService`

A Overpass API é o motor de busca do OpenStreetMap — gratuita, sem chave, mas pública e com limite de taxa (rate limit). O serviço tenta dois espelhos em sequência e trata cada tipo de falha (rede, HTTP, JSON inválido) com uma mensagem específica.

```typescript
import type { GeoResult, GeoSearchParams, IGeoService, OsmTags } from "@/domain/services/IGeoService";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number }; // "way" não tem lat/lon direto, só center
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export class OverpassGeoService implements IGeoService {
  async search(params: GeoSearchParams): Promise<GeoResult[]> {
    const { latitude: lat, longitude: lon, radiusKm, keywords, osmTags } = params;
    const radiusMeters = radiusKm * 1000;
    const around = `around:${radiusMeters},${lat},${lon}`;

    const lines = ["[out:json][timeout:30][maxsize:2000000];", "("];

    const hasOsmTags = osmTags && Object.values(osmTags).some((v) => Array.isArray(v) && v.length > 0);

    if (hasOsmTags) {
      // query primária: tags OSM que a IA gerou (RunCampaign) — node + way,
      // "relation" fica de fora por ser raro nesse contexto e muito mais lento
      const tagKeys: (keyof OsmTags)[] = ["amenity", "shop", "craft", "tourism", "office", "leisure"];
      for (const key of tagKeys) {
        const values = osmTags![key];
        if (!values || values.length === 0) continue;
        const regex = values.join("|");
        lines.push(`  node["${key}"~"${regex}"](${around});`);
        lines.push(`  way["${key}"~"${regex}"](${around});`);
      }
    } else if (keywords.length > 0) {
      // fallback por nome — só ativa quando a IA não gerou tags (evita escanear
      // todo estabelecimento nomeado da área, uma busca muito mais pesada)
      const nameRegex = keywords.join("|");
      lines.push(`  node["name"~"${nameRegex}",i](${around});`);
      lines.push(`  way["name"~"${nameRegex}",i](${around});`);
    }

    // "tags center qt": só tags + centro (sem coordenadas de cada nó de um way)
    // e sem ordenação — muito mais leve que "out body center" com muitos resultados
    lines.push(");", "out tags center qt 200;");
    const query = lines.join("\n");

    // dois espelhos — se o primeiro estiver sobrecarregado, tenta o segundo
    const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

    const messages: Record<number, string> = {
      400: "A query de busca está inválida. Verifique as keywords do nicho.",
      429: "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.",
      502: "Servidor de busca indisponível. Tentando novamente...",
      503: "Servidor de busca sobrecarregado. Tentando novamente...",
      504: "A busca demorou muito. Tentando servidor alternativo...",
    };

    let lastError = "";
    for (const endpoint of ENDPOINTS) {
      let res: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35_000);
        res = await fetch(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/plain, */*",
            "User-Agent": "ProspFlow/1.0 (prospflow@aivonlabs.com)", // Overpass pede User-Agent identificável
          },
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch (e) {
        console.error(`[OverpassGeoService] network error on ${endpoint}`, e);
        lastError = "Não foi possível conectar ao servidor de busca.";
        continue; // tenta o próximo endpoint
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[OverpassGeoService] HTTP ${res.status} on ${endpoint}`, { body });
        lastError = messages[res.status] ?? `Erro ${res.status} no servidor de busca.`;
        // 429 é rate limit — tentar o segundo espelho na mesma hora só pioraria,
        // então desiste de vez em vez de continuar o loop
        if (res.status === 429) break;
        continue;
      }

      let data: OverpassResponse;
      try {
        data = await res.json();
      } catch (e) {
        console.error(`[OverpassGeoService] invalid JSON from ${endpoint}`, e);
        lastError = "O servidor de busca retornou uma resposta inválida.";
        continue;
      }

      const withName = data.elements.filter((el) => el.tags?.name); // sem nome não é um lead útil

      return withName.slice(0, params.maxResults).map((el) => {
        const elLat = el.lat ?? el.center?.lat ?? 0; // node tem lat/lon direto, way só tem center
        const elLon = el.lon ?? el.center?.lon ?? 0;
        const tags = el.tags ?? {};
        return {
          name: tags.name ?? "",
          latitude: elLat,
          longitude: elLon,
          address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", "),
          city: tags["addr:city"] ?? "",
          state: tags["addr:state"] ?? "",
          phone: tags.phone ?? tags["contact:phone"],
          website: tags.website ?? tags["contact:website"],
          tags,
        };
      });
    }

    throw new Error(lastError || "Todos os servidores de busca falharam. Tente novamente em alguns minutos.");
  }
}
```

Salve como `src/infrastructure/services/OverpassGeoService.ts`.
