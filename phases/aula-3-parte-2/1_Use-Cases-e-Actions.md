# Aula 3 · Parte 2 — 1. Use Cases e Server Actions

> Parte de `aula-3-parte-2`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Verificacao-e-Armadilhas.md`.

---

### Passo 1 — `SeedFunnelStages`: as 8 etapas padrão

Crie `src/use-cases/funil/SeedFunnelStages.ts`:

```typescript
import type {
  CreateFunnelStageData,
  FunnelStage,
  IFunnelStageRepository,
} from "@/domain/repositories/IFunnelStageRepository";

type Input = { companyId: string };
type Result = { ok: true; data: FunnelStage[] } | { ok: false; error: string };

const DEFAULT_STAGES: Omit<CreateFunnelStageData, "companyId">[] = [
  { name: "Triagem", position: 0, colorHex: "#94a3b8", kind: "triage", isActive: true },
  { name: "Novo", position: 1, colorHex: "#6366f1", kind: "normal", isActive: true },
  { name: "Contato Iniciado", position: 2, colorHex: "#8b5cf6", kind: "normal", isActive: true },
  { name: "Respondeu", position: 3, colorHex: "#f59e0b", kind: "normal", isActive: true },
  { name: "Reunião Marcada", position: 4, colorHex: "#f97316", kind: "normal", isActive: true },
  { name: "Proposta Enviada", position: 5, colorHex: "#06b6d4", kind: "normal", isActive: true },
  { name: "Fechado", position: 6, colorHex: "#22c55e", kind: "won", isActive: true },
  { name: "Perdido", position: 7, colorHex: "#ef4444", kind: "lost", isActive: true },
];

export class SeedFunnelStages {
  constructor(private stageRepo: IFunnelStageRepository) {}

  async execute(input: Input): Promise<Result> {
    try {
      // idempotência: se a empresa já tem QUALQUER etapa, assume que o seed já
      // rodou — nunca insere de novo, nunca compara nome a nome
      const existing = await this.stageRepo.countByCompany(input.companyId);
      if (existing > 0) {
        const stages = await this.stageRepo.findAllByCompany(input.companyId);
        return { ok: true, data: stages };
      }

      // bulkCreate de uma vez só — o índice único (companyId, position) do
      // schema (Parte 1) exigiria cuidado extra se fosse um insert por vez
      const stages = await this.stageRepo.bulkCreate(
        DEFAULT_STAGES.map((stage) => ({ ...stage, companyId: input.companyId }))
      );
      return { ok: true, data: stages };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar etapas padrão" };
    }
  }
}
```

---

### Passo 2 — `CreateCrmLead`: lead manual entra em Triagem

Crie `src/use-cases/funil/CreateCrmLead.ts`. Quem escolhe a etapa (`stageId`) é o *caller* — a action recebe do formulário, e o formulário (Parte 3) sempre usa a etapa de Triagem como destino fixo pra criação manual:

```typescript
import type { CreateCrmLeadData, CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";

type Input = CreateCrmLeadData & { createdBy: string };
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class CreateCrmLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadActivityRepo: ILeadActivityRepository
  ) {}

  async execute(input: Input): Promise<Result> {
    try {
      if (!input.name.trim()) return { ok: false, error: "Nome do lead é obrigatório" };

      const { createdBy, ...data } = input;
      const lead = await this.crmLeadRepo.create(data);

      // toda criação de lead deixa rastro no histórico — mesmo padrão que
      // MoveLead usa pra movimentação, só que sem fromStageId (lead nasce, não vem de lugar nenhum)
      await this.leadActivityRepo.create({
        companyId: lead.companyId,
        leadId: lead.id,
        fromStageId: null,
        toStageId: lead.stageId,
        description: "Lead criado manualmente",
        createdBy,
      });

      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar lead" };
    }
  }
}
```

---

### Passo 3 — `MoveLead`: no-op na mesma coluna

Crie `src/use-cases/funil/MoveLead.ts`. A checagem `lead.stageId === input.toStageId` existe porque `@dnd-kit` dispara `onDragEnd` mesmo quando o card volta pra coluna de onde saiu (Parte 3) — sem ela, cada "arrasto indeciso" geraria uma atividade falsa de movimentação:

```typescript
import type { CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";

type Input = {
  leadId: string;
  companyId: string;
  toStageId: string;
  toStageName: string;
  fromStageName: string;
  userId: string;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class MoveLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadActivityRepo: ILeadActivityRepository
  ) {}

  async execute(input: Input): Promise<Result> {
    try {
      const lead = await this.crmLeadRepo.findById(input.leadId, input.companyId);
      if (!lead) return { ok: false, error: "Lead não encontrado" };

      // solto na mesma coluna: devolve o lead como está, sem tocar no banco
      // nem gerar atividade — ver Armadilha em 2_Verificacao-e-Armadilhas.md
      if (lead.stageId === input.toStageId) return { ok: true, data: lead };

      const updated = await this.crmLeadRepo.updateStage(
        input.leadId,
        input.companyId,
        input.toStageId
      );

      await this.leadActivityRepo.create({
        companyId: input.companyId,
        leadId: input.leadId,
        fromStageId: lead.stageId,
        toStageId: input.toStageId,
        description: `Lead movido de ${input.fromStageName} para ${input.toStageName}`,
        createdBy: input.userId,
      });

      return { ok: true, data: updated };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao mover lead" };
    }
  }
}
```

Note que `toStageName`/`fromStageName` vêm prontos no input, não são resolvidos aqui — quem já tem a lista de etapas em memória (o Client Component do Kanban, Parte 3) resolve o nome antes de chamar a action. Evita o use case precisar do `IFunnelStageRepository` só pra montar uma frase.

---

### Passo 4 — `UpdateCrmLead`: nunca move de etapa

Crie `src/use-cases/funil/UpdateCrmLead.ts`. O tipo do `data` (`Omit<..., "stageId" | "companyId" | "origin" | "prospectingLeadId">`) é a garantia — em tempo de compilação, não em runtime — de que este use case não consegue mexer na etapa, na empresa ou na origem do lead, só nos campos editáveis pelo usuário:

```typescript
import type {
  CreateCrmLeadData,
  CrmLead,
  ICrmLeadRepository,
} from "@/domain/repositories/ICrmLeadRepository";

