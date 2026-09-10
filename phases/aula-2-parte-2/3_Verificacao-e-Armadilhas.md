# Aula 2 · Parte 2 — 3. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-2-parte-2`. Pré-requisito: `2_Use-Cases-e-Actions.md`. Fecha a Parte 2 — próxima pasta: `aula-2-parte-3/`.

---

### Passo 14 — Testar sem nenhuma tela

Esta parte não tem UI — a Parte 3 constrói isso. Como `create-campaign`/`run-campaign` são Server Actions (não rotas HTTP), não dá pra testar com `curl` como fizemos na Aula 1. O jeito mais direto: um script Node que chama os use-cases na mão, com as mesmas dependências que a action usaria.

```typescript
// scripts/manual-test-campanha.ts — script de validação, não é entregável documentado
import { db } from "../src/infrastructure/db";
import { DrizzleCampaignRepository } from "../src/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleNicheRepository } from "../src/infrastructure/repositories/DrizzleNicheRepository";
import { DrizzleLeadRepository } from "../src/infrastructure/repositories/DrizzleLeadRepository";
import { OverpassGeoService } from "../src/infrastructure/services/OverpassGeoService";
import { CreateCampaign } from "../src/use-cases/campanhas/CreateCampaign";
import { RunCampaign } from "../src/use-cases/campanhas/RunCampaign";

// ...cria uma campanha via CreateCampaign, depois chama RunCampaign direto —
// sem passar pela action (sem sessão), já que o objetivo é validar a lógica
```

Rode com:

```bash
npx tsx --env-file=.env.local scripts/manual-test-campanha.ts
```

`--env-file` é uma flag nativa do Node (20.6+) que carrega `.env.local` **antes** de qualquer import rodar — importante porque `import { db } from "..."` executa o módulo de conexão assim que é importado, e imports em JS/TS são "hoisted" (resolvidos antes do resto do arquivo, mesmo que o `import` apareça depois de uma chamada a `dotenv.config()`). Sem `--env-file`, `DATABASE_URL` chega `undefined` no momento em que `db/index.ts` tenta usá-la.

Sem credenciais Cloudflare configuradas neste ambiente, o script simula a IA respondendo com tags OSM válidas — o objetivo é validar `RunCampaign` e a integração real com a Overpass, não a Cloudflare em si.

---

## Verificação — como saber que funcionou

- [ ] `CreateCampaign.execute()` cria a campanha com `status: "draft"`
- [ ] `RunCampaign.execute()` muda o status pra `"running"` → `"completed"` (ou `"failed"`, nunca fica travado em `"running"`)
- [ ] Uma chamada bem-sucedida à Overpass com tags OSM devolve resultados reais (nomes de estabelecimentos de verdade na região testada)
- [ ] Os leads aparecem em `prospecting_leads` no Neon, vinculados à campanha e ao nicho corretos
- [ ] `totalFound` na campanha bate com a quantidade de leads inseridos
- [ ] Uma falha da Overpass (timeout, rate limit) marca a campanha como `"failed"` e devolve uma mensagem de erro legível — nunca lança uma exceção não tratada

---

## Armadilhas e problemas comuns

### Armadilha 0 — A Overpass API pública tem rate limit agressivo

**Sintoma:** `HTTP 429` na resposta, ou a mensagem "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente."
**Causa:** a Overpass API pública (sem chave) é compartilhada por todo mundo que a usa sem autenticação — testar `RunCampaign` repetidas vezes em sequência curta (poucos segundos entre uma tentativa e outra) esgota a cota do seu IP rapidamente.
**Solução:** espaçar os testes — alguns minutos entre execuções durante a preparação da aula. Ao vivo, isso significa: **teste a campanha de exemplo com antecedência**, não na hora, e evite clicar "Executar" repetidas vezes em sequência se a primeira já estiver rodando.

### Armadilha 1 — Busca por nome (fallback) é muito mais lenta que busca por tag

**Sintoma:** `AbortError` — a chamada estoura os 35s de timeout do `OverpassGeoService`, mesmo em uma região não tão densa.
**Causa:** a query de fallback usa regex case-insensitive sobre o campo `name` (`node["name"~"...",i]`) — isso obriga a Overpass a escanear texto livre de cada elemento nomeado no raio pesquisado, um trabalho muito mais caro que comparar um valor de tag exato (`node["amenity"="restaurant"]`). Em áreas urbanas densas, isso facilmente ultrapassa 35–60s.
**Solução:** não é um bug pra corrigir — é o motivo pelo qual `RunCampaign` prioriza tags OSM geradas por IA (query rápida) e só cai pro fallback por nome quando a IA falha. Se isso acontecer com frequência ao vivo, confira se `CLOUDFLARE_AI_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` estão configurados — sem eles, toda execução cai automaticamente no caminho lento.

