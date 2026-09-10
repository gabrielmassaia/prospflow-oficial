# Aula 2 · Parte 5 — Leads: Lista, Filtros, Mapa e Sheet de Detalhe

> **Para a live:** Índice de leitura da Parte 5. Pré-requisito: `aula-2-parte-4/` completa e testada.
> Tempo estimado: ~2 horas ao vivo — a última tela do módulo de prospecção.
> Ao final: ver todos os leads de todas as campanhas, filtrar por status/score/WhatsApp, alternar entre lista e mapa, e abrir um sheet lateral com diagnóstico IA, mensagem gerada e link direto pro WhatsApp.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Mapa-e-Pagina.md` | `LeadsMap.tsx`, página thin + Data Loader |
| `2_Lista-Filtros-e-Sheet.md` | `LeadsContent.tsx` — o Client Component mais longo do projeto |
| `3_Verificacao-e-Armadilhas.md` | Teste completo, checklist, armadilhas (2 bugs reais pegos na validação) |

---

## Conceito que você precisa entender antes de codar

### Por que Lista e Mapa são um `view: "list" | "map"` no mesmo componente, não duas rotas

Diferente de Campanhas (onde lista e detalhe são páginas separadas, com URLs diferentes), aqui lista e mapa mostram **o mesmo conjunto de dados filtrado**, só que em dois formatos visuais. Trocar de rota reiniciaria os filtros (ou exigiria sincronizá-los na URL, complexidade que não compensa aqui). Um `useState<"list" | "map">` local resolve isso de graça — os filtros (`campaignId`, `status`, `minScore`, `onlyWa`) continuam aplicados não importa qual view está ativa, porque `filtered` (via `useMemo`) é calculado uma vez e consumido pelos dois.

```tsx
{view === "map" ? (
  <LeadsMap leads={filtered} onSelect={(lead) => setSelected(lead)} height={560} />
) : (
  <Table>{/* ...pageLeads... */}</Table>
)}
```

Clicar num marcador do mapa (`onSelect`) abre o mesmo sheet de detalhe que clicar numa linha da tabela — é o mesmo `selected` state, alimentado por dois gatilhos diferentes.

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/LeadsMap.tsx` | Criar | Mapa Leaflet de todos os leads filtrados, com callback de seleção |
| `src/app/(protected)/prospeccao/leads/page.tsx` | Criar | Server Component thin + Data Loader |
| `src/app/(protected)/prospeccao/leads/_components/LeadsContent.tsx` | Criar | Filtros, tabela paginada, alternância lista/mapa, sheet de detalhe com IA |
| `src/components/layout/Sidebar.tsx` | Modificar | Adiciona item "Leads" na nav — último item do módulo de prospecção |
