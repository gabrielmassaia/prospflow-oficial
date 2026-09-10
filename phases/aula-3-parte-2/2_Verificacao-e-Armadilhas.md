# Aula 3 · Parte 2 — 2. Verificação e Armadilhas

> Parte de `aula-3-parte-2`. Pré-requisito: `1_Use-Cases-e-Actions.md`. Fecha a Parte 2 — próxima pasta: `aula-3-parte-3/`.

---

### Passo 7 — Validar os use-cases por script

Ainda sem UI, um script de ponta a ponta (descartável) prova as regras de negócio antes de qualquer tela existir:

1. `SeedFunnelStages` chamado duas vezes seguidas — a segunda chamada precisa devolver exatamente as mesmas 8 etapas, não duplicar.
2. `CreateCrmLead` criando um lead manual — confirma que ele entra na etapa de Triagem e gera 1 atividade.
3. `MoveLead` chamado com o **mesmo** `stageId` de origem e destino — confirma que **nenhuma** atividade nova é criada (só a de criação continua lá).
4. `MoveLead` chamado com um `stageId` diferente — confirma que agora **2** atividades existem, e o `stageId` do lead mudou.
5. `UpdateCrmLead` editando `notes`/`value` — confirma que o `stageId` continua o mesmo depois.
6. `ConvertProspectingLead` — primeira chamada cria o `CrmLead` com `origin: "prospecting"` na etapa "Novo"; a segunda chamada com o **mesmo** `prospectingLeadId` precisa falhar com `"Lead já convertido"`.

```bash
npx tsx --env-file=.env.local scripts/manual-test-funil-regras.ts
```

Resultado obtido nesta live:

```
[test] SeedFunnelStages (1a chamada): 8 etapas
[test] SeedFunnelStages (2a chamada, deve ser idempotente): 8 etapas
[test] CreateCrmLead: criado 205bdce5-...
[test] MoveLead no-op: ok=true, atividades=1 (deve ser 1, só a de criação)
[test] MoveLead real: ok=true, stageId=53a820a8-..., atividades=2 (deve ser 2)
[test] UpdateCrmLead: notes="atualizado via use-case", value=3000, stageId inalterado=true
[test] ConvertProspectingLead (1a vez): criado e27391b3-..., origin=prospecting, stageId=53a820a8-... (deve ser 53a820a8-...)
[test] ConvertProspectingLead (2a vez, deve falhar): Lead já convertido
[test] findConvertedProspectingLeadIds: 1 id(s), inclui=true
```

Todas as linhas batem com o esperado — inclusive a comparação explícita de `stageId` entre a etapa "Novo" resolvida pelo use case e o `stageId` do lead criado, provando que `ConvertProspectingLead` realmente escolhe a primeira etapa `kind: "normal"`.

**Diferente da Parte 1, os dados criados aqui não precisam ser limpos**: as 8 etapas são o seed real de produção (não um teste descartável), e os 2 leads criados (1 manual, 1 convertido) servem como dado de demonstração pronto pra Parte 3, quando a tela do Kanban existir — evita começar a Parte 3 olhando pra um board totalmente vazio.

---

## Verificação — como saber que funcionou

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx eslint src --max-warnings=0` — zero erros/warnings
- [ ] Script: `SeedFunnelStages` é idempotente (2 chamadas seguidas devolvem o mesmo conjunto de 8 etapas)
- [ ] Script: `CreateCrmLead` gera exatamente 1 `LeadActivity` (`fromStageId: null`)
- [ ] Script: `MoveLead` na mesma coluna não gera atividade nova
- [ ] Script: `MoveLead` pra coluna diferente gera 1 atividade e atualiza `stageId`
- [ ] Script: `UpdateCrmLead` nunca altera `stageId`
- [ ] Script: `ConvertProspectingLead` entra na primeira etapa `kind: "normal"`, não em Triagem
- [ ] Script: converter o mesmo lead de prospecção duas vezes falha na segunda, com mensagem clara

---

## Armadilhas desta parte

### Armadilha 0 — Confundir "no-op" com "erro" em `MoveLead`

**Sintoma:** ao testar `MoveLead` soltando um card na própria coluna (Parte 3, no navegador), nada visualmente quebra — mas é fácil, ao escrever o teste, esperar `ok: false` ou uma atividade sendo criada mesmo assim.
**Causa:** a leitura apressada da regra "no-op quando `stageId` de destino é igual ao atual" sugere "não faz nada" — mas o use case ainda devolve `{ ok: true, data: lead }` (o lead como está), porque do ponto de vista de quem chamou (o `onDragEnd` do Kanban, Parte 3) essa não é uma condição de erro, é um caminho normal que só não teve efeito.
**Solução:** o teste do Passo 7 verifica os dois lados: `ok === true` **e** a contagem de atividades não mudou. Testar só um dos dois deixaria passar uma regressão onde o no-op passasse a gerar atividade (ou vice-versa, passasse a devolver erro).

### Armadilha 1 — Esquecer que `ConvertProspectingLead` precisa de nicho e campanha existentes pra testar

**Sintoma:** o script de validação não tem nenhum `prospectingLead` pra converter, porque a empresa de teste nunca rodou uma campanha da Fase 2.
**Causa:** `ConvertProspectingLead` depende de um `ILeadRepository.findById` que só encontra algo se já existir ao menos um lead de prospecção na empresa — e esses só existem depois de rodar uma campanha real ou criar um manualmente via `bulkCreate` (como no `manual-test-leads.ts` da Fase 2).
**Solução:** o script desta parte verifica se já existe algum lead de prospecção (`leadRepo.findAllByCompany`) e, se não existir, cria um de apoio via `bulkCreate` — reaproveitando o padrão de dado fictício já usado em `manual-test-leads.ts`. Numa empresa que já passou pela Aula 2 completa ao vivo (o caso normal), esse fallback nem chega a rodar.

---

## Commits sugeridos da parte (na branch `aula-3`)

```bash
# 1_Use-Cases-e-Actions.md
git add . && git commit -m "feat: use-cases do funil (seed, criar, mover, converter) + actions"
```

---

## Próximos passos — Parte 3

Em `aula-3-parte-3/` entra a primeira tela do Funil — a parte mais densa da Aula 3:

- `funil/page.tsx` — Server Component thin, Data Loader rodando o seed lazy
- `FunilContentLoader.tsx` — client wrapper isolando o `dynamic(..., { ssr: false })` de `@dnd-kit`, exigido pelo Next.js 16 (não pode ficar direto num Server Component — ver a Armadilha correspondente na Parte 3)
- `FunilContent.tsx` — o Kanban inteiro: colunas droppable, cards draggable, drawer de detalhes com histórico, modal de novo lead

Todas as 5 actions criadas aqui ganham seu primeiro consumidor real nesta próxima parte.
