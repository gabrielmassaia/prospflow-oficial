# Aula 2 · Parte 2 — 2. Use Cases e Server Actions

> Parte de `aula-2-parte-2`. Pré-requisito: `1_Dominio-e-Infraestrutura.md`. Próximo arquivo: `3_Verificacao-e-Armadilhas.md`.

---

### Passo 8 — `CreateCampaign`

```typescript
import type { Campaign, CreateCampaignData, ICampaignRepository } from "@/domain/repositories/ICampaignRepository";

type Result = { ok: true; data: Campaign } | { ok: false; error: string };

export class CreateCampaign {
  constructor(private campaignRepo: ICampaignRepository) {}

  async execute(input: CreateCampaignData): Promise<Result> {
    try {
      if (!input.name.trim()) return { ok: false, error: "Nome da campanha é obrigatório" };
      if (!input.nicheId) return { ok: false, error: "Nicho é obrigatório" };
      const campaign = await this.campaignRepo.create(input);
      return { ok: true, data: campaign };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar campanha" };
    }
  }
}
```

Salve como `src/use-cases/campanhas/CreateCampaign.ts`. Cria com `status: "draft"` (default do schema) — a campanha só passa a `running` quando `RunCampaign` (próximo passo) executa de verdade.

---

### Passo 9 — `RunCampaign`: o use case mais complexo do projeto

Orquestra três coisas em sequência: (1) a IA transforma o nicho num conjunto de tags OSM, (2) o `IGeoService` busca estabelecimentos reais com essas tags, (3) cada resultado vira um lead com um score calculado. Recebe **5 dependências** — mais que qualquer outro use case do projeto até aqui — porque coordena três sistemas externos (banco, IA, geo) mais dois repositórios de leitura (nicho, campanha).

**Por que a IA gera tags OSM em vez de manter um dicionário fixo?** Um dicionário estático (`"restaurante" → "amenity=restaurant"`) só cobre os nichos previstos de antemão. Pedindo pra IA traduzir a partir do nome + descrição do nicho, qualquer nicho novo que o usuário criar já funciona, sem precisar tocar código.

```typescript
import type { ICampaignRepository } from "@/domain/repositories/ICampaignRepository";
import type { IAIService } from "@/domain/services/IAIService";
import type { IGeoService, OsmTags } from "@/domain/services/IGeoService";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

// instrui a IA a devolver só JSON, com as 6 chaves exatas que OsmTags espera —
// os 5 exemplos cobrem os nichos mais comuns no Brasil e calibram o formato
// de resposta (a IA tende a seguir o padrão dos exemplos à risca)
const OSM_TAG_SYSTEM_PROMPT = `You are an OpenStreetMap (OSM) expert. Given a business niche name and description in Portuguese, return ONLY a valid JSON object with OSM tag values that best represent that type of business. Keys must be exactly: "amenity", "shop", "craft", "tourism", "office", "leisure". Values are arrays of OSM tag values in English. Return ONLY the JSON object, no explanation, no markdown.

Example input: "Niche: Restaurantes e Lanchonetes"
Example output: {"amenity":["restaurant","fast_food","cafe","bar"],"shop":[],"craft":[],"tourism":[],"office":[],"leisure":[]}

Example input: "Niche: Mecânicas e Auto Centers"
Example output: {"amenity":[],"shop":["car_repair","car_parts","tyres"],"craft":["car_repair","panel_beater"],"tourism":[],"office":[],"leisure":[]}

Example input: "Niche: Academias e Crossfit"
Example output: {"amenity":[],"shop":[],"craft":[],"tourism":[],"office":[],"leisure":["fitness_centre","sports_centre","gym"]}

Example input: "Niche: Escritórios de Advocacia"
Example output: {"amenity":[],"shop":[],"craft":[],"tourism":[],"office":["lawyer","legal"],"leisure":[]}

