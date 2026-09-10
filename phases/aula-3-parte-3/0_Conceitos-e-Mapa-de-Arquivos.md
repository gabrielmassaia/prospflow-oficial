# Aula 3 · Parte 3 — Interface Kanban

> **Para a live:** Índice de leitura da Parte 3. Pré-requisito: `aula-3-parte-2/` completa e testada.
> Tempo estimado: ~2h ao vivo — a parte mais densa da Aula 3, um único Client Component concentrando board, drawer e modal.
> Ao final: `/funil` mostra um Kanban de verdade — 8 colunas, cards arrastáveis, drawer de detalhes com histórico, criação de lead manual — consumindo as 5 Server Actions da Parte 2.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Pagina-e-Loader.md` | `funil/page.tsx` (Server Component thin) + `FunilContentLoader.tsx` (isola o `dynamic(ssr:false)`) |
| `2_Kanban-Board-e-Drawer.md` | `FunilContent.tsx` inteiro: colunas, cards, drag-and-drop, drawer, modal de novo lead |
| `3_Verificacao-e-Armadilhas.md` | Teste no navegador (incluindo drag-and-drop real), checklist, armadilhas |

---

## Conceito que você precisa entender antes de codar

### Por que `dynamic(..., { ssr: false })` não pode morar em `page.tsx`

A regra do projeto é literal desde a Fase 2: **Leaflet / DnD → sempre `dynamic(() => import(...), { ssr: false })`.** O motivo é o mesmo dos dois casos: `@dnd-kit`, assim como o Leaflet, toca `document`/`window` durante a inicialização dos sensores de drag — código que só existe no navegador, nunca no servidor.

A diferença em relação a `CampaignMap`/`LeadsMap` (Fase 2) é *onde* essa chamada pode morar. Lá, o `dynamic(ssr:false)` fica dentro de `CampanhaDetailContent`/`LeadsContent`, que já são Client Components (`"use client"`) — a chamada é só mais uma linha num arquivo que já roda no navegador. Aqui, `funil/page.tsx` é um **Server Component** (`generateMetadata` + função `async`) — e o Next.js 16 rejeita explicitamente `dynamic(ssr:false)` dentro de um Server Component:

```
Ecmascript file had an error: "ssr: false" is not allowed with next/dynamic in Server Components. Please move it into a Client Component.
```

A solução é um arquivo `"use client"` dedicado só pra essa chamada — `FunilContentLoader.tsx` — que o `page.tsx` importa como se fosse um componente normal, sem `dynamic` nenhum visível ali:

```tsx
"use client";

import dynamic from "next/dynamic";

export const FunilContent = dynamic(
  () => import("./FunilContent").then((mod) => mod.FunilContent),
  { ssr: false }
);
```

`.then((mod) => mod.FunilContent)` existe porque `dynamic()` espera um componente como *default export*, e `FunilContent` (o componente real, no próximo arquivo) é um *named export* — o `.then()` extrai o componente certo do módulo antes de entregá-lo pro `dynamic()`.

### Um Client Component só, não vários pequenos

`FunilContent.tsx` concentra board, drawer e modal num único arquivo — diferente da tendência geral do projeto de separar em componentes pequenos. A razão é o estado compartilhado: `selectedId` (qual lead está no drawer), `activeId` (qual card está sendo arrastado), `leads` (a lista inteira, atualizada otimisticamente) precisam ser lidos e escritos por praticamente toda função do arquivo — `KanbanColumn`, `DraggableLeadCard`, o drawer e o modal de criação. Espalhar isso em componentes separados forçaria prop-drilling ou um Context só pra esta tela, sem ganho real: é o mesmo padrão de `LeadsContent`/`NichosContent` (Fase 2), levado ao extremo porque aqui há mais estado interdependente.

### Atualização otimista, com reversão em caso de erro

Tanto o drag-and-drop (`handleDragEnd`) quanto o botão "Avançar etapa" (`handleAdvance`) seguem o mesmo padrão de três passos:

1. Atualiza o estado local **antes** da resposta do servidor (`updateLeadLocal`) — a UI responde instantaneamente, sem esperar o round-trip da Server Action.
2. Chama a action (`moveLeadAction`).
3. Se a action falhar, **reverte** o estado local pro valor anterior e mostra `toast.error` — se tiver sucesso, mostra `toast.success` e não faz mais nada (o estado já está correto desde o passo 1).

```tsx
const previousStageId = lead.stageId;
updateLeadLocal(leadId, { stageId: toStageId }); // já atualiza a tela

const result = await moveLeadAction({ leadId, toStageId, toStageName: toStage.name, fromStageName: fromStage?.name ?? "" });

if (!result.ok) {
  updateLeadLocal(leadId, { stageId: previousStageId }); // desfaz se der erro
  toast.error(result.error);
  return;
}
```

Guardar `previousStageId` antes de mexer no estado é o que torna a reversão possível — sem essa variável, não haveria como saber pra onde voltar depois de um erro.

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/(protected)/funil/page.tsx` | Criar | Server Component thin + Data Loader (seed lazy + leitura de etapas/leads) |
| `src/app/(protected)/funil/_components/FunilContentLoader.tsx` | Criar | Isola `dynamic(..., { ssr: false })` num Client Component |
| `src/app/(protected)/funil/_components/FunilContent.tsx` | Criar | Board, drawer, modal de novo lead — toda a interatividade |
