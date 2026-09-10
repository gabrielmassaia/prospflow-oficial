# Aula 2 · Parte 2 — Campanhas: Domínio, Overpass e Execução

> **Para a live:** Índice de leitura da Parte 2. Pré-requisito: `aula-2-parte-1/` completa e testada.
> Tempo estimado: ~2 horas ao vivo.
> Ao final: uma campanha pode ser criada e executada de ponta a ponta — busca real na Overpass API, leads persistidos no banco — **tudo sem nenhuma tela**. A UI (lista, detalhe, mapa) fica pra `aula-2-parte-3/`.

---

## Por que sem UI nesta parte

Campanhas é a feature mais densa da Aula 2: domínio, infraestrutura (com uma integração externa de verdade), o use case mais complexo do projeto (`RunCampaign`, que orquestra IA + geolocalização + persistência em lote) e 5 Server Actions. Cabe justo em 2h só isso — a tela (lista, detalhe, mapa Leaflet) é conteúdo pra outra sessão inteira. O ganho de separar assim: no fim desta parte, tudo já está testável e correto **antes** de qualquer decisão de UI — bugs de lógica de negócio não competem por atenção com bugs de layout.

## Duas peças puxadas da Parte 4 (Leads) pra cá

O material original documentava `ILeadRepository`/`DrizzleLeadRepository` e `domain/lead-qualification.ts` junto com o resto de Leads. Mas `RunCampaign` já grava leads em lote (`leadRepo.bulkCreate`), e `DrizzleLeadRepository.countByCompany` já usa `QUALIFIED_SCORE_THRESHOLD` — então os dois **precisam existir aqui**, não na Parte 4. Faz sentido também pedagogicamente: uma campanha é o que *produz* leads, então o contrato de "como um lead é salvo" nasce junto com quem primeiro escreve um.

A Parte 4 (`aula-2-parte-4/`) não recria nada disso — só consome (`findById`, `update`, `countByCompany`) e adiciona os use-cases de negócio (mudar status, gerar diagnóstico/mensagem via IA).

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Dominio-e-Infraestrutura.md` | `ICampaignRepository`, `IGeoService`, `ILeadRepository`, `lead-qualification.ts`, `DrizzleCampaignRepository`, `DrizzleLeadRepository`, `OverpassGeoService` |
| `2_Use-Cases-e-Actions.md` | `CreateCampaign`, `RunCampaign` (+ IA de geração de tags OSM), as 5 Server Actions |
| `3_Verificacao-e-Armadilhas.md` | Teste de ponta a ponta sem UI, checklist, armadilhas (Overpass rate limit incluso) |

---

## Conceito que você precisa entender antes de codar

### `after()` — trabalho em background numa Server Action

A busca na Overpass + a chamada de IA podem levar de 5 a 30 segundos. Se `runCampaignAction` desse `await` nisso tudo antes de responder, o cliente ficaria travado esperando — e em ambientes serverless (Vercel) a função seria encerrada por timeout antes de terminar.

```typescript
export async function runCampaignAction(campaignId: string) {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  // marca "running" ANTES do after() — o cliente já vê isso no próximo poll
  await campaignRepo.updateStatus(campaignId, companyId, "running");

  // after() agenda o trabalho pesado pra rodar DEPOIS da resposta HTTP ser
  // enviada — o cliente recebe { ok: true, queued: true } quase instantâneo
  after(async () => {
    const useCase = new RunCampaign(/* ...dependências recriadas aqui... */);
    await useCase.execute({ campaignId, companyId });
  });

  return { ok: true as const, queued: true };
}
```

**Por que recriar as dependências dentro do `after()`?** O callback roda depois que o escopo da request já fechou — reaproveitar variáveis capturadas de fora funcionaria por closure, mas instanciar de novo dentro deixa explícito que esse código roda numa "vida" separada da requisição original, sem compartilhar nada implícito com ela.

**Como o cliente descobre que terminou, já que a resposta não carrega o resultado?** Polling. Enquanto existir uma campanha com `status: "running"`, o Client Component (Parte 3) chama `listCampaignsAction()` a cada 3 segundos — uma Server Action de **leitura**, disparada pelo browser, o mesmo padrão de "leitura a partir do client" citado em `aula-2-parte-1/0_Conceitos-e-Mapa-de-Arquivos.md`.

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/domain/repositories/ICampaignRepository.ts` | Criar | Interface + tipo `CampaignStatus` |
| `src/domain/services/IGeoService.ts` | Criar | Contrato de busca georreferenciada |
| `src/domain/repositories/ILeadRepository.ts` | Criar | Interface + tipos `LeadStatus`/`WhatsappStatus` (puxado da Parte 4) |
| `src/domain/lead-qualification.ts` | Criar | `QUALIFIED_SCORE_THRESHOLD` + `isQualifiedLead` (puxado da Parte 4) |
| `src/infrastructure/repositories/DrizzleCampaignRepository.ts` | Criar | Implementação Drizzle |
| `src/infrastructure/repositories/DrizzleLeadRepository.ts` | Criar | Implementação Drizzle (puxado da Parte 4) |
| `src/infrastructure/services/OverpassGeoService.ts` | Criar | Busca via Overpass API, sem chave |
| `src/use-cases/campanhas/CreateCampaign.ts` | Criar | Cria campanha em rascunho |
| `src/use-cases/campanhas/RunCampaign.ts` | Criar | Orquestra IA (tags OSM) + Overpass + score + persiste leads |
| `src/app/actions/campanhas/create-campaign.ts` | Criar | Server Action de escrita |
| `src/app/actions/campanhas/run-campaign.ts` | Criar | Server Action + `after()` |
| `src/app/actions/campanhas/list-campaigns.ts` | Criar | Leitura via polling |
| `src/app/actions/campanhas/get-campaign-detail.ts` | Criar | Leitura via polling (campanha + leads) |
| `src/app/actions/campanhas/resolve-cep.ts` | Criar | Geocodifica CEP no servidor (ViaCEP + Nominatim) |
