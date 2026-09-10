# Aula 3 · Parte 1 — 1. Fundação: Schema, Domain e Infra

> Parte de `aula-3-parte-1`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Verificacao-e-Armadilhas.md`.

---

### Passo 1 — Dependência: `@dnd-kit`

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Nenhum componente shadcn adicional é necessário: `sheet`, `tabs`, `dialog`, `select`, `textarea`, `badge`, `input`, `label`, `button` já vieram da Fase 2. O `<Toaster />` do sonner já está montado em `src/app/layout.tsx` desde a Fase 1. `@dnd-kit/sortable` e `@dnd-kit/utilities` não são usados nesta fase (o Kanban da Parte 3 usa só `useDraggable`/`useDroppable` do pacote `core`, sem reordenar dentro da mesma coluna) — instalados juntos porque é o pacote irmão de sempre para drag-and-drop com `@dnd-kit`, e evita uma segunda instalação se a reordenação virar necessidade mais adiante.

---

### Passo 2 — Schema: 2 enums + 3 tabelas

Adicione `numeric` ao import de `drizzle-orm/pg-core` em `src/infrastructure/db/schema.ts` — é o único tipo de coluna novo desta fase:

```typescript
import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric, // novo — ver "numeric chega como string" em 0_Conceitos
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

Cole as três tabelas ao final do arquivo, depois de `prospectingLeadsTable`:

```typescript
// ── Funil Comercial — Fase 3 ─────────────────────────────────────────────────

export const stageKindEnum = pgEnum("stage_kind", ["normal", "won", "lost", "triage"]);

export const funnelStagesTable = pgTable(
  "funnel_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(), // ordem de exibição no board — 0 é a coluna mais à esquerda
    colorHex: varchar("color_hex", { length: 7 }).notNull().default("#6366f1"),
    kind: stageKindEnum("kind").notNull().default("normal"), // ver abaixo — governa borda da coluna e regra de destino
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    // impede duas etapas da mesma empresa ocuparem a mesma posição —
    // o seed (Parte 2) depende deste índice pra nunca duplicar
    companyPositionUnique: uniqueIndex("funnel_stages_company_position_unique").on(
      t.companyId,
      t.position
    ),
  })
);

export const crmLeadOriginEnum = pgEnum("crm_lead_origin", ["manual", "prospecting"]);

export const crmLeadsTable = pgTable(
  "crm_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    // nullable — só é preenchido quando origin: "prospecting" (Parte 2, ConvertProspectingLead);
    // "set null" porque apagar o lead de prospecção original não deveria apagar o lead do CRM
    prospectingLeadId: uuid("prospecting_lead_id").references(
      () => prospectingLeadsTable.id,
      { onDelete: "set null" }
    ),
    // "restrict" — nunca deixa apagar uma etapa que ainda tem lead nela
    stageId: uuid("stage_id")
      .notNull()
      .references(() => funnelStagesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    niche: text("niche"),
    subniche: text("subniche"),
    origin: crmLeadOriginEnum("origin").notNull().default("manual"),
    value: numeric("value", { precision: 10, scale: 2 }), // guarda como string — ver 0_Conceitos
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("crm_leads_company_id_idx").on(t.companyId),
    stageIdIdx: index("crm_leads_stage_id_idx").on(t.stageId),
  })
);

export const leadActivitiesTable = pgTable(
  "lead_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => crmLeadsTable.id, { onDelete: "cascade" }),
    // nullable — a primeira atividade de um lead ("Lead criado", "Lead convertido
    // da prospecção") não tem etapa de origem, só destino
    fromStageId: uuid("from_stage_id").references(() => funnelStagesTable.id, {
      onDelete: "set null",
    }),
    toStageId: uuid("to_stage_id").references(() => funnelStagesTable.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(), // texto pronto, gerado no use-case — ver Parte 2
    createdBy: text("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    leadIdIdx: index("lead_activities_lead_id_idx").on(t.leadId),
    createdAtIdx: index("lead_activities_created_at_idx").on(t.createdAt),
  })
);
```

**Os 4 valores de `kind`** governam o board sem precisar de `if (stage.name === "Ganho")` espalhado pelo código: `triage` é onde leads manuais entram (Parte 2), `normal` é qualquer etapa intermediária, `won`/`lost` marcam as etapas terminais — usadas na Parte 3 só para colorir a borda da coluna (`STAGE_KIND_BORDER_CLASSES`, Passo 4), sem nenhuma regra de negócio adicional presa a elas nesta fase.

Aplique no Neon:

```bash
npx drizzle-kit push
```

Resultado esperado: 2 enums + 3 tabelas novas, sem prompt destrutivo (nenhuma coluna existente muda).

---

### Passo 3 — Domain: três interfaces puras

