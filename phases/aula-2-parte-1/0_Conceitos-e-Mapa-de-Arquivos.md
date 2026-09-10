# Aula 2 · Parte 1 — Fundação e Nichos

> **Para a live:** Índice de leitura da Parte 1. Pré-requisito: `aula-1-parte-2/` completa e testada.
> Tempo estimado: ~2 horas ao vivo.
> Ao final: dependências e schema da Fase 2 no ar, e o primeiro CRUD completo do módulo de prospecção — Nichos — funcionando de ponta a ponta.

---

## Por que a Aula 2 vira 6 partes

A Aula 2 é o dobro do tamanho da Aula 1: CRUD completo de Nichos, Campanhas (com busca georreferenciada via Overpass API, mapa Leaflet e execução em background) e Leads (com IA de diagnóstico/mensagem, mapa e sheet de detalhe). Coube em 6 sessões de ~2h, cada uma fechando um pedaço demonstrável:

| Parte | Conteúdo | Demonstrável ao final |
|---|---|---|
| **1** (esta) | Fundação (deps, schema, IA compartilhada) + Nichos completo | CRUD de nichos no navegador |
| 2 | Campanhas: domínio, Overpass, use-cases, actions | Backend testável (sem UI ainda) |
| 3 | Campanhas: UI lista + detalhe + mapa | Criar e rodar campanha, ver leads no mapa |
| 4 | Leads: domínio, IA de diagnóstico/mensagem, actions | Backend testável (sem UI ainda) |
| 5 | Leads: mapa + UI + sheet de detalhe | Fluxo de leads completo no navegador |
| 6 | Dashboard real + Sidebar final + Verificação da aula inteira | Módulo de prospecção fechado |

