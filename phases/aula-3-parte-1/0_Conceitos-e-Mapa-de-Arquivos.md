# Aula 3 · Parte 1 — Fundação do Funil Comercial

> **Para a live:** Índice de leitura da Parte 1, a primeira da Aula 3. Pré-requisito: `aula-2-parte-6/` completa e testada (Aula 2 fechada).
> Tempo estimado: ~1h30 ao vivo — schema, domínio e repositórios, sem UI. É a mesma forma de abrir a Aula 2: fundação primeiro, testável por script, tela depois.
> Ao final: 3 tabelas novas no Neon, 3 interfaces de domínio, 3 repositórios Drizzle funcionando — validados direto contra o banco, sem nenhum use-case ainda.

---

## Por que a Aula 3 vira 4 partes

A Aula 3 constrói o **Funil Comercial**: um CRM Kanban separado da prospecção, onde leads (prospectados ou cadastrados à mão) avançam por etapas até fechar ou perder. Menor que a Aula 2 em volume de documentação-fonte, mas com uma peça só — o board com drag-and-drop — densa o bastante pra ocupar uma sessão inteira sozinha:

| Parte | Conteúdo | Demonstrável ao final |
|---|---|---|
| **1** (esta) | Fundação: schema (3 tabelas), domínio, repositórios Drizzle | Repositórios testáveis por script, sem UI |
| 2 | Regras de negócio: seed automático, criar/mover/editar lead, converter prospecção → CRM | Backend testável via script (sem UI ainda) |
| 3 | Interface Kanban: board com `@dnd-kit`, drawer de detalhes, modal de novo lead | Kanban completo no navegador, arrastando cards |
| 4 | Integração: botão "Converter para CRM" na tela de Leads da Fase 2 + item de sidebar + verificação da aula inteira | Funil acessível a partir da prospecção, aula fechada |

Cada parte mapeia 1:1 com um arquivo da documentação original da Aula 3 — não foi necessário fatiar nenhum deles no meio.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Fundacao-Schema-Domain-Infra.md` | Dependência `@dnd-kit`, schema (2 enums + 3 tabelas), 3 interfaces de domínio, 3 repositórios Drizzle, `formatBRL`/`STAGE_KIND_BORDER_CLASSES` |
| `2_Verificacao-e-Armadilhas.md` | Aplicar schema, validar repositórios por script, checklist, armadilhas |

## Constraints globais (valem pra toda a Aula 3)

- Toda action começa com `requireUser()` → `requireCompany(user.id)`
- Toda query filtra por `companyId` — sem exceção
- Retorno de actions: `{ ok: true, data? } | { ok: false, error: string }`
- Repositórios recebem `db` no construtor, nunca importam globalmente
- `domain/` não importa nada externo (sem Drizzle, sem Next.js)
- `@dnd-kit`, assim como Leaflet na Fase 2: sempre `dynamic(() => import(...), { ssr: false })` — a partir da Parte 3
- Leitura inicial de página sempre direto no Server Component (Data Loader) — Server Action só pra mutação

---

## Conceito que você precisa entender antes de codar

### `numeric` do Postgres chega como `string`

O campo `value` de `crm_leads` (valor estimado do negócio, em R$) usa o tipo `numeric(10, 2)` — não `real`/`doublePrecision`, como `latitude`/`longitude` na Fase 2. A diferença importa: ponto flutuante binário (`real`/`double`) não representa exatamente todo valor decimal (`0.1 + 0.2 !== 0.3` em qualquer linguagem que use IEEE 754) — para coordenadas geográficas, esse erro é irrelevante; para dinheiro, é inaceitável. `numeric` guarda o valor exato, mas por isso o driver (`node-postgres`) não converte automaticamente para `number` — devolve `string`, pra nunca perder precisão silenciosamente na conversão.

Isso significa que **o domínio nunca deveria ver essa string**. A regra do projeto é clara: `domain/` define `value: number | null` — é a infraestrutura, e só ela, que sabe que por baixo o Postgres guarda texto. `DrizzleCrmLeadRepository` concentra essa conversão em dois helpers pequenos (`toDomain` na leitura, `normalizeValue` na escrita) para que nenhum outro lugar do sistema — use-case, action, componente — precise saber que esse detalhe existe.

```typescript
// DENTRO do repositório, nunca fora dele
function toDomain(row: CrmLeadRow): CrmLead {
  return { ...row, value: row.value == null ? null : Number(row.value) };
}

function normalizeValue(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined; // "não veio no patch" ≠ "veio null"
  return value == null ? null : String(value);
}
```

`normalizeValue` distingue três estados, não dois: `undefined` (campo ausente de um `Partial<>`, não deve ser tocado no `UPDATE`), `null` (limpar o valor) e um número real. Colapsar `undefined` em `null` faria todo `update()` parcial apagar o valor sempre que o caller não passasse `value` — mesmo que a intenção fosse só atualizar `notes`, por exemplo.

### Por que `update()` e `updateStage()` são métodos separados

`ICrmLeadRepository` tem dois métodos de escrita em vez de um `update()` genérico que aceitasse qualquer campo, `stageId` incluso:

```typescript
update(id: string, companyId: string, data: Partial<Omit<CreateCrmLeadData, "stageId">>): Promise<CrmLead>;
updateStage(id: string, companyId: string, stageId: string): Promise<CrmLead>;
```

O `Omit<..., "stageId">` no tipo de `update()` não é estético — é o TypeScript impedindo, em tempo de compilação, que o use-case de edição de dados (`UpdateCrmLead`, Parte 2) altere a etapa do lead por engano. Mover um lead de etapa é uma operação de negócio com efeito colateral próprio (Parte 2 registra uma `LeadActivity` a cada movimento) — só `MoveLead` tem acesso ao método que faz isso. Um repositório com um único `update()` aceitando qualquer campo tornaria esse acoplamento acidental possível a qualquer momento; separar os métodos torna impossível por construção.

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `package.json` | Modificar | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `src/infrastructure/db/schema.ts` | Modificar | +2 enums, +3 tabelas (`funnel_stages`, `crm_leads`, `lead_activities`) |
| `src/domain/repositories/IFunnelStageRepository.ts` | Criar | Interface pura de etapas do funil |
| `src/domain/repositories/ICrmLeadRepository.ts` | Criar | Interface pura de leads do CRM |
| `src/domain/repositories/ILeadActivityRepository.ts` | Criar | Interface pura de histórico de atividades |
| `src/infrastructure/repositories/DrizzleFunnelStageRepository.ts` | Criar | Implementação Drizzle |
| `src/infrastructure/repositories/DrizzleCrmLeadRepository.ts` | Criar | Implementação Drizzle + conversão `numeric` |
| `src/infrastructure/repositories/DrizzleLeadActivityRepository.ts` | Criar | Implementação Drizzle |
| `src/lib/format.ts` | Modificar | `formatBRL()`, `STAGE_KIND_BORDER_CLASSES` |
