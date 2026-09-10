# Aula 4 — Polish e Produção (implementação parcial)

> **Para a live:** Índice de leitura da Aula 4, a última desta série. Pré-requisito: `aula-3-parte-4/` completa e testada.
> Tempo estimado: ~1h ao vivo — a aula mais curta de todas. Diferente de 1-3, não precisou de split em partes: 456 linhas de doc-fonte no total, quatro ajustes pequenos e independentes entre si.
> Ao final: cadastro novo já nasce com o funil pronto, todo erro tem uma tela consistente (com a sidebar preservada quando faz sentido), e a sessão é validada de verdade antes de qualquer página protegida renderizar.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Seed-Automatico-no-Cadastro.md` | `CreateUserWithCompany` passa a semear as etapas do funil na criação da empresa |
| `2_Metadata-Error-e-NotFound.md` | `generateMetadata()` no dashboard, `error.tsx` e `not-found.tsx` globais |
| `3_Proxy-Validacao-de-Sessao.md` | `src/proxy.ts` passa a validar a sessão de verdade, não só a presença do cookie |
| `4_Verificacao-Armadilhas-e-Pendencias.md` | Checklist final, armadilhas (incluindo uma nova, específica desta reescrita), pendências fora de escopo |

**Objetivo:** fechar as lacunas de "produção real" que sobraram depois da Aula 3 — seed automático das etapas do funil, metadata em todas as páginas, páginas globais de erro/404 e validação real de sessão no proxy.

**Escopo revisado:** o SPEC original desta fase tinha 7 itens. Dois ficaram fora desta série — "seletor de empresa" e "convite de membros por e-mail" — porque são interdependentes (trocar de empresa só faz sentido se um usuário puder pertencer a mais de uma, o que exige convite) e este produto mantém uma empresa por usuário. Um terceiro item, **rate limiting nas actions de IA**, foi adiado por decisão do desenvolvedor e fica documentado como pendência (`4_Verificacao-Armadilhas-e-Pendencias.md`), sem implementação aqui.

---

## Constraints globais

- Toda action começa com `requireUser()` → `requireCompany(user.id)`
- Toda query filtra por `companyId` — sem exceção
- Repositórios recebem `db` no construtor, nunca importam globalmente
- `domain/` não importa nada externo

---

## Conceito que você precisa entender antes de codar

### Por que o seed entra em `CreateUserWithCompany`, e não num hook de login

Uma empresa só é criada em **um único lugar** do sistema: `CreateUserWithCompany.execute()`, chamado pela action de cadastro. Não existe (nem esta aula cria) um fluxo de múltiplas empresas por usuário — então "primeiro login" e "momento da criação da empresa" são, na prática, o mesmo evento. Em vez de configurar um `databaseHooks` novo no Better Auth só para replicar esse único ponto, o seed é chamado diretamente logo depois que `companyRepo.create(...)` devolve a empresa criada: menos código, mesmo efeito, sem tocar na configuração do Better Auth.

O seed **lazy**, que já existia desde a Aula 3 no Data Loader da página do funil, continua no código — vira uma segunda camada de proteção, útil para as empresas de teste que já existiam no banco antes desta mudança e nunca passaram pelo novo fluxo de cadastro. `SeedFunnelStages.execute()` já é idempotente (`countByCompany` antes de inserir), então não há risco de duplicar etapas mesmo rodando duas vezes — uma no cadastro, outra (sem efeito) na primeira visita ao funil.

> **Nota de arquitetura (decisão pragmática, já presente no código desde a Aula 1):** `CreateUserWithCompany` importa o Better Auth (`auth`) concreto em vez de uma interface de domínio. É uma exceção consciente ao DIP — criar usuário é uma fronteira de framework, o Better Auth *é* a regra de hash/sessão/verificação, e abstraí-lo atrás de um `IAuthService` só recriaria a API dele sem ganho real. Toda a persistência de domínio (empresa, membro, funil) continua atrás de interfaces injetadas.

### Next.js 16 renomeou `middleware.ts` para "Proxy" — e ele sempre roda em Node.js

No Next.js 16, o antigo `middleware.ts` virou o conceito de **Proxy** (`src/proxy.ts`), com uma mudança importante: **o Proxy sempre roda em runtime Node.js**, não mais Edge por padrão. Declarar `export const runtime = "..."` no arquivo de Proxy agora é **erro de build** — "Route segment config is not allowed in Proxy file... Proxy always runs on Node.js runtime".

Isso é uma boa notícia para este projeto: o pool de conexão Postgres (`pg.Pool`, usado pelo Drizzle) só funciona em runtime Node.js — não tem suporte a socket TCP no Edge Runtime. Como o Proxy do Next 16 já roda em Node.js nativamente, dá pra chamar `auth.api.getSession()` (que depende do `db`) direto dentro do Proxy, sem nenhuma configuração especial.

### O trade-off de validar sessão no Proxy

Antes, o Proxy só verificava se o cookie de sessão existia — um cookie com qualquer valor passava, e só era invalidado depois, dentro do Server Component, por `requireUser()`. Agora o Proxy chama `auth.api.getSession({ headers: request.headers })` e só deixa passar se a sessão for real e válida no banco.

Isso adiciona uma consulta ao banco em toda requisição às rotas protegidas. Para uma aplicação deste porte (ensino/demo), o custo é aceitável e é exatamente o comportamento que o SPEC pede — mas vale saber que a prática recomendada pelo próprio Better Auth para middlewares de altíssima escala é o oposto (checar só o cookie no edge, validar de verdade só na página), justamente para evitar essa query extra em toda requisição. As duas abordagens são válidas; a escolha aqui prioriza segurança/simplicidade sobre performance bruta.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/use-cases/auth/CreateUserWithCompany.ts` | Modificar | Recebe `IFunnelStageRepository`, chama `SeedFunnelStages` após criar a empresa |
| `src/app/actions/auth/signup.ts` | Modificar | Instancia `DrizzleFunnelStageRepository` e injeta no use case |
| `src/app/(protected)/prospeccao/page.tsx` | Modificar | Adiciona `generateMetadata()` |
| `src/app/error.tsx` | Criar | Página de erro global (Client Component) |
| `src/app/not-found.tsx` | Criar | Página 404 global |
| `src/app/(protected)/error.tsx` | Criar | Error boundary do segmento protegido (mantém a shell/sidebar) |
| `src/proxy.ts` | Modificar | Troca checagem de cookie por `auth.api.getSession()` real |
