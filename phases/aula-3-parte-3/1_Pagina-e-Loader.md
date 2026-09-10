# Aula 3 · Parte 3 — 1. Página e Loader

> Parte de `aula-3-parte-3`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Kanban-Board-e-Drawer.md`.

---

### Passo 1 — `FunilContentLoader.tsx`: isolando o `dynamic(ssr:false)`

Crie `src/app/(protected)/funil/_components/FunilContentLoader.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

export const FunilContent = dynamic(
  () => import("./FunilContent").then((mod) => mod.FunilContent),
  { ssr: false }
);
```

Este arquivo não tem nenhuma lógica própria — existe só pra satisfazer a exigência do Next.js 16 (ver `0_Conceitos-e-Mapa-de-Arquivos.md`) de que `dynamic(ssr:false)` fique dentro de um Client Component. `page.tsx` importa `FunilContent` **deste** arquivo, não diretamente de `FunilContent.tsx`.

---

### Passo 2 — `funil/page.tsx`: Server Component thin

Mesmo formato de toda página de listagem desde a Fase 2: `generateMetadata` + `BasePageLayout` + `Suspense` com skeleton + um Data Loader `async` interno, lendo direto dos repositórios — sem Server Action de bootstrap.

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
import { DrizzleFunnelStageRepository } from "@/infrastructure/repositories/DrizzleFunnelStageRepository";
import { SeedFunnelStages } from "@/use-cases/funil/SeedFunnelStages";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { FunilContent } from "./_components/FunilContentLoader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Funil" };
}

export default function FunilPage() {
  return (
    <BasePageLayout>
      <Suspense
        fallback={<LoadingContent title="Carregando funil..." withHeader={false} rows={6} />}
      >
        <FunilDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

async function FunilDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const stageRepo = new DrizzleFunnelStageRepository(db);
  const crmLeadRepo = new DrizzleCrmLeadRepository(db);

  // Seed lazy: garante as etapas padrão na primeira visita de uma empresa nova
  // (ver "por que lazy" em aula-3-parte-2/0_Conceitos-e-Mapa-de-Arquivos.md)
  const seedResult = await new SeedFunnelStages(stageRepo).execute({ companyId });
  const stages = seedResult.ok ? seedResult.data : await stageRepo.findAllByCompany(companyId);
  const leads = await crmLeadRepo.findAllByCompany(companyId);

  return <FunilContent initialStages={stages} initialLeads={leads} />;
}
```

`<BasePageLayout>` é chamado sem `title`/`description` — igual à página de detalhe de campanha na Fase 2 — porque `FunilContent` monta o próprio cabeçalho (título "Funil" + contador de leads + busca + botão "Novo Lead"), com mais controle sobre o layout do que o slot padrão do `BasePageLayout` permitiria.

**Note o `if (seedResult.ok) ... else ...` no lugar de simplesmente confiar no retorno do seed**: se `SeedFunnelStages` falhar por qualquer motivo (ex: uma condição de corrida rara em `bulkCreate`), o Data Loader ainda tenta ler as etapas existentes via `findAllByCompany` antes de desistir — nunca deixa a página quebrar só porque o seed, que só precisa rodar uma vez na vida da empresa, teve um problema pontual.
