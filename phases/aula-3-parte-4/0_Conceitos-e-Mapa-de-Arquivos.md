# Aula 3 · Parte 4 — Integração com a Prospecção e Fechamento

> **Para a live:** Índice de leitura da Parte 4, a última da Aula 3. Pré-requisito: `aula-3-parte-3/` completa e testada.
> Tempo estimado: ~45min ao vivo — a parte mais curta da Aula 3, porque toda a lógica pesada (use-cases, Kanban) já existe; aqui só se conecta o que já foi construído.
> Ao final: um lead de prospecção vira lead de CRM com um clique, a partir da própria tela de Leads da Fase 2 — e a Aula 3 inteira fecha com uma verificação de ponta a ponta.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Botao-de-Conversao-e-Sidebar.md` | Botão "Converter para CRM" em `LeadsContent`, `convertedProspectingLeadIds` no Data Loader, item "Funil" na sidebar |
| `2_Verificacao-Consolidada.md` | Checklist e armadilhas da **Aula 3 inteira**, do zero |

---

## Conceito que você precisa entender antes de codar

### Por que a leitura de `convertedProspectingLeadIds` também é direta, sem bootstrap action

A tela de Leads já segue, desde a Fase 2, o padrão "Server Component lendo direto" — o Data Loader (`LeadsDataLoader`) busca `leads` e `campaigns` num `Promise.all`, sem Server Action de bootstrap. Adicionar `convertedProspectingLeadIds` a esse mesmo `Promise.all` — em vez de buscar isso separadamente, por exemplo numa Server Action chamada no `useEffect` do Client Component — mantém a regra de ouro do projeto: leitura que acontece no servidor, antes do HTML ser enviado, fica no Server Component; Server Action é só para escrita (ou leitura disparada pelo cliente, como o polling da Fase 2). Um terceiro item no `Promise.all` é uma linha a mais, não uma exceção à regra.

### O botão de conversão só sabe de um id — o resto é o use case

`convertProspectingLeadAction(prospectingLeadId: string)` recebe só o id do lead sendo convertido. Toda a decisão de negócio — qual etapa recebe o lead, que atividade registrar, se o funil já tem etapas — já foi resolvida dentro de `ConvertProspectingLead` na Parte 2. O componente de UI aqui não sabe (e não precisa saber) que existe uma etapa chamada "Novo", ou que a conversão dispara um seed lazy por baixo. Essa é a mesma disciplina de toda a Fase 3: regra de negócio no use case, controller fino na action, UI só reage ao resultado (`{ ok, data | error }`).

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/(protected)/prospeccao/leads/_components/LeadsContent.tsx` | Modificar | Botão "Converter para CRM" no drawer, estado `convertedIds` |
| `src/app/(protected)/prospeccao/leads/page.tsx` | Modificar | Data Loader passa a carregar `convertedProspectingLeadIds` |
| `src/components/layout/Sidebar.tsx` | Modificar | Item "Funil" (ícone `Kanban`) após "Leads" |
