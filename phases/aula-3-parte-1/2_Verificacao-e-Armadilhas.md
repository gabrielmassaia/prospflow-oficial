# Aula 3 · Parte 1 — 2. Verificação e Armadilhas

> Parte de `aula-3-parte-1`. Pré-requisito: `1_Fundacao-Schema-Domain-Infra.md`. Fecha a Parte 1 — próxima pasta: `aula-3-parte-2/`.

---

### Passo 6 — Validar os repositórios por script

Sem use-cases nem UI ainda, a forma de provar que schema + domínio + infra estão corretos é chamar os repositórios direto, contra o banco real — o mesmo padrão de `scripts/manual-test-leads.ts` (Fase 2). Um script assim (descartável, fora do `src/`) deve:

1. Ler a primeira empresa e o primeiro usuário existentes no banco.
2. Se a empresa ainda não tem etapas (`stageRepo.countByCompany`), criar 2–3 etapas de teste via `bulkCreate` — nunca uma a uma, por causa do índice único `(companyId, position)`.
3. Criar um `CrmLead` manual numa etapa, com `value` numérico, e confirmar que o valor volta como `number` (não `string`) — prova de que `toDomain`/`normalizeValue` funcionam.
4. Criar uma `LeadActivity` ligada a esse lead e confirmar `findByLead`.
5. Chamar `update()` (editar `notes`) e `updateStage()` (mover de etapa) separadamente, confirmando que cada um só altera o que deveria.
6. Chamar `findConvertedProspectingLeadIds` — deve voltar vazio, já que nada foi convertido de prospecção ainda.

```bash
npx tsx --env-file=.env.local scripts/manual-test-funil-fundacao.ts
```

Resultado obtido nesta live:

```
[test] usando company b2730a3b-024f-428c-a23d-95c6fc711101
[test] bulkCreate: 3 etapas criadas
[test] countByCompany: 3
[test] crmLead criado: 7fa98144-..., value=1500.5 (typeof number)
[test] activity criada: 1055f78a-...
[test] findByLead: 1 atividade(s)
[test] update: notes="atualizado"
[test] updateStage: stageId=3de51cc6-...
[test] findConvertedProspectingLeadIds: 0 id(s)
```

`value=1500.5 (typeof number)` é a linha que importa: confirma que o `numeric` do Postgres saiu como `string` do driver e voltou como `number` de verdade no domínio, sem qualquer código fora do repositório precisar saber disso.

**Depois de validar, apague os dados de teste** (e o próprio script, se ele não for reaproveitável nas próximas partes) — as 2–3 etapas fictícias criadas aqui vão colidir com o seed real de 8 etapas da Parte 2, que espera rodar numa empresa com `countByCompany === 0`.

---

## Verificação — como saber que funcionou

- [ ] `npx drizzle-kit push` cria 2 enums + 3 tabelas sem prompt destrutivo
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx eslint src --max-warnings=0` — zero erros/warnings
- [ ] Script de validação: `bulkCreate` de etapas respeita o índice único de posição
- [ ] Script de validação: `value` de um `CrmLead` volta como `number`, nunca `string`
- [ ] Script de validação: `update()` não altera `stageId`; `updateStage()` não altera `notes`/`value`
- [ ] Dados de teste removidos do banco antes de seguir pra Parte 2

---

## Armadilhas desta parte

### Armadilha 0 — `format.ts` sem o import de `StageKind`

**Sintoma:** `Record<StageKind, string>` no `STAGE_KIND_BORDER_CLASSES` não compila — `Cannot find name 'StageKind'`.
**Causa:** até esta fase, `format.ts` só importava tipos do próprio domínio de prospecção (`CampaignStatus`, `LeadStatus`). É fácil colar o `Record<StageKind, ...>` sem lembrar de importar o tipo de um domínio novo (`IFunnelStageRepository`).
**Solução:** `import type { StageKind } from "@/domain/repositories/IFunnelStageRepository";` no topo do arquivo, junto com os outros dois imports de tipo. Pega antes de rodar `tsc` se você escrever o import primeiro e o `Record` depois — foi como esta live evitou o erro.

### Armadilha 1 — Dados de teste do script colidem com o seed da Parte 2

**Sintoma:** `SeedFunnelStages` (Parte 2) não cria as 8 etapas padrão numa empresa que já tem etapas — porque ele checa `countByCompany > 0` antes de rodar, e o script de validação desta parte já deixou 2–3 lá.
**Causa:** o script do Passo 6 cria etapas fictícias pra provar que `bulkCreate` funciona, mas essas etapas não são o seed real — têm nomes e `kind`s diferentes dos 8 oficiais.
**Solução:** sempre limpar (`DELETE ... WHERE company_id = ...` nas três tabelas novas, na ordem `lead_activities` → `crm_leads` → `funnel_stages`, por causa das FKs) os dados de teste antes de considerar a parte fechada. Nesta live isso foi feito com um segundo script descartável, removido logo em seguida.

---

## Commits sugeridos da parte (na branch `aula-3`)

```bash
git switch -c aula-3 aula-2   # nasce da aula-2, se ainda não existir

# 1_Fundacao-Schema-Domain-Infra.md
git add . && git commit -m "feat: schema do funil (3 tabelas) + domain + repositórios Drizzle"
```

---

## Próximos passos — Parte 2

Em `aula-3-parte-2/` entram as regras de negócio, ainda sem UI:

- `SeedFunnelStages` — cria as 8 etapas padrão na primeira visita de uma empresa nova (lazy, não no cadastro — essa peça só chega na Fase 4)
- `CreateCrmLead`, `MoveLead`, `UpdateCrmLead` — CRUD + movimentação de etapa, cada um registrando `LeadActivity`
- `ConvertProspectingLead` — o use-case mais denso desta fase, com 5 dependências injetadas
- 5 Server Actions de escrita, todas seguindo `requireUser()` → `requireCompany()` → instanciar repos → chamar use-case
