# Aula 2 · Parte 5 — 3. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-2-parte-5`. Pré-requisito: `2_Lista-Filtros-e-Sheet.md`. Fecha a Parte 5 — próxima pasta: `aula-2-parte-6/`.

---

### Passo 5 — Testar no navegador

```bash
npm run dev
```

1. `/prospeccao/leads` → confirme que a contagem no cabeçalho bate com o total de leads da empresa
2. Filtre por campanha, status, score mínimo e "Só com WhatsApp" — a contagem e a tabela atualizam junto, sem reload
3. Clique **Mapa** → mesmo conjunto filtrado aparece como marcadores coloridos por score
4. Clique numa linha da tabela (ou num marcador do mapa) → sheet lateral abre com os dados do lead
5. No sheet, clique **Gerar** em "Diagnóstico IA" → sem credenciais Cloudflare, aparece toast de erro (não trava nada); com credenciais, o texto aparece preenchido
6. Clique **Gerar** em "Mensagem WhatsApp" → mesmo comportamento; com sucesso, o botão "Abrir WhatsApp" aparece
7. Mude o status pelo select "Alterar status" → o badge no topo do sheet e na tabela (se ainda visível) atualizam junto

---

## Verificação — como saber que funcionou

- [ ] Os dois `Select` de status (filtro e "Alterar status" no sheet) mostram o label em português (`Todos`, `Qualificado`...), nunca o valor bruto (`all`, `qualified`)
- [ ] O sinal de Instagram no sheet mostra o label "Instagram", não "Camera"
- [ ] Filtros combinados (campanha + status + score + WhatsApp) funcionam juntos, não só isolados
- [ ] Paginação (`Anterior`/`Próxima`) só aparece quando há mais de 15 leads filtrados
- [ ] Mapa e lista mostram exatamente o mesmo conjunto de leads (o filtro, não a view, decide quem aparece)
- [ ] Clicar num marcador do mapa abre o mesmo sheet que clicar numa linha da tabela
- [ ] Gerar diagnóstico/mensagem sem credenciais Cloudflare mostra erro claro, sem crash
- [ ] Abrir WhatsApp (com mensagem gerada) promove o status pra "WhatsApp aberto" automaticamente, só se o lead ainda estava "Novo" ou "Qualificado"

---

## Armadilhas e problemas comuns

### Armadilha 0 — Select de status mostra o valor bruto (`all`, `qualified`) em vez do label

**Sintoma:** o dropdown de status (filtro no topo, ou "Alterar status" no sheet) mostra literalmente a palavra em inglês/valor interno, não "Todos"/"Qualificado".
**Causa, pega durante a validação desta parte:** o componente `Select` deste projeto (base-ui) não resolve sozinho o label a partir do valor selecionado quando `<SelectValue />` é usado sem children — ele precisa que você diga explicitamente o que mostrar. O `Select` de campanha (Parte 3) já fazia isso certo (`<SelectValue>{campaignId === "all" ? "Todas" : ...}</SelectValue>`); os dois de status ficaram com `<SelectValue />` vazio na primeira versão.
**Solução:** todo `SelectValue` deste projeto que representa um valor não-óbvio (enum, id) precisa de children explícitos resolvendo o label — nunca deixar `<SelectValue />` sozinho esperando que ele "adivinhe".

### Armadilha 1 — Label "Camera" no lugar de "Instagram"

**Sintoma:** o sheet de detalhe mostra um selo escrito "Camera" para indicar presença no Instagram.
**Causa:** copy-paste do componente `Signal` de Website, sem trocar o texto do label (o ícone `Camera` do lucide-react é usado como substituto visual pra Instagram — lucide não tem um ícone de marca próprio — mas o texto ficou "herdado" do nome do ícone, não do que ele representa).
**Solução:** o label é sobre o que o ícone *significa* pro usuário, não sobre qual componente React foi usado — `label="Instagram"`, ícone `Camera` por baixo.

### Armadilha 2 — Mapa de leads sem nenhum marcador, mesmo com leads na lista

**Sintoma:** view "Mapa" carrega mas fica vazio, enquanto a view "Lista" mostra leads normalmente.
**Causa mais provável:** os filtros ativos (`campaignId`/`status`/`minScore`/`onlyWa`) zeraram o array `filtered` — como lista e mapa consomem o mesmo `filtered` (ver conceito no `0_`), um filtro restritivo esvazia os dois ao mesmo tempo. Não é um bug do mapa, é o resultado esperado do filtro.
**Solução:** conferir os filtros ativos antes de assumir que o mapa está quebrado — "Score mínimo" alto ou "Só com WhatsApp" em campanhas com poucos leads reais é a causa mais comum.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
# 1_Mapa-e-Pagina.md
git add . && git commit -m "feat: LeadsMap + pagina de leads (data loader)"

# 2_Lista-Filtros-e-Sheet.md
git add . && git commit -m "feat: lista de leads com filtros, mapa e sheet de detalhe (IA + WhatsApp)"
```

---

## Próximos passos — Parte 6

Em `aula-2-parte-6/` fechamos a Aula 2 inteira:

- Dashboard real em `/prospeccao` (substitui o empty-state estático desde a Aula 1) — métricas de nichos, campanhas e leads usando `DrizzleLeadRepository.countByCompany` (Parte 2, sem consumidor até agora)
- Sidebar renomeia "Prospecção" pra "Dashboard" — o item deixa de ser um placeholder e passa a refletir o que a página realmente mostra
- Checklist e armadilhas consolidadas da Aula 2 inteira (Nichos → Campanhas → Leads)