Example input: "Niche: Salões de Beleza e Barbearias"
Example output: {"amenity":["hairdresser","beauty"],"shop":["hairdresser","beauty"],"craft":["hairdresser"],"tourism":[],"office":[],"leisure":[]}`;

type Input = { campaignId: string; companyId: string };
type Result = { ok: true; totalFound: number } | { ok: false; error: string };

// score heurístico simples (0–100): presença online conta mais que qualquer
// outro sinal isolado — é o proxy mais forte de "empresa que já investe em marketing"
function calculateScore(tags: Record<string, string>, phone?: string, website?: string): number {
  let score = 20; // toda empresa encontrada começa com uma base
  if (website) score += 20;
  if (phone) score += 15;

  const rating = parseFloat(tags["rating"] ?? "0");
  if (rating >= 4.0) score += 20;
  else if (rating >= 3.0) score += 10;

  const reviews = parseInt(tags["review_count"] ?? "0", 10);
  if (reviews >= 50) score += 15;
  else if (reviews >= 10) score += 5;

  if (tags["contact:instagram"] || tags["instagram"]) score += 10;

  return Math.min(100, score);
}

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\D/g, ""); // só dígitos — formato usado depois pra montar link de WhatsApp
}

export class RunCampaign {
  constructor(
    private campaignRepo: ICampaignRepository,
    private nicheRepo: INicheRepository,
    private leadRepo: ILeadRepository,
    private geoService: IGeoService,
    private aiService: IAIService
  ) {}

  async execute({ campaignId, companyId }: Input): Promise<Result> {
    const campaign = await this.campaignRepo.findById(campaignId, companyId);
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };

    const niche = await this.nicheRepo.findById(campaign.nicheId, companyId);
    if (!niche) return { ok: false, error: "Nicho não encontrado" };

    // o status "running" já foi marcado pela action, ANTES do after() — aqui
    // só cuidamos da transição final para completed/failed
    try {
      let osmTags: OsmTags | undefined;
      try {
        const nicheContext = niche.description
          ? `Niche: ${niche.name}\nDescription: ${niche.description}`
          : `Niche: ${niche.name}`;
        const raw = await this.aiService.complete(OSM_TAG_SYSTEM_PROMPT, nicheContext);
        // a IA às vezes envolve o JSON em texto/markdown mesmo pedindo pra não —
        // esse regex extrai só o objeto, ignorando qualquer coisa em volta
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as OsmTags;
          const hasAnyTag = Object.values(parsed).some((v) => Array.isArray(v) && v.length > 0);
          if (hasAnyTag) osmTags = parsed;
        }
      } catch (e) {
        // se a IA falhar (sem credenciais, rate limit, resposta inesperada),
        // NÃO aborta a campanha — cai pro fallback por nome (ver OverpassGeoService)
        console.warn("[RunCampaign] AI tag generation failed, falling back to name-only search", e);
      }

      const nameKeywords = [...niche.keywords, ...campaign.additionalKeywords];

      const results = await this.geoService.search({
        latitude: campaign.latitude,
        longitude: campaign.longitude,
        radiusKm: campaign.radiusKm,
        keywords: nameKeywords,
        osmTags,
        maxResults: campaign.maxResults,
      });

      const leads = results.map((r) => {
        const score = calculateScore(r.tags, r.phone, r.website);
        const hasWebsite = !!r.website;
        const hasInstagram = !!(r.tags["contact:instagram"] || r.tags["instagram"]);
        const hasWhatsapp = !!(r.tags["contact:whatsapp"] || r.tags["phone:whatsapp"]);

        return {
          companyId,
          campaignId,
          nicheId: niche.id,
          source: "overpass" as const,
          name: r.name,
          phone: r.phone ?? null,
          phoneNormalized: normalizePhone(r.phone) ?? null,
          email: null,
          websiteUrl: r.website ?? null,
          address: r.address,
          city: r.city || campaign.city, // Overpass às vezes não tem addr:city — usa a cidade da campanha
          state: r.state || campaign.state,
          latitude: r.latitude,
          longitude: r.longitude,
          score,
          status: "new" as const,
          whatsappStatus: (hasWhatsapp ? "probable" : "unknown") as "probable" | "unknown",
          hasWebsite,
          hasInstagram,
          hasWhatsapp,
          rating: r.tags["rating"] ? parseFloat(r.tags["rating"]) : null,
          reviewCount: r.tags["review_count"] ? parseInt(r.tags["review_count"], 10) : null,
          aiOverview: null, // preenchido sob demanda na Parte 4, não em massa aqui
          suggestedOffer: null,
        };
      });

      await this.leadRepo.bulkCreate(leads);
      await this.campaignRepo.updateStatus(campaignId, companyId, "completed", leads.length);

      return { ok: true, totalFound: leads.length };
    } catch (e) {
      // qualquer falha não tratada (Overpass fora do ar, erro de banco) marca
      // a campanha como failed — nunca fica "running" pra sempre
      await this.campaignRepo.updateStatus(campaignId, companyId, "failed");
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao executar campanha" };
    }
  }
}
```

