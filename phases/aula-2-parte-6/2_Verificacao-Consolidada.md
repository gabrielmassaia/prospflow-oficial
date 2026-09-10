# Aula 2 · Parte 6 — 2. Verificação Consolidada da Aula 2

> Parte de `aula-2-parte-6`. Pré-requisito: `1_Dashboard-e-Sidebar.md`. Fecha a **Aula 2 inteira** — próxima pasta: `aula-3/`.
>
> Este arquivo não repete as armadilhas já documentadas em cada parte — só aponta pra elas. O objetivo aqui é o teste de ponta a ponta do módulo de prospecção inteiro, do zero.

---

### Passo 3 — Fluxo completo, do zero

Numa sessão limpa (ideal: usuário novo, sem nichos/campanhas/leads prévios), percorra:

| Ação | Resultado esperado |
|---|---|
| Acessar `/prospeccao` | Dashboard com 4 cards zerados, "Nenhuma campanha criada ainda" |
| Acessar `/prospeccao/nichos` | Lista vazia, botão "Criar primeiro nicho" |
| Criar nicho, clicar "Preencher" | Campos preenchidos com sugestões estáticas (Aula 2 Parte 1) |
| Acessar `/prospeccao/campanhas` | Lista vazia, "Nova campanha" desabilitado até existir nicho ativo |
| Criar campanha (CEP resolvido automaticamente) | Linha aparece com status "Rascunho" (Parte 3) |
| Executar a campanha | "Executando" → "Concluída"/"Falha" via polling, nunca trava (Parte 2, Armadilha 3) |
| Abrir detalhe da campanha | Métricas + mapa (ou empty-state se `totalFound: 0`) (Parte 3) |
| Acessar `/prospeccao/leads` | Leads da campanha aparecem na tabela (Parte 5) |
| Filtrar por campanha/status/score/WhatsApp | Tabela e mapa atualizam juntos (Parte 5) |
| Abrir um lead, gerar diagnóstico e mensagem | Funciona com credenciais Cloudflare; erro claro sem elas (Parte 4) |
| Abrir WhatsApp a partir da mensagem gerada | Abre `wa.me/...` e promove o status do lead (Parte 5) |
| Voltar ao Dashboard | Os 4 cards e "Campanhas recentes" refletem tudo que foi criado |

### Passo 4 — Checagem técnica

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
```

Resultado esperado: zero erros nos dois — é o mesmo par de comandos rodado ao final de cada parte anterior, agora confirmando que nada regrediu no conjunto inteiro.

---

## Índice de armadilhas da Aula 2 (por parte)

Não repetidas aqui — cada uma tem sintoma, causa e solução completos no arquivo original:

| Armadilha | Onde foi documentada |
|---|---|
| `sql` importado do pacote errado (`drizzle-orm/pg-core` em vez de `drizzle-orm`) | `aula-2-parte-1/3_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| `Loader2` usado sem import | `aula-2-parte-1/3_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| 404 por cache do Next.js desatualizado | `aula-2-parte-1/3_Verificacao-e-Armadilhas.md`, Armadilha 2 |
| Overpass: rate limit (429) por testar demais em sequência | `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| Overpass: busca por nome (regex) é bem mais lenta que busca por tag | `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| Overpass: "Query ran out of memory" mesmo no caminho "rápido" | `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, Armadilha 2 |
| **Campanha presa em "Executando" pra sempre** (credencial de IA validada no lugar errado) | `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, Armadilha 3 — a mais séria da fase |
| `DATABASE_URL` undefined em script standalone | `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, Armadilha 4 |
| `window is not defined` sem `dynamic(..., { ssr: false })` | `aula-2-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| Mapa em branco por esquecer o import do CSS do Leaflet | `aula-2-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| Marcador central invisível sem `L.Icon.Default.mergeOptions` | `aula-2-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 2 |
| Tiles com "API KEY REQUIRED" estampado (CartoDB mudou a política) | `aula-2-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 4 |
| `JSON.parse` falha se a IA envolve a resposta em texto/markdown | `aula-2-parte-4/2_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| `Select` mostrando valor bruto (`all`, `qualified`) em vez do label | `aula-2-parte-5/3_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| Label "Camera" em vez de "Instagram" | `aula-2-parte-5/3_Verificacao-e-Armadilhas.md`, Armadilha 1 |

**Padrão que se repete em quase metade dessas armadilhas:** um comportamento que "funciona" tecnicamente (a chamada retorna, não lança exceção) mas está **visualmente ou logicamente errado** — tiles carimbados, select mostrando o valor errado, label trocado. `tsc`/`eslint` não pegam nenhuma delas; só apareceram testando de verdade no navegador, com dados reais. Vale o mesmo alerta pra Aula 3: escrever o código não é suficiente, rodar e olhar é parte do trabalho.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
# 1_Dashboard-e-Sidebar.md
git add . && git commit -m "feat: dashboard de metricas + sidebar renomeada"
```

Com isso, a branch `aula-2` está completa e pronta para virar a base da `aula-3` (`git switch -c aula-3 aula-2`).

---

## Próximos passos — Aula 3

Na Aula 3 construímos o **Funil Comercial (CRM Kanban)** — um módulo novo, separado da prospecção:

- Kanban com drag-and-drop via `@dnd-kit`
- 8 etapas padrão criadas automaticamente por empresa (`SeedFunnelStages`)
- Conversão de um lead prospectado (desta fase) em lead do CRM
- Sheet de detalhes com histórico de atividades
- Tabelas novas: `funnel_stages`, `crm_leads`, `lead_activities`

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Dado o tamanho da Aula 2 (6 partes), é bem provável que a Aula 3 precise do mesmo tratamento — a avaliação de quantas partes ela vai precisar é o primeiro passo antes de começar a construir.