**Nota de reorganização:** o material original desta fase foi escrito como uma sessão só, então algumas peças (`BasePageLayout`, `LoadingContent`) apareciam documentadas só perto do final, mesmo sendo usadas desde a primeira página. Nesta Parte 1 elas entram cedo — ver `1_Fundacao-Dependencias-e-Schema.md` — porque é aqui que a primeira página (Nichos) já precisa delas. `format.ts` (labels e cores de status) também saiu daqui: como ele tipa `CampaignStatus` e `LeadStatus`, só existe a partir de `aula-2-parte-2/`, quando esses tipos passam a existir.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Fundacao-Dependencias-e-Schema.md` | Dependências (leaflet, sonner, shadcn), schema (3 tabelas + 3 enums), `IAIService`/`CloudflareAIService`, `BasePageLayout`, `LoadingContent` |
| `2_Nichos.md` | Fluxo completo de Nichos: domínio, infraestrutura, use-cases, Server Actions, `TagInput` e UI |
| `3_Verificacao-e-Armadilhas.md` | Aplicar schema, testar no navegador, checklist, armadilhas |

## Constraints globais (valem pra toda a Aula 2)

- Toda action começa com `requireUser()` → `requireCompany(user.id)`
- Toda query filtra por `companyId` — sem exceção
- Retorno de actions: `{ ok: true, data? } | { ok: false, error: string }`
- Repositórios recebem `db` no construtor, nunca importam globalmente
- `domain/` não importa nada externo (sem Drizzle, sem Next.js)
- Leaflet: sempre `dynamic(() => import(...), { ssr: false })` (a partir da Parte 3)
- Modelo Cloudflare AI vem de `process.env.CLOUDFLARE_AI_MODEL`

---

## Conceito que você precisa entender antes de codar

### Server Component lendo direto vs. Client Component buscando via API

Toda página de listagem desta fase (nichos, e depois campanhas e leads) segue o mesmo formato. A ideia central: **a carga inicial é lida direto do repositório, dentro do Server Component** — sem Server Action e sem rota HTTP no meio.

```tsx
export default function NichosPage() {
  return (
    <BasePageLayout title="Nichos" description="Segmentos de mercado que você prospecta">
      {/* Suspense mostra o skeleton só enquanto o Data Loader roda —
          o conteúdo real já chega pronto, sem tela vazia depois */}
      <Suspense fallback={<LoadingContent title="Carregando nichos..." withHeader={false} rows={4} />}>
        <NichosDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

// "Data Loader": função async interna, roda no servidor, consulta o banco direto —
// não existe rota GET, não existe useEffect, não existe fetch
async function NichosDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const nicheRepo = new DrizzleNicheRepository(db);
  const niches = await nicheRepo.findAllByCompany(companyId);

  return <NichosContent initialNiches={niches} />; // vira estado inicial de um Client Component
}
```

`page.tsx` é sempre um **Server Component enxuto**: `generateMetadata` + `BasePageLayout` + `Suspense` com skeleton + uma função `async` interna (o "Data Loader"). O resultado vai como prop (`initial*`) para um **Client Component** em `_components/` dentro da própria rota, que concentra toda a interatividade (formulários, dialogs, mutações).

> **Regra de ouro leitura × escrita:** leitura que acontece **no servidor** (a carga inicial da página) é feita **direto no Server Component**. Server Action é para **escrita** (mutações) — e, mais adiante em Campanhas, também para leitura disparada pelo cliente via polling. Uma Server Action é, por baixo, um `POST`; usá-la para a carga inicial só adicionaria um round-trip HTTP sem ganho nenhum.

**Por que não um Client Component com `useEffect(() => fetch("/api/nichos"))`?** É a alternativa natural pra quem vem de SPA, e funciona — mas custa três coisas:

| | Server Component lendo direto | Client Component + rota GET |
|---|---|---|
| Onde roda a query no banco | No servidor, antes do HTML ser enviado | No servidor também, mas atrás de uma rota HTTP extra |
| Tela em branco / spinner inicial | Não precisa — o skeleton do `Suspense` cobre só o tempo do Data Loader | Sempre existe um primeiro render vazio até o `useEffect` responder |
| Onde fica o guard de tenant | Uma vez, no Data Loader | Duplicado: na rota GET e nas actions de mutação |
| Superfície exposta | Nenhuma rota HTTP nova | Uma rota `route.ts` por recurso, mesmo sem consumidor externo |

A rota GET só faria sentido se algo **fora** do Next.js (app mobile, webhook, outro serviço) precisasse consumir os mesmos dados como API pública — não é o caso aqui.

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/infrastructure/db/schema.ts` | Modificar | +3 enums, +3 tabelas de prospecção |
| `src/domain/services/IAIService.ts` | Criar | Contrato de IA (usado por Campanhas e Leads mais adiante) |
| `src/infrastructure/services/CloudflareAIService.ts` | Criar | Implementação via Cloudflare Workers AI |
| `src/components/BasePageLayout/BasePageLayout.tsx` | Criar | Wrapper de página: título/descrição + padding consistente |
| `src/components/shared/loading-content.tsx` | Criar | Skeleton exibido pelo `Suspense` |
| `src/app/layout.tsx` | Modificar | Adiciona `<Toaster />` |
| `src/domain/repositories/INicheRepository.ts` | Criar | Interface pura de nichos |
| `src/infrastructure/repositories/DrizzleNicheRepository.ts` | Criar | Implementação Drizzle |
| `src/use-cases/nichos/{CreateNiche,UpdateNiche,DeleteNiche}.ts` | Criar | Regras de negócio de nichos |
| `src/app/actions/nichos/{create,update,delete}-niche.ts` | Criar | Server Actions de escrita |
| `src/components/TagInput.tsx` | Criar | Input de tags reutilizável |
| `src/app/(protected)/prospeccao/nichos/page.tsx` | Criar | Server Component thin + Data Loader |
| `src/app/(protected)/prospeccao/nichos/_components/NichosContent.tsx` | Criar | Client Component: CRUD completo |
| `src/components/layout/Sidebar.tsx` | Modificar | Adiciona item "Nichos" na nav |