Salve como `src/use-cases/campanhas/RunCampaign.ts`.

---

### Passo 10 — Server Action: criar campanha

```typescript
"use server";

import { z } from "zod";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { CreateCampaign } from "@/use-cases/campanhas/CreateCampaign";
import { requireCompany, requireUser } from "@/lib/tenant";

const schema = z.object({
  nicheId: z.string().uuid(),
  name: z.string().min(2),
  cep: z.string().length(8).optional().nullable(), // resolvido via ViaCEP no form, Parte 3
  city: z.string().min(2),
  state: z.string().length(2),
  country: z.string().default("Brazil"),
  latitude: z.number(),
  longitude: z.number(),
  radiusKm: z.number().int().min(1).max(50).default(5),
  maxResults: z.number().int().min(10).max(200).default(50),
  additionalKeywords: z.array(z.string()).default([]),
});

export async function createCampaignAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const repo = new DrizzleCampaignRepository(db);
  const useCase = new CreateCampaign(repo);
  return useCase.execute({ ...parsed.data, cep: parsed.data.cep ?? null, companyId });
}
```

Salve como `src/app/actions/campanhas/create-campaign.ts`.

---

### Passo 11 — Server Action: executar campanha (com `after()`)

Ver a explicação completa de `after()` em `0_Conceitos-e-Mapa-de-Arquivos.md`.

```typescript
"use server";

import { after } from "next/server";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { OverpassGeoService } from "@/infrastructure/services/OverpassGeoService";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { RunCampaign } from "@/use-cases/campanhas/RunCampaign";

export async function runCampaignAction(campaignId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  await campaignRepo.updateStatus(campaignId, companyId, "running");

  after(async () => {
    // dependências recriadas aqui dentro — este código roda numa "vida"
    // separada da requisição original (ver 0_Conceitos-e-Mapa-de-Arquivos.md)
    const campaignRepo = new DrizzleCampaignRepository(db);
    try {
      const nicheRepo = new DrizzleNicheRepository(db);
      const leadRepo = new DrizzleLeadRepository(db);
      const geoService = new OverpassGeoService();
      const aiService = new CloudflareAIService();

      const useCase = new RunCampaign(campaignRepo, nicheRepo, leadRepo, geoService, aiService);
      await useCase.execute({ campaignId, companyId });
    } catch (e) {
      // rede de segurança: RunCampaign já trata internamente as falhas que
      // conhece (Overpass fora do ar, IA indisponível), mas qualquer coisa
      // inesperada que escape dali não pode deixar a campanha presa em
      // "running" pra sempre, sem nenhum jeito de tentar de novo pela UI
      console.error("[runCampaignAction] erro não tratado no after()", e);
      await campaignRepo.updateStatus(campaignId, companyId, "failed");
    }
  });

  return { ok: true as const, queued: true };
}
```

