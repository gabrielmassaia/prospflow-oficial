# Aula 4 — 1. Seed Automático na Criação da Empresa

> Parte de `aula-4`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Metadata-Error-e-NotFound.md`.

---

### Passo 1 — `CreateUserWithCompany`: segunda dependência + chamada do seed

A ideia é simples e cabe numa frase: logo depois que a empresa é criada, semear as 8 etapas padrão do funil — e se esse seed falhar por qualquer motivo, **não** derrubar o cadastro inteiro por causa dele. `SeedFunnelStages` (Aula 3) já foi desenhado pra isso: captura o próprio erro e retorna `{ ok: false }` em vez de lançar, então mesmo sem nenhum tratamento especial aqui, uma falha no seed nunca escala pro `catch` de `CreateUserWithCompany.execute()`.

O construtor ganha um segundo parâmetro, `stageRepo: IFunnelStageRepository` — mesma disciplina de injeção de dependência de todo o projeto, nada de instanciar o repositório dentro do use case:

```typescript
import { auth } from "@/lib/auth";
import { translateAuthError } from "@/lib/auth-errors";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository";
import type { IFunnelStageRepository } from "@/domain/repositories/IFunnelStageRepository";
import { SeedFunnelStages } from "@/use-cases/funil/SeedFunnelStages";

interface Input {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

type Result = { ok: true } | { ok: false; error: string };

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export class CreateUserWithCompany {
  constructor(
    private companyRepo: ICompanyRepository,
    private stageRepo: IFunnelStageRepository
  ) {}

  async execute({ name, email, password, companyName }: Input): Promise<Result> {
    try {
      const response = await auth.api.signUpEmail({
        body: { name, email, password },
        asResponse: true,
      });

      if (!response.ok) {
        const err = (await response.json()) as { code?: string; message?: string };
        return { ok: false, error: translateAuthError(err, "Erro ao criar usuário") };
      }

      const data = (await response.json()) as { user: { id: string } };
      const userId = data.user.id;

      const slug = slugify(companyName);

      const company = await this.companyRepo.create({ name: companyName, slug, ownerId: userId });

      // Seed das etapas padrão do funil. Se falhar, execute() acima já devolveu
      // { ok: false } internamente — não lança, então o try/catch daqui em cima
      // nunca é acionado por causa dele. O seed lazy do Data Loader do funil
      // (Aula 3, funil/page.tsx) cobre o caso mesmo assim, como segunda camada.
      await new SeedFunnelStages(this.stageRepo).execute({ companyId: company.id });

      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      return { ok: false, error: message };
    }
  }
}
```

`translateAuthError` já era usado neste arquivo desde a Aula 1 (mensagens de erro do Better Auth traduzidas por `code`, não por `message` — texto instável) — nada muda ali, só o parâmetro novo e a linha do seed.

---

### Passo 2 — `signup.ts`: injetar o novo repositório

```typescript
"use server";

import { z } from "zod";

import { db } from "@/infrastructure/db";
import { DrizzleCompanyRepository } from "@/infrastructure/repositories/DrizzleCompanyRepository";
import { DrizzleFunnelStageRepository } from "@/infrastructure/repositories/DrizzleFunnelStageRepository";
import { CreateUserWithCompany } from "@/use-cases/auth/CreateUserWithCompany";

const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  companyName: z.string().min(2, "Nome da empresa deve ter ao menos 2 caracteres"),
});

export async function signupAction(formData: {
  name: string;
  email: string;
  password: string;
  companyName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = signupSchema.safeParse(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const companyRepo = new DrizzleCompanyRepository(db);
  const stageRepo = new DrizzleFunnelStageRepository(db);
  const useCase = new CreateUserWithCompany(companyRepo, stageRepo);

  return useCase.execute(parsed.data);
}
```

Só uma linha nova de import e uma de instanciação — o resto (validação Zod, formato de retorno) já existia desde a Aula 1 e não muda.

---

### Passo 3 — Validar de verdade, não só ler o código

Esta é a única checagem desta fase que **não dá pra fazer via `curl`**: o cadastro passa por uma Server Action chamada de dentro de um formulário React, então precisa de um navegador de verdade preenchendo os campos. Nesta live, isso foi automatizado com Playwright, num contexto de navegador **novo** (sem os cookies da sessão principal, pra não derrubar o login em uso):

1. Abrir `/register` num contexto sem sessão.
2. Preencher nome, e-mail, senha e nome da empresa; submeter.
3. Confirmar o redirect para `/prospeccao` (dashboard vazio, "0" em todos os cards).
4. Consultar `funnel_stages` diretamente no Neon, filtrando pela empresa recém-criada — **sem nunca ter visitado `/funil`**.

Resultado desta live:

```
[check] empresa: 6e28342c-fd78-4a93-a950-2beb6d6dcc69
[check] etapas do funil: 8
  - 0: Triagem (triage)
  - 1: Novo (normal)
  - 2: Contato Iniciado (normal)
  - 3: Respondeu (normal)
  - 4: Reunião Marcada (normal)
  - 5: Proposta Enviada (normal)
  - 6: Fechado (won)
  - 7: Perdido (lost)
```

As 8 etapas, na ordem certa, com os `kind`s certos — geradas só pelo cadastro, antes de qualquer visita ao Kanban. Depois de confirmado, a conta e a empresa de teste foram removidas do banco (empresa, membro, etapas, usuário, sessão e conta do Better Auth) pra não deixar lixo de teste na base usada na live.
