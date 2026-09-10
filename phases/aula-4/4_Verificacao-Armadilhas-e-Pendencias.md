# Aula 4 — 4. Verificação, Armadilhas e Pendências

> Parte de `aula-4`. Pré-requisito: `3_Proxy-Validacao-de-Sessao.md`. Fecha o projeto.

---

### Passo 8 — Verificação final

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npm run build
```

Todos os três limpos nesta live — `npm run build` inclusive já confirma que declarar `auth`/`getSession()` dentro de `proxy.ts` **não** dispara o erro de `route segment config`, já que nenhuma linha `export const runtime` foi adicionada (ver Armadilha abaixo).

Diferente do que a documentação original desta fase antecipava, **nenhuma das checagens abaixo ficou como "manual"** — todas foram automatizadas via Playwright nesta live, incluindo as duas que dependiam de um navegador de verdade (cadastro novo, error boundary):

| Verificação | Resultado |
|---|---|
| Cookie de sessão inválido em `/prospeccao` | Redireciona para `/login` |
| Sem cookie nenhum em `/funil` | Redireciona para `/login` |
| Cadastro novo em `/register` → `funnel_stages` já tem 8 linhas, sem visitar `/funil` | 8 etapas confirmadas via query direta no Neon (`1_Seed-Automatico-no-Cadastro.md`, Passo 3) |
| Rota autenticada inexistente (`/prospeccao/rota-que-nao-existe`) | `not-found.tsx` renderiza, título "Página não encontrada", botão "Voltar para o dashboard" navega corretamente |
| `throw new Error("teste")` temporário numa página dentro de `(protected)` | `(protected)/error.tsx` renderiza **com a sidebar visível**, botão "Tentar novamente" presente; `throw` removido em seguida e o dashboard voltou ao normal |

O truque para testar cookie inválido/ausente sem derrubar a sessão real de desenvolvimento em uso: usar a API de cookies do Playwright (`context.addCookies`/`context.clearCookies`) para manipular o cookie *fora* da página (ele é `httpOnly`, `document.cookie` não o alcança), guardando o valor original antes de qualquer alteração para restaurá-lo depois. Para o cadastro novo, um contexto de navegador **separado** (sem os cookies da sessão principal) evita qualquer interferência entre o teste e a sessão em uso na live.

---

## Commits sugeridos da fase (na branch `aula-4`)

```bash
# 1_Seed-Automatico-no-Cadastro.md
git add . && git commit -m "feat: seed das etapas do funil no cadastro (CreateUserWithCompany)"

# 2_Metadata-Error-e-NotFound.md
git add . && git commit -m "feat: generateMetadata no dashboard + error/not-found globais e do segmento"

# 3_Proxy-Validacao-de-Sessao.md
git add . && git commit -m "feat: proxy valida sessao de verdade (getSession), nao so o cookie"
```

Ao final, `aula-1` é ancestral de `aula-2`, de `aula-3`, de `aula-4` — o histórico segue em uma direção só, exatamente como as lives são gravadas.

---

## Armadilhas desta fase

### `export const runtime` no Proxy é erro de build no Next.js 16
Diferente de versões anteriores (onde middleware podia rodar em Edge ou declarar `runtime: "nodejs"` explicitamente), o Next.js 16 já fixa o Proxy em Node.js e **rejeita** qualquer `route segment config` no arquivo. Se você vier de um projeto Next 14/15, não tente adicionar essa linha — vai quebrar o build.

### `SeedFunnelStages` nunca deve lançar exceção que aborte o cadastro
Como o seed roda dentro do mesmo `try/catch` de `CreateUserWithCompany.execute()`, se `SeedFunnelStages` lançasse uma exceção não capturada, o cadastro inteiro falharia por causa de uma etapa de funil. Isso não acontece porque `SeedFunnelStages.execute()` já captura seus próprios erros e retorna `{ ok: false }` em vez de lançar — mas é importante manter essa garantia se o use case for alterado no futuro.

### `Button render={<Link .../>}` sem `nativeButton={false}` gera warning do Base UI
**Sintoma:** ao abrir `/prospeccao/rota-que-nao-existe`, o console mostra `Base UI: A component that acts as a button expected a native <button> because the "nativeButton" prop is true. Rendering a non-<button> removes native button semantics...` — apontando pro `Button` dentro de `NotFound`.
**Causa:** o `Button` deste projeto (`src/components/ui/button.tsx`) embrulha `@base-ui/react/button`, cujo `nativeButton` é `true` por padrão — ele assume que vai renderizar um `<button>` de verdade, com toda a semântica nativa (comportamento em formulários, foco, teclado). Quando `render={<Link href="..." />}` troca o elemento renderizado por um `<a>`, essa suposição deixa de valer, e o Base UI avisa no console.
**Solução:** passar `nativeButton={false}` sempre que `render` apontar pra algo que não é um `<button>` nativo — `<Button nativeButton={false} render={<Link .../>}>`. Vale notar que `SidebarMenuButton` (usado na sidebar desde a Aula 1 com o mesmo padrão `render={<Link .../>}`) **não** tem esse problema: ele usa o hook `useRender` do Base UI diretamente, não o primitive `Button`, e não carrega essa suposição de "sempre nativo". Essa armadilha só aparece porque `not-found.tsx`/`error.tsx` são o primeiro lugar do projeto usando o componente `Button` (não `SidebarMenuButton`) com um `render` que não é um `<button>` — e só apareceu testando de verdade no navegador; nem `tsc` nem `eslint` pegam um warning de runtime do Base UI.

### Testar Proxy/sessão via curl tem limite — mas via Playwright, não tem
Como o Proxy roda antes do roteamento do Next.js, qualquer requisição sem sessão válida para uma rota inexistente redireciona para `/login` — não dá pra provar que `not-found.tsx` funciona testando só com `curl` sem sessão. A documentação original desta fase deixava esse teste como "manual". Nesta live, a limitação foi contornada usando o Playwright com uma sessão real (autenticado no navegador) para acessar a rota inexistente, e um contexto de navegador à parte (cookies manipulados diretamente via API do Playwright) para os cenários de sessão inválida/ausente — sem precisar de nenhum passo manual fora do fluxo automatizado.

---

## Pendências (fora desta fase)

- **Rate limiting nas server actions de IA** (`generate-diagnosis.ts`, `generate-message.ts`) — adiado por decisão do desenvolvedor. Quando for revisitado, a opção recomendada é um contador no próprio Neon (sem precisar de Redis/Upstash), já que o projeto não tem nenhuma infraestrutura de KV/cache configurada.
- **Seletor de empresa** e **convite de membros por e-mail** — fora de escopo desta versão.

---

## Fim da série

Com a Aula 4, as quatro aulas planejadas para esta reescrita ao vivo estão completas: setup (Aula 1), prospecção ativa com IA e mapas (Aula 2), funil comercial com Kanban (Aula 3), e os últimos ajustes de produção (Aula 4). O produto cobre o ciclo inteiro — captar leads, qualificar, prospectar, converter em oportunidades de negócio e acompanhar até o fechamento — com a arquitetura em camadas (domain → infrastructure → use-cases → actions → UI) mantida sem exceção do início ao fim.
