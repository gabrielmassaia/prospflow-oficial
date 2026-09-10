# Aula 3 · Parte 4 — 2. Verificação Consolidada da Aula 3

> Parte de `aula-3-parte-4`. Pré-requisito: `1_Botao-de-Conversao-e-Sidebar.md`. Fecha a **Aula 3 inteira** — próxima pasta: `aula-4/`.
>
> Este arquivo não repete as armadilhas já documentadas em cada parte — só aponta pra elas. O objetivo aqui é o teste de ponta a ponta do Funil Comercial inteiro, incluindo a integração com a prospecção da Fase 2.

---

### Passo 4 — Fluxo completo, do zero

Numa empresa que já tem nichos/campanhas/leads da Fase 2 (o caso normal ao vivo), percorra:

| Ação | Resultado esperado |
|---|---|
| Acessar `/funil` pela primeira vez | 8 colunas aparecem automaticamente (seed lazy), mesmo sem nunca ter visitado a página antes (Parte 2/3) |
| Recarregar `/funil` (`F5`) | As mesmas 8 colunas, sem duplicar nenhuma (prova de idempotência do seed) |
| Clicar "Novo Lead", criar um lead manual | Aparece na coluna **Triagem** (Parte 2/3) |
| Arrastar esse lead pra outra coluna | Card migra, contagem/soma das duas colunas atualiza, sem reload (Parte 3) |
| Abrir o drawer do lead, aba Histórico | Mostra "Lead criado manualmente" + "Lead movido de X para Y", mais recente primeiro (Parte 2/3) |
| Ir em `/prospeccao/leads`, abrir um lead ainda não convertido | Botão "Converter para CRM" habilitado (Parte 4) |
| Clicar "Converter para CRM" | Toast de sucesso com ação "Ver no funil"; botão vira "Já convertido" (Parte 4) |
| Voltar em `/funil` | O lead convertido aparece na coluna **Novo** (não Triagem), com o ícone de origem `Target` (prospecção) no card (Parte 2/3/4) |
| Tentar converter o mesmo lead de novo | Botão já aparece desabilitado — nem chega a chamar a action de novo (Parte 4) |
| Item "Funil" na sidebar | Aparece após "Leads", marca como ativo em `/funil` e subrotas (Parte 4) |

Esta live também validou o fluxo com **dados reais criados via UI** (não só por script): um lead de prospecção de apoio (`Padaria Playwright Teste`) foi criado, convertido pelo botão da tela de Leads, e apareceu corretamente na coluna "Novo" do Kanban — confirmando a cadeia completa `LeadsContent` → `convertProspectingLeadAction` → `ConvertProspectingLead` → `FunilContent` sem nenhum passo manual no meio.

### Passo 5 — Checagem técnica

```bash
npx drizzle-kit push
npx tsc --noEmit
npx eslint src --max-warnings=0
```

Resultado esperado: `drizzle-kit push` sem prompt destrutivo (todas as tabelas da Fase 3 já existem desde a Parte 1), zero erros nos outros dois — confirmando que nada regrediu no conjunto inteiro da Aula 3.

---

## Índice de armadilhas da Aula 3 (por parte)

Não repetidas aqui — cada uma tem sintoma, causa e solução completos no arquivo original:

| Armadilha | Onde foi documentada |
|---|---|
| `format.ts` sem o import de `StageKind` | `aula-3-parte-1/2_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| Dados de teste do script colidem com o seed real | `aula-3-parte-1/2_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| Confundir "no-op" com "erro" em `MoveLead` | `aula-3-parte-2/2_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| `ConvertProspectingLead` precisa de nicho/campanha existentes pra testar | `aula-3-parte-2/2_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| `ssr: false` não pode ficar num Server Component (Next.js 16) | `aula-3-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 0 |
| `PointerSensor` sem `activationConstraint` quebra o clique | `aula-3-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 1 |
| Drag-and-drop nativo do Playwright não aciona `@dnd-kit` | `aula-3-parte-3/3_Verificacao-e-Armadilhas.md`, Armadilha 2 |

**Padrão que se repete:** metade das armadilhas desta fase são de **tipo/import** (pegas por `tsc` antes de qualquer teste manual), a outra metade são de **comportamento visual/interativo** (só aparecem testando de verdade — arrastando um card, clicando duas vezes, testando fora do fluxo "feliz"). O mesmo alerta da Aula 2 vale aqui: escrever o código não é suficiente, rodar e interagir é parte do trabalho — e no caso do drag-and-drop, até a *ferramenta de teste* precisa do cuidado certo (mouse real, não `dragTo` nativo).

---

## Commits sugeridos da parte (na branch `aula-3`)

```bash
# 1_Botao-de-Conversao-e-Sidebar.md
git add . && git commit -m "feat: converter lead de prospeccao para o CRM + item de sidebar"
```

Com isso, a branch `aula-3` está completa e pronta para virar a base da `aula-4` (`git switch -c aula-4 aula-3`).

---

## Próximos passos — Aula 4

Conforme o SPEC (Fase 4, rescopada para esta série de lives):

- `SeedFunnelStages` disparado também no cadastro (`CreateUserWithCompany`), mantendo o seed lazy da Fase 3 como segunda camada de proteção — não a única
- `generateMetadata()` nas páginas que ainda faltam
- `error.tsx`/`not-found.tsx` globais
- Validação real de sessão no `proxy.ts` (não só presença de cookie)
- Rate limiting nas Server Actions que chamam Cloudflare AI

**Fora de escopo** (não implementados nesta série): seletor de empresa e convite de membros por e-mail — mantém-se uma empresa por usuário.
