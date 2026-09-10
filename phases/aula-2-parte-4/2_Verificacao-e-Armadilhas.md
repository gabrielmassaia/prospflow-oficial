# Aula 2 · Parte 4 — 2. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-2-parte-4`. Pré-requisito: `1_Use-Cases-e-Actions.md`. Fecha a Parte 4 — próxima pasta: `aula-2-parte-5/`.

---

### Passo 5 — Testar sem nenhuma tela

Mesma abordagem da Parte 2: um script chama os use-cases direto. Como ainda não existe UI de leads, e as campanhas de teste podem não ter gerado nenhum lead real (ver as armadilhas de Overpass, `aula-2-parte-2/3_Verificacao-e-Armadilhas.md`), o script cria um lead de teste direto via `leadRepo.bulkCreate` antes de exercitar os três use-cases.

```bash
npx tsx --env-file=.env.local scripts/manual-test-leads.ts
```

---

## Verificação — como saber que funcionou

- [ ] `UpdateLeadStatus.execute()` muda o status e o valor persiste no banco (confira com uma segunda leitura)
- [ ] `GenerateDiagnosis`/`GenerateMessage` sem credenciais Cloudflare devolvem `{ ok: false, error: "..." }` — nunca lançam exceção não tratada, nunca travam nada (ver conceito no `0_`)
- [ ] Com credenciais Cloudflare válidas, `GenerateDiagnosis` grava `aiOverview`/`suggestedOffer` no lead e `GenerateMessage` devolve uma mensagem com no máximo 300 caracteres

---

## Armadilhas e problemas comuns

### Armadilha 0 — `GenerateDiagnosis` falha com `JSON.parse` mesmo com IA respondendo

**Sintoma:** o erro devolvido é algo como `Unexpected token` ou `Unexpected end of JSON input`, mesmo com `CLOUDFLARE_AI_TOKEN` configurado e a chamada de rede tendo sucesso.
**Causa:** o modelo às vezes envolve a resposta em texto explicativo ou markdown (` ```json ... ``` `) mesmo o prompt pedindo explicitamente "APENAS JSON, sem texto extra" — `JSON.parse(raw.trim())` quebra se sobrar qualquer caractere fora do objeto.
**Solução:** se isso acontecer com frequência, aplique a mesma técnica de `RunCampaign` (Parte 2) — extrair o JSON com `raw.match(/\{[\s\S]*\}/)` antes de fazer o parse, em vez de tentar parsear a resposta inteira. Não é o comportamento documentado aqui porque, ao contrário das tags OSM, um diagnóstico malformado não tem fallback sensato — mas a técnica de extração é a mesma.

### Armadilha 1 — Diferença de comportamento entre esta parte e a Parte 2 ao faltar credencial

**Não é bug, é por design** — mas vale ter claro antes de testar: em `RunCampaign` (Parte 2), IA ausente é absorvida silenciosamente (cai no fallback, a campanha completa). Aqui, IA ausente é **o resultado final** — a action retorna erro, e é isso que a UI (Parte 5) vai mostrar como toast de erro pro usuário. Não tente replicar o padrão de fallback do `RunCampaign` aqui; a mensagem de erro clara é o comportamento correto.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
# 1_Use-Cases-e-Actions.md
git add . && git commit -m "feat: UpdateLeadStatus, GenerateDiagnosis, GenerateMessage e suas server actions"
```

---

## Próximos passos — Parte 5

Em `aula-2-parte-5/` construímos a UI de Leads — a última tela do módulo de prospecção:

- `LeadsMap.tsx` — mapa Leaflet de todos os leads (mesma técnica de `CampaignMap`, Parte 3)
- Lista de leads com filtros (status, score mínimo, só com WhatsApp) e paginação
- Sheet de detalhe: diagnóstico, mensagem gerada, botão de abrir WhatsApp com o número normalizado (`phoneNormalized`)
