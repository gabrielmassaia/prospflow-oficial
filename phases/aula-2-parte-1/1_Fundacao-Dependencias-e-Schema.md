# Aula 2 · Parte 1 — 1. Fundação: Dependências, Schema e IA Compartilhada

> Parte de `aula-2-parte-1`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Nichos.md`.
>
> Este arquivo cobre o que é compartilhado por todas as features da Aula 2 (Nichos, Campanhas, Leads): dependências, schema do banco, o serviço de IA (usado por Campanhas e Leads) e as duas peças de layout que toda página de listagem vai usar a partir daqui.

---

### Passo 1 — Dependências e componentes shadcn

```bash
npm install leaflet react-leaflet date-fns sonner
npm install -D @types/leaflet
```

`leaflet`/`react-leaflet` só entram em uso de verdade na Parte 3 (mapa de campanhas) — instalar agora evita interromper o fluxo da live mais tarde. `sonner` (toasts) já é consumido nesta parte, pelas mutações de nicho.

```bash
npx shadcn@latest add dialog alert-dialog table select slider switch checkbox textarea tabs badge avatar --overwrite
```

`--overwrite` evita que o CLI pare pra perguntar sobre sobrescrever `button.tsx` (ele é dependência interna de vários desses blocos e já existe desde a Aula 1).

Adicione o `<Toaster />` ao root layout — `sonner` não estava instalado na Aula 1, só entra agora junto com as primeiras mutações que disparam toast de sucesso/erro:

```tsx
import { Toaster } from "sonner";

// ...

<body className="min-h-full">
  {children}
  <Toaster position="top-right" richColors />
</body>
```

---

### Passo 2 — Schema: 3 tabelas + 3 enums

**Por que três tabelas juntas num só schema, em vez de uma por feature?** Elas têm relação direta em cascata — um lead pertence a uma campanha, que pertence a um nicho — então isolar cada uma num arquivo separado só espalharia uma modelagem que é, na prática, uma unidade só.

Adicione ao topo de `src/infrastructure/db/schema.ts`:

```typescript
// "sql" (o template tag pra literais SQL cru, usado abaixo em .default(sql`'{}'`))
// mora no pacote raiz drizzle-orm — não em drizzle-orm/pg-core, que só tem os
// tipos de coluna (pgTable, text, uuid, etc). Importar os dois do mesmo lugar
// compila, mas falha em runtime com "sql is not a function" assim que o
// drizzle-kit tenta avaliar o default de um array
import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
```

Cole as três tabelas depois de `companyMembersTable`:

```typescript
// ── Prospecção — Fase 2 ─────────────────────────────────────────────────────

export const prospectingNichesTable = pgTable(
  "prospecting_niches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // arrays de texto puro — sem tabela de junção. Nichos não têm volume
    // nem consulta que justifique normalizar keywords numa tabela própria
    keywords: text("keywords").array().notNull().default(sql`'{}'`),
    targetServices: text("target_services").array().notNull().default(sql`'{}'`),
    commonPains: text("common_pains").array().notNull().default(sql`'{}'`),
    baseMessageTemplate: text("base_message_template").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("prospecting_niches_company_id_idx").on(t.companyId),
  })
);

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "running", "completed", "failed"]);

export const prospectingCampaignsTable = pgTable(
  "prospecting_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    // onDelete: "restrict" — não deixa apagar um nicho que já tem campanha
    // vinculada (companiesTable acima usa "cascade": nicho é dependente da
    // empresa; campanha é dependente do nicho, mas o nicho não deveria sumir
    // "de baixo" de uma campanha existente)
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => prospectingNichesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    cep: varchar("cep", { length: 8 }), // nullable — resolvido via ViaCEP no form, na Parte 3
    city: text("city").notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    country: text("country").notNull().default("Brazil"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    radiusKm: integer("radius_km").notNull().default(5),
    maxResults: integer("max_results").notNull().default(50),
    additionalKeywords: text("additional_keywords").array().notNull().default(sql`'{}'`),
    status: campaignStatusEnum("status").notNull().default("draft"),
    totalFound: integer("total_found").notNull().default(0),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("campaigns_company_id_idx").on(t.companyId),
    nicheIdIdx: index("campaigns_niche_id_idx").on(t.nicheId),
  })
);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "qualified",
  "not_qualified",
  "whatsapp_opened",
  "message_sent",
  "responded",
  "lost",
  "do_not_contact",
]);

export const whatsappStatusEnum = pgEnum("whatsapp_status", ["unknown", "probable", "confirmed", "invalid"]);