type Input = {
  id: string;
  companyId: string;
  data: Partial<Omit<CreateCrmLeadData, "stageId" | "companyId" | "origin" | "prospectingLeadId">>;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class UpdateCrmLead {
  constructor(private crmLeadRepo: ICrmLeadRepository) {}

  async execute(input: Input): Promise<Result> {
    try {
      const lead = await this.crmLeadRepo.update(input.id, input.companyId, input.data);
      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar lead" };
    }
  }
}
```

---

### Passo 5 — `ConvertProspectingLead`: o use case mais denso da fase

Crie `src/use-cases/funil/ConvertProspectingLead.ts`. Cinco dependências injetadas — mais que qualquer outro use case do projeto até aqui — porque a conversão toca três domínios ao mesmo tempo: CRM (criar o lead + histórico), Funil (garantir e escolher etapa) e Prospecção (ler o lead original e o nicho):

```typescript
import type { CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { IFunnelStageRepository } from "@/domain/repositories/IFunnelStageRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";
import { SeedFunnelStages } from "@/use-cases/funil/SeedFunnelStages";

type Input = {
  prospectingLeadId: string;
  companyId: string;
  userId: string;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class ConvertProspectingLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadRepo: ILeadRepository,
    private leadActivityRepo: ILeadActivityRepository,
    private stageRepo: IFunnelStageRepository,
    private nicheRepo: INicheRepository
  ) {}

  async execute({ prospectingLeadId, companyId, userId }: Input): Promise<Result> {
    try {
      // idempotência: converter o mesmo lead duas vezes é um erro de negócio,
      // não uma falha técnica — devolve { ok: false } com mensagem clara
      const already = await this.crmLeadRepo.findByProspectingLeadId(prospectingLeadId, companyId);
      if (already) return { ok: false, error: "Lead já convertido" };

      const prospectingLead = await this.leadRepo.findById(prospectingLeadId, companyId);
      if (!prospectingLead) return { ok: false, error: "Lead de prospecção não encontrado" };

      // regra de negócio: garante que as etapas existem (empresa nunca visitou
      // /funil antes) e escolhe a etapa de entrada — a primeira "normal" por
      // posição (fallback: a primeira de todas, se por algum motivo não houver "normal")
      const seed = await new SeedFunnelStages(this.stageRepo).execute({ companyId });
      const stages = seed.ok ? seed.data : await this.stageRepo.findAllByCompany(companyId);
      const targetStage =
        stages.filter((s) => s.kind === "normal").sort((a, b) => a.position - b.position)[0] ??
        stages.slice().sort((a, b) => a.position - b.position)[0];
      if (!targetStage) return { ok: false, error: "Nenhuma etapa de funil disponível" };

      const niche = await this.nicheRepo.findById(prospectingLead.nicheId, companyId);

      const crmLead = await this.crmLeadRepo.create({
        companyId,
        prospectingLeadId: prospectingLead.id,
        stageId: targetStage.id,
        name: prospectingLead.name,
        phone: prospectingLead.phone,
        email: prospectingLead.email,
        niche: niche?.name ?? null,
        subniche: null,
        origin: "prospecting",
        value: null, // valor estimado ainda não existe no lead de prospecção — usuário preenche no drawer
        notes: null,
      });

      await this.leadActivityRepo.create({
        companyId,
        leadId: crmLead.id,
        fromStageId: null,
        toStageId: targetStage.id,
        description: "Lead convertido da prospecção",
        createdBy: userId,
      });

      return { ok: true, data: crmLead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao converter lead" };
    }
  }
}
```

---

### Passo 6 — As 5 Server Actions

Todas seguem o padrão de sempre — `requireUser()` → `requireCompany()` → validar com Zod → instanciar repositórios → chamar use case.

Crie `src/app/actions/funil/create-crm-lead.ts`:

```typescript
"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";
import { CreateCrmLead } from "@/use-cases/funil/CreateCrmLead";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  niche: z.string().optional().nullable(),
  subniche: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  stageId: z.string().uuid(),
});

