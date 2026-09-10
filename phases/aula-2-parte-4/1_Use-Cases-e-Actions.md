# Aula 2 · Parte 4 — 1. Use Cases e Server Actions

> Parte de `aula-2-parte-4`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Verificacao-e-Armadilhas.md`.

---

### Passo 1 — `UpdateLeadStatus`

O use case mais simples desta parte — muda o status de um lead, com o mesmo padrão "busca antes de escrever" já usado em `UpdateNiche` (Parte 1).

```typescript
import type { ILeadRepository, Lead, LeadStatus } from "@/domain/repositories/ILeadRepository";

type Input = { leadId: string; companyId: string; status: LeadStatus };
type Result = { ok: true; data: Lead } | { ok: false; error: string };

export class UpdateLeadStatus {
  constructor(private leadRepo: ILeadRepository) {}

  async execute({ leadId, companyId, status }: Input): Promise<Result> {
    try {
      const existing = await this.leadRepo.findById(leadId, companyId);
      if (!existing) return { ok: false, error: "Lead não encontrado" };
      const lead = await this.leadRepo.update(leadId, companyId, { status });
      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar lead" };
    }
  }
}
```

Salve como `src/use-cases/leads/UpdateLeadStatus.ts`.

---

### Passo 2 — `GenerateDiagnosis`

Monta um prompt com os dados do lead + as dores/serviços do nicho (contexto que só existe porque o nicho já capturou isso no formulário da Parte 1), pede à IA um JSON com dois campos, e persiste o resultado no próprio lead.

```typescript
import type { IAIService } from "@/domain/services/IAIService";
import type { ILeadRepository, Lead } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

type Input = { leadId: string; companyId: string };
type Result = { ok: true; data: Lead } | { ok: false; error: string };

const SYSTEM_PROMPT = `Você é um consultor de marketing digital especialista em prospecção ativa para agências.
Analise o lead e responda APENAS com JSON válido, sem texto extra:
{ "aiOverview": "parágrafo curto sobre o negócio e oportunidade", "suggestedOffer": "oferta em uma linha" }`;

export class GenerateDiagnosis {
  constructor(
    private leadRepo: ILeadRepository,
    private nicheRepo: INicheRepository,
    private aiService: IAIService
  ) {}

  async execute({ leadId, companyId }: Input): Promise<Result> {
    const lead = await this.leadRepo.findById(leadId, companyId);
    if (!lead) return { ok: false, error: "Lead não encontrado" };

    const niche = await this.nicheRepo.findById(lead.nicheId, companyId);

    // o prompt reaproveita exatamente os campos que o formulário de nicho
    // (Parte 1) captura — targetServices e commonPains não são só texto
    // decorativo na UI, alimentam a geração de diagnóstico de verdade
    const userPrompt = `Lead: ${lead.name} | Cidade: ${lead.city} | Nicho: ${niche?.name ?? ""}
Website: ${lead.hasWebsite} | Instagram: ${lead.hasInstagram} | Avaliação: ${lead.rating ?? "N/A"} (${lead.reviewCount ?? 0} avaliações)
Serviços da agência: ${niche?.targetServices.join(", ") ?? ""}
Dores do nicho: ${niche?.commonPains.join(", ") ?? ""}`;

    try {
      const raw = await this.aiService.complete(SYSTEM_PROMPT, userPrompt);
      const json = JSON.parse(raw.trim()) as { aiOverview: string; suggestedOffer: string };

      const updated = await this.leadRepo.update(leadId, companyId, {
        aiOverview: json.aiOverview,
        suggestedOffer: json.suggestedOffer,
      });

      return { ok: true, data: updated };
    } catch (e) {
      // cobre tanto falha de rede/credencial (aiService.complete) quanto
      // JSON malformado vindo da IA (JSON.parse) — o mesmo catch trata os dois,
      // já que pra quem usa o retorno da action tanto faz qual dos dois foi
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao gerar diagnóstico" };
    }
  }
}
```

Salve como `src/use-cases/leads/GenerateDiagnosis.ts`.

---

### Passo 3 — `GenerateMessage`

Usa o `baseMessageTemplate` do nicho (o campo com `{nome}`/`{cidade}` que você preencheu no formulário da Parte 1) como ponto de partida, mas não faz substituição de variável na mão — pede pra própria IA personalizar, já considerando o diagnóstico gerado no passo anterior (se existir).

```typescript
import type { IAIService } from "@/domain/services/IAIService";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