export const prospectingLeadsTable = pgTable(
  "prospecting_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => prospectingCampaignsTable.id, { onDelete: "cascade" }), // lead some se a campanha some
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => prospectingNichesTable.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("overpass"),
    name: text("name").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"), // formato E.164, usado pra montar link de WhatsApp (Parte 5)
    email: text("email"),
    websiteUrl: text("website_url"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    score: integer("score").notNull().default(0), // calculado por regra de domínio, ver aula-2-parte-2
    status: leadStatusEnum("status").notNull().default("new"),
    whatsappStatus: whatsappStatusEnum("whatsapp_status").notNull().default("unknown"),
    hasWebsite: boolean("has_website").notNull().default(false),
    hasInstagram: boolean("has_instagram").notNull().default(false),
    hasWhatsapp: boolean("has_whatsapp").notNull().default(false),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    aiOverview: text("ai_overview"), // gerado por IA, Parte 4
    suggestedOffer: text("suggested_offer"), // gerado por IA, Parte 4
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("leads_company_id_idx").on(t.companyId),
    campaignIdIdx: index("leads_campaign_id_idx").on(t.campaignId),
    statusIdx: index("leads_status_idx").on(t.status), // filtros de status na listagem (Parte 5)
    scoreIdx: index("leads_score_idx").on(t.score), // ordenação por score na listagem (Parte 5)
  })
);
```

Aplique no banco:

```bash
npx drizzle-kit push
```

Resultado esperado: 3 tabelas + 3 enums novos no Neon, sem erro.

---

### Passo 3 — IA compartilhada: `IAIService` e `CloudflareAIService`

Usado tanto pelo `RunCampaign` (geração de tags de busca, Parte 2) quanto pelos use-cases de diagnóstico/mensagem de leads (Parte 4) — por isso mora na fundação compartilhada, não dentro do arquivo de uma feature só.

```typescript
export interface IAIService {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

Salve como `src/domain/services/IAIService.ts`.

**Por que o construtor não valida as credenciais** (e essa é uma correção em cima de uma primeira versão que validava — ver Armadilha 3 em `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`): `RunCampaign` (Parte 2) trata falha de IA como recuperável — se a IA não responder, ele cai pro fallback de busca por nome, sem abortar a campanha. Isso só funciona se a falha acontecer **dentro** do `try/catch` que envolve a chamada a `aiService.complete(...)`. Se o construtor lançasse o erro, ele aconteceria no instante em que `new CloudflareAIService()` é chamado — que é fora desse `try/catch`, escrito antes de `RunCampaign` sequer começar a rodar. O construtor fica então deliberadamente "burro": só guarda a instância, nunca falha. Toda validação de credencial migra pra dentro de `complete()`, onde uma falha é, por definição, uma falha de IA — e cai no caminho já preparado pra lidar com isso.

```typescript
import type { IAIService } from "@/domain/services/IAIService";

interface CloudflareResponse {
  result?: { response?: string };
  success: boolean;
  errors?: { message: string }[];
}

export class CloudflareAIService implements IAIService {
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const model = process.env.CLOUDFLARE_AI_MODEL ?? "@cf/meta/llama-3.1-70b-instruct";
    const token = process.env.CLOUDFLARE_AI_TOKEN;

    // a checagem de credenciais mora aqui dentro, não no construtor — ver o
    // porquê no parágrafo acima
    if (!accountId || !token) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_AI_TOKEN são obrigatórios");
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Cloudflare AI error: ${res.status}`);

    const data: CloudflareResponse = await res.json();

    // a Cloudflare responde 200 OK mesmo em alguns erros de modelo —
    // o campo success é quem realmente diz se deu certo
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message ?? "Cloudflare AI retornou erro");
    }

    return data.result?.response ?? "";
  }
}
```

Salve como `src/infrastructure/services/CloudflareAIService.ts`. Nenhuma feature desta parte consome isso ainda — Nichos não usa IA (o botão "Preencher" do próximo arquivo é só texto estático local). O consumidor real chega na Parte 2 (`RunCampaign`).

---

### Passo 4 — `BasePageLayout` e `LoadingContent`

Toda página de listagem do módulo de prospecção (Nichos agora, Campanhas e Leads mais adiante) usa as duas mesmas peças de layout — por isso entram na fundação, antes da primeira página que as consome.

```tsx
import type { ReactNode } from "react";

interface BasePageLayoutProps {
  title?: string;
  description?: string;
  actions?: ReactNode; // slot pro botão de ação no canto (ex: "Novo nicho")
  children: ReactNode;
}

export function BasePageLayout({ title, description, actions, children }: BasePageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col p-8">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
```

Salve como `src/components/BasePageLayout/BasePageLayout.tsx`. `title`/`description` são opcionais porque nem toda página quer o header padrão — a página de detalhe de campanha (Parte 3), por exemplo, monta o próprio cabeçalho.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingContentProps {
  title?: string;
  withHeader?: boolean;
  rows?: number; // quantas linhas de skeleton — ajusta pela densidade real da lista
}

export function LoadingContent({ title, withHeader = true, rows = 4 }: LoadingContentProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {withHeader && (
        <div className="space-y-2">
          {title && <p className="text-sm text-muted-foreground">{title}</p>}
          <Skeleton className="h-8 w-64" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

Salve como `src/components/shared/loading-content.tsx`. É exatamente o fallback que o `Suspense` mostra enquanto o Data Loader (ver `0_Conceitos-e-Mapa-de-Arquivos.md`) resolve a query.