### Armadilha 2 — Overpass retorna "Query ran out of memory"

**Sintoma:** resposta `200 OK`, mas o JSON vem com `elements: []` e um campo `remark` explicando que a query ficou sem memória.
**Causa:** limite de recursos do servidor público compartilhado, geralmente sob carga momentânea (muitos usuários simultâneos, ou o próprio IP testando demais em sequência). **Confirmado durante a validação desta parte:** mesmo o caminho "rápido" (tags OSM) bate nisso quando a busca combina várias tags com `~"a|b|c"` (ex: `amenity~"restaurant|fast_food|cafe"`) — regex de múltiplos valores é mais caro que um valor exato, mesmo comparado tag a tag.
**Solução:** tentar de novo depois de alguns minutos. `RunCampaign` já trata isso graciosamente — a campanha completa com `totalFound: 0` em vez de travar ou lançar erro; não há dado incorreto, só nenhum resultado nessa tentativa. **Para a demonstração ao vivo:** teste a campanha de exemplo bastante antes da aula (não minutos antes) e evite executar a mesma campanha várias vezes seguidas só pra conferir — cada tentativa consome a cota do seu IP e aumenta a chance de cair numa dessas duas armadilhas bem na hora de gravar.

### Armadilha 3 — Campanha fica presa em "Executando" para sempre

**Sintoma:** o status muda pra `running` e nunca sai disso — o polling do client fica chamando `listCampaignsAction`/`getCampaignDetailAction` indefinidamente, o botão "Executar busca" continua desabilitado, e não existe jeito de tentar de novo pela UI.
**Causa real, pega durante a validação desta parte:** a primeira versão de `CloudflareAIService` validava as credenciais **no construtor** (lançava erro se `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_AI_TOKEN` não existissem). Só que `new CloudflareAIService()` é chamado dentro do `after()` da action, **antes** de `RunCampaign.execute()` começar — ou seja, fora do `try/catch` que `RunCampaign` usa pra tratar falha de IA como recuperável. Sem credenciais configuradas (o caso comum em quem está só acompanhando a aula, sem ter montado a conta Cloudflare ainda), o `after()` inteiro lançava uma exceção não capturada, e a campanha nunca chegava a ser marcada como `completed` nem `failed`.
**Solução, em duas camadas:**
1. `CloudflareAIService` não valida nada no construtor — só `complete()` checa as credenciais e lança lá dentro, onde `RunCampaign` já está de olho (ver `aula-2-parte-1/1_Fundacao-Dependencias-e-Schema.md`).
2. O `after()` de `runCampaignAction` ganhou seu próprio `try/catch` como rede de segurança — qualquer erro que escape do use case (não só de IA) marca a campanha como `failed` em vez de deixá-la presa.

Se você já tem uma campanha travada em `running` de antes dessa correção, atualize o status manualmente no Neon (`UPDATE prospecting_campaigns SET status = 'failed' WHERE status = 'running'`) — a UI não oferece um jeito de "destravar" pela tela, só de tentar de novo depois que o status já não é mais `running`.

### Armadilha 4 — `DATABASE_URL` undefined ao rodar o script de teste

**Sintoma:** `TypeError: Cannot read properties of undefined (reading 'includes')` em `db/index.ts`, mesmo com `.env.local` preenchido.
**Causa:** carregar variáveis de ambiente via `import "dotenv/config"` (ou `source .env.local` no shell) não funciona de forma confiável aqui: imports são resolvidos antes do resto do módulo rodar, e um `source` de shell trata `&` dentro da `DATABASE_URL` (comum em connection strings com `channel_binding=require`) como operador de background, truncando o valor.
**Solução:** usar `npx tsx --env-file=.env.local script.ts` — a flag `--env-file` do Node carrega o arquivo antes de qualquer import ser avaliado.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
# 1_Dominio-e-Infraestrutura.md
git add . && git commit -m "feat: dominio de campanhas/leads + DrizzleCampaignRepository + DrizzleLeadRepository + OverpassGeoService"

# 2_Use-Cases-e-Actions.md
git add . && git commit -m "feat: CreateCampaign, RunCampaign (IA + Overpass + score) e 5 server actions de campanha"
```

---

## Próximos passos — Parte 3

Em `aula-2-parte-3/` construímos a UI de Campanhas — a primeira tela do projeto com mapa (Leaflet, carregado com `dynamic(..., { ssr: false })`):

- `src/lib/format.ts` — labels e cores de status (agora `CampaignStatus` existe)
- Lista de campanhas com polling de status
- Formulário de criação com resolução de CEP (`resolveCepAction`)
- Detalhe da campanha: métricas, mapa dos leads encontrados, botão de executar/re-executar