export async function createCrmLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const leadActivityRepo = new DrizzleLeadActivityRepository(db);
  const useCase = new CreateCrmLead(crmLeadRepo, leadActivityRepo);

  return useCase.execute({
    companyId,
    prospectingLeadId: null,
    stageId: parsed.data.stageId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    niche: parsed.data.niche || null,
    subniche: parsed.data.subniche || null,
    origin: "manual",
    value: parsed.data.value ?? null,
    notes: parsed.data.notes || null,
    createdBy: user.id,
  });
}
```

Crie `src/app/actions/funil/move-lead.ts`:

```typescript
"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";
import { MoveLead } from "@/use-cases/funil/MoveLead";

const schema = z.object({
  leadId: z.string().uuid(),
  toStageId: z.string().uuid(),
  toStageName: z.string().min(1),
  fromStageName: z.string().min(1),
});

export async function moveLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const leadActivityRepo = new DrizzleLeadActivityRepository(db);
  const useCase = new MoveLead(crmLeadRepo, leadActivityRepo);

  return useCase.execute({ ...parsed.data, companyId, userId: user.id });
}
```

Crie `src/app/actions/funil/update-crm-lead.ts`:

```typescript
"use server";

import { z } from "zod";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { UpdateCrmLead } from "@/use-cases/funil/UpdateCrmLead";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  niche: z.string().optional().nullable(),
  subniche: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function updateCrmLeadAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { id, ...data } = parsed.data;
  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const useCase = new UpdateCrmLead(crmLeadRepo);

  return useCase.execute({ id, companyId, data });
}
```

Crie `src/app/actions/funil/get-lead-activities.ts` — leitura sob demanda, chamada só quando o usuário abre a aba "Histórico" no drawer (Parte 3), pra não carregar o histórico de todo lead no bootstrap inicial da página:

```typescript
"use server";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";

export async function getLeadActivitiesAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const repo = new DrizzleLeadActivityRepository(db);
  const activities = await repo.findByLead(leadId, companyId);
  return { ok: true as const, data: activities };
}
```

Crie `src/app/actions/leads/convert-prospecting-lead.ts` — note que este arquivo mora em `app/actions/leads/`, não em `app/actions/funil/`: é acionado a partir da tela de **Leads** da prospecção (Parte 4), mesmo produzindo um `CrmLead` do funil. A pasta reflete de onde a ação é disparada, não a tabela que ela escreve:

```typescript
"use server";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleFunnelStageRepository } from "@/infrastructure/repositories/DrizzleFunnelStageRepository";
import { DrizzleLeadActivityRepository } from "@/infrastructure/repositories/DrizzleLeadActivityRepository";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { ConvertProspectingLead } from "@/use-cases/funil/ConvertProspectingLead";

export async function convertProspectingLeadAction(prospectingLeadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const crmLeadRepo = new DrizzleCrmLeadRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);
  const stageRepo = new DrizzleFunnelStageRepository(db);
  const leadActivityRepo = new DrizzleLeadActivityRepository(db);

  const useCase = new ConvertProspectingLead(
    crmLeadRepo,
    leadRepo,
    leadActivityRepo,
    stageRepo,
    nicheRepo
  );
  return useCase.execute({ prospectingLeadId, companyId, userId: user.id });
}
```

Nenhuma dessas 5 actions é consumida ainda — o consumo real (formulários, drag-and-drop, botão de conversão) chega nas Partes 3 e 4.
