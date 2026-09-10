# Aula 2 · Parte 6 — Dashboard e Fechamento da Aula 2

> **Para a live:** Índice de leitura da Parte 6, a última da Aula 2. Pré-requisito: `aula-2-parte-5/` completa e testada.
> Tempo estimado: ~1 hora ao vivo — a parte mais curta do módulo, porque todo dado que o dashboard mostra já existe (nichos, campanhas, leads e `countByCompany` foram construídos nas partes anteriores).
> Ao final: `/prospeccao` deixa de ser um placeholder estático (desde a Aula 1) e vira um dashboard real, e a Aula 2 inteira fecha com uma verificação consolidada.

---

## Por que esta parte é a última e a mais curta

Não existe nenhum use case novo aqui, nenhuma tabela nova, nenhuma Server Action nova — o Dashboard só **lê** o que as Partes 1–5 já produzem. É um exemplo direto do padrão "Server Component lendo direto" (Aula 2, Parte 1): três repositórios, um `Promise.all`, zero Server Action.

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Dashboard-e-Sidebar.md` | Dashboard real em `/prospeccao` + renomeação do item de nav |
| `2_Verificacao-Consolidada.md` | Checklist e armadilhas da **Aula 2 inteira**, não só desta parte |

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/(protected)/prospeccao/page.tsx` | Substituir | Placeholder da Aula 1 vira dashboard real com métricas |
| `src/components/layout/Sidebar.tsx` | Modificar | "Prospecção" (`Target`) vira "Dashboard" (`BarChart2`) |