Salve como `src/app/actions/campanhas/run-campaign.ts`.

---

### Passo 12 — Server Actions de leitura via polling

Duas actions de leitura, chamadas pelo Client Component enquanto uma campanha está `running` (ver conceito de polling em `0_Conceitos-e-Mapa-de-Arquivos.md`). Não existe consumidor ainda — a UI que as chama nasce na Parte 3 — mas o contrato já fica pronto.

```typescript
"use server";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";

export async function listCampaignsAction(): Promise<Campaign[]> {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  return campaignRepo.findAllByCompany(companyId);
}
```

Salve como `src/app/actions/campanhas/list-campaigns.ts`.

```typescript
"use server";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead } from "@/domain/repositories/ILeadRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";

type Result = { ok: true; data: { campaign: Campaign; leads: Lead[] } } | { ok: false };

export async function getCampaignDetailAction(campaignId: string): Promise<Result> {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  const campaign = await campaignRepo.findById(campaignId, companyId);
  if (!campaign) return { ok: false };

  const leadRepo = new DrizzleLeadRepository(db);
  const leads = await leadRepo.findByCampaign(campaignId, companyId);

  return { ok: true, data: { campaign, leads } };
}
```

Salve como `src/app/actions/campanhas/get-campaign-detail.ts`.

---

### Passo 13 — Server Action: geocodificar CEP

O formulário de campanha (Parte 3) só pede o CEP; quem resolve cidade/UF/lat/lon é o servidor, em duas chamadas encadeadas: **ViaCEP** (CEP → cidade/UF/logradouro) e **Nominatim** (endereço → coordenadas). As duas rodam no servidor, não no browser — isso tira APIs de terceiro do cliente e permite validar a resposta externa com Zod antes de confiar nela.

```typescript
"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";

const cepSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length === 8, "CEP deve ter 8 dígitos");

// nunca confie em JSON de terceiro sem validar — o schema aqui é o que garante
// que um formato de resposta inesperado vira um erro tratado, não um crash
const viacepSchema = z.object({
  localidade: z.string().optional(),
  uf: z.string().optional(),
  logradouro: z.string().optional(),
  erro: z.boolean().optional(),
});

const nominatimSchema = z.array(z.object({ lat: z.string(), lon: z.string() }));

type CepData = { city: string; state: string; street: string; latitude: number; longitude: number };
type Result = { ok: true; data: CepData } | { ok: false; error: string };

export async function resolveCepAction(cep: string): Promise<Result> {
  const user = await requireUser();
  await requireCompany(user.id); // exige sessão — geocodificar não deve ser endpoint público aberto

  const parsed = cepSchema.safeParse(cep);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const digits = parsed.data;

  try {
    const viacepRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const viacep = viacepSchema.parse(await viacepRes.json());
    if (viacep.erro || !viacep.localidade || !viacep.uf) {
      return { ok: false, error: "CEP não encontrado" };
    }

    const city = viacep.localidade;
    const state = viacep.uf;
    const street = viacep.logradouro ?? "";

    const query = encodeURIComponent(`${street || city}, ${city}, ${state}, Brazil`);
    const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { "Accept-Language": "pt-BR", "User-Agent": "ProspFlow/1.0" },
    });
    const nominatim = nominatimSchema.parse(await nominatimRes.json());
    const first = nominatim[0];

    return {
      ok: true,
      data: {
        city,
        state,
        street,
        latitude: first ? parseFloat(first.lat) : 0, // sem resultado no Nominatim: usa 0,0 em vez de falhar a criação inteira
        longitude: first ? parseFloat(first.lon) : 0,
      },
    };
  } catch {
    return { ok: false, error: "Erro ao buscar CEP" };
  }
}
```

Salve como `src/app/actions/campanhas/resolve-cep.ts`.