Mesmo padrão de `INicheRepository`/`ILeadRepository` (Fase 2): tipos e contratos, zero import de Drizzle ou qualquer lib externa.

Crie `src/domain/repositories/IFunnelStageRepository.ts`:

```typescript
export type StageKind = "normal" | "won" | "lost" | "triage";

export interface FunnelStage {
  id: string;
  companyId: string;
  name: string;
  position: number;
  colorHex: string;
  kind: StageKind;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateFunnelStageData = Omit<FunnelStage, "id" | "createdAt" | "updatedAt">;

export interface IFunnelStageRepository {
  findAllByCompany(companyId: string): Promise<FunnelStage[]>;
  findById(id: string, companyId: string): Promise<FunnelStage | null>;
  countByCompany(companyId: string): Promise<number>; // usado pelo seed lazy (Parte 2) pra decidir se já rodou
  bulkCreate(stages: CreateFunnelStageData[]): Promise<FunnelStage[]>;
  update(id: string, companyId: string, data: Partial<CreateFunnelStageData>): Promise<FunnelStage>;
}
```

Crie `src/domain/repositories/ICrmLeadRepository.ts`:

```typescript
export type CrmLeadOrigin = "manual" | "prospecting";

export interface CrmLead {
  id: string;
  companyId: string;
  prospectingLeadId: string | null;
  stageId: string;
  name: string;
  phone: string | null;
  email: string | null;
  niche: string | null;
  subniche: string | null;
  origin: CrmLeadOrigin;
  value: number | null; // number aqui, string só dentro da infra — ver 0_Conceitos
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateCrmLeadData = Omit<CrmLead, "id" | "createdAt" | "updatedAt">;

export interface ICrmLeadRepository {
  findAllByCompany(companyId: string): Promise<CrmLead[]>;
  findById(id: string, companyId: string): Promise<CrmLead | null>;
  findByProspectingLeadId(prospectingLeadId: string, companyId: string): Promise<CrmLead | null>; // idempotência do ConvertProspectingLead (Parte 2)
  findConvertedProspectingLeadIds(companyId: string): Promise<string[]>; // alimenta o botão "Já convertido" na tela de Leads (Parte 4)
  create(data: CreateCrmLeadData): Promise<CrmLead>;
  update(id: string, companyId: string, data: Partial<Omit<CreateCrmLeadData, "stageId">>): Promise<CrmLead>;
  updateStage(id: string, companyId: string, stageId: string): Promise<CrmLead>;
}
```

Crie `src/domain/repositories/ILeadActivityRepository.ts`:

```typescript
export interface LeadActivity {
  id: string;
  companyId: string;
  leadId: string;
  fromStageId: string | null;
  toStageId: string | null;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export type CreateLeadActivityData = Omit<LeadActivity, "id" | "createdAt">;

export interface ILeadActivityRepository {
  findByLead(leadId: string, companyId: string): Promise<LeadActivity[]>;
  create(data: CreateLeadActivityData): Promise<LeadActivity>;
}
```

---

### Passo 4 — Infrastructure: três repositórios Drizzle

Mesmo padrão de `DrizzleNicheRepository` (Fase 2): `constructor(private db: DB)`, toda query com `and(eq(id, ...), eq(companyId, ...))`.

Crie `src/infrastructure/repositories/DrizzleFunnelStageRepository.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateFunnelStageData,
  FunnelStage,
  IFunnelStageRepository,
} from "@/domain/repositories/IFunnelStageRepository";
import { funnelStagesTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleFunnelStageRepository implements IFunnelStageRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<FunnelStage[]> {
    return this.db
      .select()
      .from(funnelStagesTable)
      .where(eq(funnelStagesTable.companyId, companyId))
      .orderBy(funnelStagesTable.position);
  }

  async findById(id: string, companyId: string): Promise<FunnelStage | null> {
    const [row] = await this.db
      .select()
      .from(funnelStagesTable)
      .where(and(eq(funnelStagesTable.id, id), eq(funnelStagesTable.companyId, companyId)))
      .limit(1);
    return row ?? null;
  }

  async countByCompany(companyId: string): Promise<number> {
    const rows = await this.db
      .select({ id: funnelStagesTable.id })
      .from(funnelStagesTable)
      .where(eq(funnelStagesTable.companyId, companyId));
    return rows.length;
  }

  async bulkCreate(stages: CreateFunnelStageData[]): Promise<FunnelStage[]> {
    return this.db.insert(funnelStagesTable).values(stages).returning();
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<CreateFunnelStageData>
  ): Promise<FunnelStage> {
    const [row] = await this.db
      .update(funnelStagesTable)
      .set(data)
      .where(and(eq(funnelStagesTable.id, id), eq(funnelStagesTable.companyId, companyId)))
      .returning();
    return row;
  }
}
```

