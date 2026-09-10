# Aula 2 · Parte 3 — 3. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-2-parte-3`. Pré-requisito: `2_Detalhe-e-Mapa.md`. Fecha a Parte 3 — próxima pasta: `aula-2-parte-4/`.

---

### Passo 8 — Testar no navegador

```bash
npm run dev
```

1. `/prospeccao/campanhas` → **Nova campanha** → selecione um nicho ativo → preencha nome → digite um CEP válido → **Buscar** (confirma que cidade/UF/coordenadas preenchem sozinhos) → **Criar campanha**
2. A campanha aparece na tabela com badge **Rascunho**
3. Clique no ícone de play (▶) → badge muda pra **Executando**, botão fica desabilitado
4. Aguarde o polling (a cada 3s) — a campanha termina em **Concluída** (com leads) ou **Falha** (nunca fica presa em Executando — ver Armadilha 3 de `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`, corrigida antes desta parte)
5. Clique no ícone de olho (👁) → abre o detalhe: métricas, parâmetros, e o mapa (se houver leads) ou o empty-state "Execute a campanha..." (se não houver)
6. No detalhe, clique **Executar busca** de novo → mesmo comportamento de polling, agora nesta tela

---

## Verificação — como saber que funcionou

- [ ] Resolução de CEP preenche cidade, UF e coordenadas automaticamente
- [ ] Criar campanha sem nicho ativo não é possível (botão "Nova campanha" desabilitado)
- [ ] Tabela de campanhas mostra badge de status com a cor certa (`CAMPAIGN_STATUS_CLASSES`)
- [ ] Polling atualiza o status sozinho, sem precisar recarregar a página
- [ ] Toast de sucesso/erro aparece exatamente na transição `running` → `completed`/`failed` (não repete a cada poll)
- [ ] Detalhe da campanha mostra as 4 métricas corretas (total, qualificados, WhatsApp provável, abordados)
- [ ] Mapa renderiza com marcador central (local da busca) + círculos coloridos por lead (verde/âmbar/cinza conforme score)
- [ ] Popup de cada lead no mapa mostra nome e score, sem erro no console

---

## Armadilhas e problemas comuns

### Armadilha 0 — `window is not defined` ao abrir a página de campanhas

**Sintoma:** erro de build ou tela de erro do Next.js mencionando `window`/`document` não definidos.
**Causa:** `CampaignMap` foi importado direto (`import CampaignMap from "..."`) em vez de via `dynamic(() => import(...), { ssr: false })` — o componente tentou renderizar no servidor, onde não existe DOM.
**Solução:** conferir que o import em `CampanhaDetailContent.tsx` usa `dynamic`, não um import estático. Ver `0_Conceitos-e-Mapa-de-Arquivos.md`.

### Armadilha 1 — Mapa não aparece, sem erro nenhum

**Sintoma:** a área onde o mapa deveria estar fica em branco, sem crash.
**Causa mais comum:** esqueceu de importar `leaflet/dist/leaflet.css` no topo do `CampaignMap.tsx`. Sem o CSS, o Leaflet ainda inicializa (não lança erro), mas o container fica com altura/posicionamento quebrados e os tiles não aparecem.
**Solução:** confirmar `import "leaflet/dist/leaflet.css";` como primeira linha de import do arquivo.

### Armadilha 2 — Marcadores não aparecem, mas o mapa carrega

**Sintoma:** o mapa mostra os tiles (o "fundo" do mapa) mas nenhum pin/círculo.
**Causa:** os ícones padrão do Leaflet (`marker-icon.png`, etc.) usam caminhos relativos que quebram quando o bundler (Turbopack/Webpack) processa o pacote — sem `L.Icon.Default.mergeOptions(...)` apontando pro CDN, o marcador central (não os `circleMarker` dos leads, que não usam ícone) fica invisível.
**Solução:** conferir que `L.Icon.Default.mergeOptions(...)` roda antes de criar qualquer `L.marker(...)`.

### Armadilha 3 — Campanha travada em "Executando" / erros de IA fora do lugar

Já coberta em `aula-2-parte-2/3_Verificacao-e-Armadilhas.md` (Armadilha 3) — se você estiver seguindo as partes em ordem, esse bug já foi corrigido antes de chegar aqui. Se ainda encontrar uma campanha presa, o fix está lá.

### Armadilha 4 — Mapa carrega, mas com "API KEY REQUIRED" estampado nos tiles

**Sintoma:** o mapa aparece, os marcadores aparecem, mas o fundo do mapa (o "basemap") tem a frase "API KEY REQUIRED" repetida em cima de cada tile, tornando ruas e nomes ilegíveis.
**Causa:** o provedor de tiles `{s}.basemaps.cartocdn.com/light_all` (CartoDB) passou a exigir uma chave de API pra servir tiles sem essa marca d'água — continua respondendo `200 OK` (não é um erro de rede, o `fetch` "funciona"), só que a imagem em si vem carimbada. Fácil de não perceber no código, só no resultado visual.
**Solução:** trocar pro tile server do próprio OpenStreetMap, gratuito e sem chave: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, com atribuição `&copy; OpenStreetMap contributors`. É a URL já usada no Passo 7 deste arquivo — se você copiou de uma versão mais antiga do material, essa é a troca a fazer.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
# 1_Lista-e-Formulario.md
git add . && git commit -m "feat: lista de campanhas com polling + formulario com resolucao de CEP"

# 2_Detalhe-e-Mapa.md
git add . && git commit -m "feat: detalhe da campanha (metricas + parametros) + mapa Leaflet"
```

---

## Próximos passos — Parte 4

Em `aula-2-parte-4/` construímos o backend de Leads — domínio já existe desde `aula-2-parte-2/` (`ILeadRepository`, `DrizzleLeadRepository`), então esta parte foca no que ainda falta:

- `UpdateLeadStatus` — muda o status de um lead (novo → qualificado → contatado...)
- `GenerateDiagnosis` e `GenerateMessage` — use-cases de IA que preenchem `aiOverview`/`suggestedOffer` e geram mensagem de WhatsApp personalizada, sob demanda (não em massa, diferente de `RunCampaign`)
- As Server Actions correspondentes

Sem UI ainda — mesma lógica da Parte 2: fechar o backend primeiro, testado isoladamente, antes de construir a tela (`aula-2-parte-5/`).
