# Aula 3 · Parte 3 — 3. Verificação e Armadilhas

> Parte de `aula-3-parte-3`. Pré-requisito: `2_Kanban-Board-e-Drawer.md`. Fecha a Parte 3 — próxima pasta: `aula-3-parte-4/`.

---

### Passo 11 — Testar no navegador

```bash
npm run dev
```

Com uma sessão já logada e etapas seedadas (Parte 2), acesse `/funil`:

1. As 8 colunas aparecem na ordem correta (Triagem → ... → Perdido), cada uma com cor de badge e borda condizente com o `kind`.
2. Os leads criados na Parte 2 (via script) aparecem na coluna certa, com contagem e soma de valores no topo da coluna.
3. Clique num card → o drawer abre com os dados corretos (nome, origem, nicho, telefone, valor, observações).
4. Clique na aba **Histórico** → carrega e mostra as atividades em ordem cronológica decrescente, com data formatada em pt-BR.
5. Clique **Avançar etapa** → o lead some da coluna atual e aparece na próxima, contagem e soma atualizadas nas duas colunas, sem reload.
6. Feche o drawer (`Esc` ou clique fora) → clique **Novo Lead** → preencha nome → **Criar** → o card aparece na coluna Triagem.
7. **Arraste** esse card recém-criado da coluna Triagem pra coluna Novo → solte → confirme que o card migrou e as contagens das duas colunas atualizaram.
8. Solte um card **na própria coluna** (arraste um pouco e devolva ao mesmo lugar) → confirme que nada muda visualmente e nenhum toast de erro aparece.
9. Recarregue a página (`F5`) → o estado deve refletir exatamente o banco (prova de que a leitura inicial é real).

**Nota sobre testar drag-and-drop com Playwright:** a API `browser_drag`/`dragTo` do Playwright simula drag-and-drop nativo do HTML5 (`dragstart`/`drop`), que **não** aciona os sensores do `@dnd-kit` (baseados em `pointerdown`/`pointermove`/`pointerup`). Pra testar de verdade, é preciso simular a sequência de mouse manualmente: `mouse.move` até o card → `mouse.down` → vários `mouse.move` intermediários (o `PointerSensor` só considera "arrasto" depois de passar do `activationConstraint: { distance: 5 }`) → `mouse.move` até a coluna de destino → `mouse.up`. Foi assim que esta live confirmou o drag-and-drop funcionando de ponta a ponta, sem nenhum erro no console.

---

## Verificação — como saber que funcionou

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx eslint src --max-warnings=0` — zero erros/warnings
- [ ] `/funil` carrega sem erro no console, 8 colunas na ordem certa
- [ ] Drawer abre com os dados corretos do lead clicado
- [ ] Aba Histórico carrega sob demanda e mostra atividades formatadas em pt-BR, mais recente primeiro
- [ ] "Avançar etapa" move o lead pra próxima coluna, sem reload
- [ ] Modal "Novo Lead" cria lead na coluna Triagem
- [ ] Drag-and-drop real (sequência de mouse, não `dragTo` nativo) move o card entre colunas
- [ ] Soltar um card na própria coluna não altera nada nem gera toast de erro
- [ ] `F5` na página reflete o estado real do banco

---

## Armadilhas desta parte

### Armadilha 0 — `ssr: false` não pode ficar num Server Component

**Sintoma:** `npm run dev` sobe, mas `/funil` quebra com `Ecmascript file had an error: "ssr: false" is not allowed with next/dynamic in Server Components. Please move it into a Client Component.`
**Causa:** `page.tsx` é um Server Component (`generateMetadata` + `async function`). Chamar `dynamic(() => import(...), { ssr: false })` diretamente nele é aceito em versões antigas do Next.js, mas o Next.js 16 passou a rejeitar explicitamente. `CampaignMap`/`LeadsMap` na Fase 2 não têm esse problema porque o `dynamic(ssr:false)` deles fica dentro de Client Components (`CampanhaDetailContent`/`LeadsContent`), nunca dentro de um `page.tsx`.
**Solução:** isolar a chamada `dynamic(..., { ssr: false })` num arquivo `"use client"` próprio (`FunilContentLoader.tsx`, Parte 1 desta pasta) e importar o componente resultante normalmente no `page.tsx` — sem `dynamic` nenhum ali. Ver `1_Pagina-e-Loader.md`.

### Armadilha 1 — `PointerSensor` sem `activationConstraint` quebra o clique

**Sintoma:** clicar num card pra abrir o drawer não funciona — nada acontece, ou o card "gruda" no cursor por um instante antes de voltar ao lugar.
**Causa:** sem `activationConstraint: { distance: 5 }` no `useSensor(PointerSensor, ...)`, o `@dnd-kit` interpreta **todo** `pointerdown` como início potencial de arrasto — inclusive um clique rápido que deveria só disparar o `onClick` do card. O navegador nunca chega a disparar o evento de clique porque o sensor de drag "ganha" a interação primeiro.
**Solução:** `activationConstraint: { distance: 5 }` — só depois que o ponteiro se move 5px o `@dnd-kit` considera que é um arrasto de verdade; abaixo disso, o evento é tratado como clique normal.

### Armadilha 2 — Testar drag-and-drop com a API de drag nativa do Playwright não funciona

**Sintoma:** um teste automatizado usando `page.dragTo(...)` (ou o tool `browser_drag`) não move o card — o estado da página não muda, nenhuma action é chamada.
**Causa:** `dragTo` simula os eventos `dragstart`/`dragover`/`drop` do HTML5 Drag and Drop API nativo. O `@dnd-kit` **não** usa essa API — ele escuta `pointerdown`/`pointermove`/`pointerup` diretamente, via `PointerSensor`. Os dois modelos de drag-and-drop não se comunicam.
**Solução:** simular a sequência de ponteiro manualmente — `page.mouse.move()` até o centro do elemento de origem, `page.mouse.down()`, uma sequência de `page.mouse.move()` intermediários até o destino (respeitando o `activationConstraint` da Armadilha 1), e `page.mouse.up()`. Documentado com o código exato usado nesta live no Passo 11.

---

## Commits sugeridos da parte (na branch `aula-3`)

```bash
# 1_Pagina-e-Loader.md + 2_Kanban-Board-e-Drawer.md
git add . && git commit -m "feat: kanban com dnd-kit + drawer + criação de lead"
```

---

## Próximos passos — Parte 4

Em `aula-3-parte-4/` fechamos a Aula 3:

- Botão "Converter para CRM" no drawer de detalhes da tela de **Leads** (Fase 2) — desabilitado pra leads já convertidos
- Item "Funil" na sidebar, junto de Dashboard/Nichos/Campanhas/Leads
- Verificação consolidada da Aula 3 inteira, do zero — schema → seed → criar/mover/converter lead → Kanban no navegador