Crie `src/infrastructure/repositories/DrizzleCrmLeadRepository.ts` — o único dos três com uma peculiaridade, os helpers `toDomain`/`normalizeValue` explicados em `0_Conceitos-e-Mapa-de-Arquivos.md`:

```typescript
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateCrmLeadData,
  CrmLead,
  ICrmLeadRepository,
} from "@/domain/repositories/ICrmLeadRepository";
import { crmLeadsTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;
type CrmLeadRow = typeof crmLeadsTable.$inferSelect;

// numeric chega como string do Postgres — nunca deixa isso vazar pro domínio
function toDomain(row: CrmLeadRow): CrmLead {
  return { ...row, value: row.value == null ? null : Number(row.value) };
}

// undefined ("campo não veio no patch") ≠ null ("limpar o valor") — ver 0_Conceitos
function normalizeValue(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value == null ? null : String(value);
}

export class DrizzleCrmLeadRepository implements ICrmLeadRepository {
  constructor(private db: DB) {}

  async findAllByCompany(companyId: string): Promise<CrmLead[]> {
    const rows = await this.db
      .select()
      .from(crmLeadsTable)
      .where(eq(crmLeadsTable.companyId, companyId))
      .orderBy(crmLeadsTable.createdAt);
    return rows.map(toDomain);
  }

  async findById(id: string, companyId: string): Promise<CrmLead | null> {
    const [row] = await this.db
      .select()
      .from(crmLeadsTable)
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByProspectingLeadId(
    prospectingLeadId: string,
    companyId: string
  ): Promise<CrmLead | null> {
    const [row] = await this.db
      .select()
      .from(crmLeadsTable)
      .where(
        and(
          eq(crmLeadsTable.prospectingLeadId, prospectingLeadId),
          eq(crmLeadsTable.companyId, companyId)
        )
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findConvertedProspectingLeadIds(companyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ prospectingLeadId: crmLeadsTable.prospectingLeadId })
      .from(crmLeadsTable)
      .where(eq(crmLeadsTable.companyId, companyId));
    return rows
      .map((r) => r.prospectingLeadId)
      .filter((id): id is string => id !== null);
  }

  async create(data: CreateCrmLeadData): Promise<CrmLead> {
    const [row] = await this.db
      .insert(crmLeadsTable)
      .values({ ...data, value: normalizeValue(data.value) })
      .returning();
    return toDomain(row);
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<Omit<CreateCrmLeadData, "stageId">>
  ): Promise<CrmLead> {
    const [row] = await this.db
      .update(crmLeadsTable)
      .set({ ...data, value: normalizeValue(data.value) })
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .returning();
    return toDomain(row);
  }

  async updateStage(id: string, companyId: string, stageId: string): Promise<CrmLead> {
    const [row] = await this.db
      .update(crmLeadsTable)
      .set({ stageId })
      .where(and(eq(crmLeadsTable.id, id), eq(crmLeadsTable.companyId, companyId)))
      .returning();
    return toDomain(row);
  }
}
```

Crie `src/infrastructure/repositories/DrizzleLeadActivityRepository.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  CreateLeadActivityData,
  ILeadActivityRepository,
  LeadActivity,
} from "@/domain/repositories/ILeadActivityRepository";
import { leadActivitiesTable } from "@/infrastructure/db/schema";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleLeadActivityRepository implements ILeadActivityRepository {
  constructor(private db: DB) {}

  async findByLead(leadId: string, companyId: string): Promise<LeadActivity[]> {
    return this.db
      .select()
      .from(leadActivitiesTable)
      .where(
        and(eq(leadActivitiesTable.leadId, leadId), eq(leadActivitiesTable.companyId, companyId))
      )
      .orderBy(leadActivitiesTable.createdAt);
  }

  async create(data: CreateLeadActivityData): Promise<LeadActivity> {
    const [row] = await this.db.insert(leadActivitiesTable).values(data).returning();
    return row;
  }
}
```

---

### Passo 5 — `src/lib/format.ts`: `formatBRL` e cor de borda por `kind`

```typescript
import type { StageKind } from "@/domain/repositories/IFunnelStageRepository";

// ── CRM / Funil ──────────────────────────────────────────────────────────────

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export const STAGE_KIND_BORDER_CLASSES: Record<StageKind, string> = {
  normal: "border-slate-200",
  won: "border-emerald-300",
  lost: "border-red-300",
  triage: "border-slate-200",
};
```

O `import type { StageKind }` é obrigatório aqui — sem ele, `Record<StageKind, string>` não compila. Fica fácil esquecer porque `format.ts` até agora só importava tipos de status (`CampaignStatus`, `LeadStatus`) do próprio módulo de prospecção; `StageKind` é o primeiro tipo que ele importa de fora dela.