type Input = { leadId: string; companyId: string };
type Result = { ok: true; message: string } | { ok: false; error: string };

const SYSTEM_PROMPT = `Você é especialista em copy para prospecção via WhatsApp.
Gere uma mensagem de abordagem com no máximo 300 caracteres.
Use o template como base, personalize com os dados do lead.
Responda APENAS com o texto da mensagem, sem aspas ou formatação.`;

export class GenerateMessage {
  constructor(
    private leadRepo: ILeadRepository,
    private nicheRepo: INicheRepository,
    private aiService: IAIService
  ) {}

  async execute({ leadId, companyId }: Input): Promise<Result> {
    const lead = await this.leadRepo.findById(leadId, companyId);
    if (!lead) return { ok: false, error: "Lead não encontrado" };

    const niche = await this.nicheRepo.findById(lead.nicheId, companyId);

    const userPrompt = `Template do nicho: ${niche?.baseMessageTemplate ?? "Olá, {nome}! Vi que vocês estão em {cidade}."}
Lead: ${lead.name} | Cidade: ${lead.city}
Diagnóstico: ${lead.aiOverview ?? "Sem diagnóstico"}`;

    try {
      const message = await this.aiService.complete(SYSTEM_PROMPT, userPrompt);
      // corta em 300 mesmo que a IA ignore a instrução do prompt — nunca confie
      // só na instrução de texto livre pra garantir uma invariante de tamanho
      return { ok: true, message: message.trim().slice(0, 300) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao gerar mensagem" };
    }
  }
}
```

Salve como `src/use-cases/leads/GenerateMessage.ts`.

---

### Passo 4 — As três Server Actions

```typescript
"use server";

import type { LeadStatus } from "@/domain/repositories/ILeadRepository";
import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { UpdateLeadStatus } from "@/use-cases/leads/UpdateLeadStatus";

export async function updateLeadStatusAction(leadId: string, status: LeadStatus) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);
  const repo = new DrizzleLeadRepository(db);
  const useCase = new UpdateLeadStatus(repo);
  return useCase.execute({ leadId, companyId, status });
}
```

Salve como `src/app/actions/leads/update-lead-status.ts`. `LeadStatus` já é exportado por `ILeadRepository.ts` — reaproveita o mesmo union type do schema, sem redeclarar um array `as const` local.

```typescript
"use server";

import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { GenerateDiagnosis } from "@/use-cases/leads/GenerateDiagnosis";
import { requireCompany, requireUser } from "@/lib/tenant";

export async function generateDiagnosisAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const leadRepo = new DrizzleLeadRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);
  const aiService = new CloudflareAIService();

  const useCase = new GenerateDiagnosis(leadRepo, nicheRepo, aiService);
  return useCase.execute({ leadId, companyId });
}
```

Salve como `src/app/actions/leads/generate-diagnosis.ts`. Repare que `new CloudflareAIService()` aqui não corre o risco da Armadilha 3 da Parte 2 — essa action roda de forma síncrona (sem `after()`), então mesmo que algo lançasse na instanciação, a Server Action inteira retornaria erro pro cliente normalmente, sem deixar nenhum registro preso em estado intermediário.

```typescript
"use server";

import { db } from "@/infrastructure/db";
import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { CloudflareAIService } from "@/infrastructure/services/CloudflareAIService";
import { GenerateMessage } from "@/use-cases/leads/GenerateMessage";
import { requireCompany, requireUser } from "@/lib/tenant";

export async function generateMessageAction(leadId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const leadRepo = new DrizzleLeadRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);
  const aiService = new CloudflareAIService();

  const useCase = new GenerateMessage(leadRepo, nicheRepo, aiService);
  return useCase.execute({ leadId, companyId });
}
```

Salve como `src/app/actions/leads/generate-message.ts`.

> A leitura inicial dos leads **não** tem Server Action própria — o Data Loader da página (`leads/page.tsx`, `aula-2-parte-5/`) lê direto dos repositórios no servidor. As três actions acima são só de **escrita/IA**.
