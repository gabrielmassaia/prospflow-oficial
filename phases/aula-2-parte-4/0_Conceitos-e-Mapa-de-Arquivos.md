# Aula 2 · Parte 4 — Leads: Status e IA (Diagnóstico e Mensagem)

> **Para a live:** Índice de leitura da Parte 4. Pré-requisito: `aula-2-parte-3/` completa e testada.
> Tempo estimado: ~1h30 ao vivo — a mais curta do módulo de prospecção, porque o domínio e a infraestrutura de leads já existem desde `aula-2-parte-2/`.
> Ao final: mudar o status de um lead e gerar diagnóstico/mensagem via IA, tudo testável sem tela ainda.

---

## Por que esta parte é pequena

`ILeadRepository` e `DrizzleLeadRepository` já foram construídos na Parte 2 — `RunCampaign` precisava deles pra gravar os leads que encontra. O que falta agora é só a **camada de negócio que opera sobre um lead já existente**: mudar status, e gerar conteúdo com IA sob demanda (diferente de `RunCampaign`, que gera leads em massa, aqui a IA roda **um lead por vez**, disparada pelo usuário clicando um botão — Parte 5).

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Use-Cases-e-Actions.md` | `UpdateLeadStatus`, `GenerateDiagnosis`, `GenerateMessage` + 3 Server Actions |
| `2_Verificacao-e-Armadilhas.md` | Teste sem UI, checklist, armadilhas |

---

## Conceito que você precisa entender antes de codar

### Por que `GenerateDiagnosis`/`GenerateMessage` não têm fallback (diferente de `RunCampaign`)

`RunCampaign` (Parte 2) trata falha de IA como recuperável — sem tags OSM, cai pra busca por nome, a campanha completa de qualquer jeito. Aqui é diferente: **gerar diagnóstico é a própria finalidade da ação**. Não existe um "diagnóstico sem IA" que faça sentido mostrar — se a chamada falhar, o único caminho correto é devolver o erro pro usuário tentar de novo, não inventar um resultado parcial. Por isso os dois use-cases desta parte só têm um `try/catch` simples ao redor da chamada de IA, sem lógica de fallback.

**Consequência prática:** enquanto você não tiver `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_AI_TOKEN` configurados, `GenerateDiagnosis` e `GenerateMessage` sempre vão devolver `{ ok: false, error: "CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_AI_TOKEN são obrigatórios" }` — isso é o comportamento correto, não um bug (diferente da Armadilha 3 da Parte 2, que era um bug de verdade porque a campanha ficava **presa**; aqui a action simplesmente retorna erro e o usuário pode tentar de novo a qualquer momento, sem estado travado).

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/use-cases/leads/UpdateLeadStatus.ts` | Criar | Muda status do lead com guard de tenant |
| `src/use-cases/leads/GenerateDiagnosis.ts` | Criar | Gera `aiOverview` + `suggestedOffer` via IA |
| `src/use-cases/leads/GenerateMessage.ts` | Criar | Gera mensagem de WhatsApp personalizada via IA |
| `src/app/actions/leads/update-lead-status.ts` | Criar | Server Action de escrita |
| `src/app/actions/leads/generate-diagnosis.ts` | Criar | Server Action de IA |
| `src/app/actions/leads/generate-message.ts` | Criar | Server Action de IA |
