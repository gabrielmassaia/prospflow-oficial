# Aula 3 · Parte 2 — Regras de Negócio do Funil

> **Para a live:** Índice de leitura da Parte 2. Pré-requisito: `aula-3-parte-1/` completa e testada.
> Tempo estimado: ~1h30 ao vivo — 5 use-cases, 5 Server Actions, ainda sem UI.
> Ao final: seed automático de 8 etapas, criação/movimentação/edição de lead, e a conversão de um lead de prospecção em lead de CRM — tudo testável por script, tela fica pra Parte 3.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Use-Cases-e-Actions.md` | `SeedFunnelStages`, `CreateCrmLead`, `MoveLead`, `UpdateCrmLead`, `ConvertProspectingLead` + 5 Server Actions |
| `2_Verificacao-e-Armadilhas.md` | Validação por script, checklist, armadilhas |

---

## Conceito que você precisa entender antes de codar

### Seed lazy: por que no Data Loader do funil, e não no cadastro

`SeedFunnelStages` cria as 8 etapas padrão (Triagem → ... → Fechado/Perdido) na primeira vez que uma empresa é lida — guardado por uma checagem simples: `countByCompany(companyId) > 0` decide se já rodou. A pergunta natural é: por que não rodar isso uma vez só, no cadastro da empresa (`CreateUserWithCompany`, Fase 1)?

Duas razões, uma técnica e uma de sequenciamento:

1. **Toda empresa que já existe antes da Aula 3** (criada nas Aulas 1 e 2, testando o fluxo de prospecção) nunca passaria pelo cadastro de novo — ficaria pra sempre sem etapas se o seed só existisse lá. O seed lazy resolve isso sem precisar de uma migration de dados retroativa.
2. **Acoplamento de fase.** `CreateUserWithCompany` é um fluxo crítico e estável desde a Aula 1 (cadastro + login). Prender a ele uma peça nova da Aula 3 significa: se `SeedFunnelStages` tiver um bug, o cadastro quebra — mesmo pra quem nunca vai abrir o Funil. Rodar o seed no Data Loader da própria página do funil (`FunilDataLoader`, Parte 3) isola o raio de explosão: um bug aqui quebra `/funil`, não o cadastro.

A Fase 4 do SPEC (fora do escopo desta série de lives, ver `5_Verificacao-e-Armadilhas.md` da aula-3 original) prevê rodar o seed *também* no cadastro, como otimização — nesse ponto o lazy vira uma segunda camada de proteção, não a única. Nesta série, o lazy é definitivo.

### Por que `ConvertProspectingLead` decide a etapa de entrada, não a action

`ConvertProspectingLead` recebe 5 dependências — mais que qualquer outro use case da Fase 3 — porque concentra toda a regra: checa duplicidade, garante que o funil tem etapas (chamando `SeedFunnelStages` internamente), escolhe a primeira etapa `kind: "normal"` como destino, resolve o nome do nicho, cria o `CrmLead` e registra a atividade de conversão.

"Em qual etapa um lead convertido entra" é uma decisão de negócio, não um detalhe de transporte HTTP. Se essa regra mudasse amanhã — por exemplo, "entrar direto na etapa de Reunião Marcada quando o score for muito alto" — quem muda é o use case, e a Server Action (`convertProspectingLeadAction`) continua exatamente igual: guard de tenant, instanciar 5 repositórios, chamar `execute()`. É a mesma disciplina de `RunCampaign` na Fase 2 (a lógica de pontuação de leads mora no use case, não na action que a expõe).

### As duas origens entram em etapas diferentes, de propósito

| Origem | Etapa de entrada | Por quê |
|---|---|---|
| `manual` (`CreateCrmLead`) | Triagem (posição 0, `kind: "triage"`) | Lead cadastrado à mão ainda não passou por nenhuma qualificação — precisa de vetting antes de entrar no fluxo comercial de verdade |
| `prospecting` (`ConvertProspectingLead`) | Novo (primeira `kind: "normal"`, posição 1) | Já foi pontuado por `calculateLeadScore` na Fase 2 — pular a Triagem de novo seria repetir um trabalho já feito |

Uniformizar as duas num único ponto de entrada apagaria essa distinção de processo comercial — é uma escolha deliberada, não uma inconsistência a "corrigir".

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/use-cases/funil/SeedFunnelStages.ts` | Criar | Cria as 8 etapas padrão, idempotente |
| `src/use-cases/funil/CreateCrmLead.ts` | Criar | Cria lead manual + registra atividade |
| `src/use-cases/funil/MoveLead.ts` | Criar | Move lead de etapa + registra atividade (no-op se destino = origem) |
| `src/use-cases/funil/UpdateCrmLead.ts` | Criar | Edita dados do lead, nunca a etapa |
| `src/use-cases/funil/ConvertProspectingLead.ts` | Criar | Converte lead de prospecção em lead de CRM |
| `src/app/actions/funil/create-crm-lead.ts` | Criar | Action de escrita |
| `src/app/actions/funil/move-lead.ts` | Criar | Action de escrita |
| `src/app/actions/funil/update-crm-lead.ts` | Criar | Action de escrita |
| `src/app/actions/funil/get-lead-activities.ts` | Criar | Action de leitura sob demanda (aba Histórico) |
| `src/app/actions/leads/convert-prospecting-lead.ts` | Criar | Action de escrita — controller fino de 5 repositórios |
