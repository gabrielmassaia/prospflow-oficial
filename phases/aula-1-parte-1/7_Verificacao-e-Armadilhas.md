# Aula 1 · Parte 1 — 7. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-1-parte-1`. Pré-requisito: `6_Proxy-Protecao-de-Rotas.md`. Fecha a Parte 1 — próxima pasta: `aula-1-parte-2/`.

---

### Passo 19 — Aplicar schema no banco

```bash
npx drizzle-kit push
```

Lê `schema.ts`, compara com o banco atual e cria as tabelas que faltam. Rápido para desenvolvimento; em produção prefira `drizzle-kit generate` + `drizzle-kit migrate`, que geram arquivos de migration versionados em vez de aplicar a diferença direto.

---

### Passo 20 — Testar sem nenhuma tela

Esta parte não tem UI ainda — a Parte 2 constrói isso. Dá pra confirmar que auth, banco e proxy funcionam só com `curl`:

```bash
npm run dev
```

```bash
# Cadastro — cria usuário + empresa + membro (transação)
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@teste.com","password":"senha12345"}'

# Login com senha errada — confirma o formato de erro { code, message }
curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@teste.com","password":"errada"}'

# Proxy — sem cookie, espera redirect (307) pra /login
curl -s -o /dev/null -w "status=%{http_code} redirect=%{redirect_url}\n" \
  http://localhost:3000/prospeccao
```

Confira no painel do Neon que as tabelas foram criadas e o usuário/empresa foram inseridos.

---

## Verificação — como saber que funcionou

- [ ] `npx drizzle-kit push` roda sem erro e cria as 6 tabelas no Neon
- [ ] `POST /api/auth/sign-up/email` cria registro em `users`, `companies` e `company_members`
- [ ] `POST /api/auth/sign-in/email` com senha errada devolve `{ code: "INVALID_EMAIL_OR_PASSWORD" }`
- [ ] `GET /prospeccao` sem cookie devolve `307` redirecionando pra `/login`
- [ ] O banco no Neon tem as 6 tabelas: `users`, `sessions`, `accounts`, `verifications`, `companies`, `company_members`

---

## Armadilhas e problemas comuns

### Armadilha 0 — Rotas não estão sendo protegidas (proxy ignorado silenciosamente)

**Sintoma:** ao iniciar o servidor, aparece: `The file "./src\proxy.ts" must export a function, either as a default export or as a named "proxy" export.`
**Causa:** Next.js 16 renomeou `middleware.ts` → `proxy.ts` e a função exportada precisa se chamar `proxy`, não `middleware`.
**Solução:** em `src/proxy.ts`, use `export function proxy(request: NextRequest)`. `export const config` com o `matcher` continua igual.

### Armadilha 1 — Erro de SSL ao conectar no Neon

**Sintoma:** `Error: self signed certificate` ou `SSL SYSCALL error`.
**Causa:** o Neon exige SSL e o `node-postgres` precisa do parâmetro `uselibpqcompat=true` para compatibilidade.
**Solução:** `src/infrastructure/db/index.ts` já adiciona esse parâmetro automaticamente se não estiver na URL. Confira se a `DATABASE_URL` termina com `?sslmode=require`.

### Armadilha 2 — `global.__drizzlePool` com erro de TypeScript

**Sintoma:** `Property '__drizzlePool' does not exist on type 'typeof globalThis'`.
**Solução:** o `declare global { var __drizzlePool: Pool | undefined; }` em `db/index.ts` precisa existir.

### Armadilha 3 — `drizzle-kit push` não encontra nenhuma tabela

**Sintoma:** o comando roda sem erro mas não cria nenhuma tabela, ou reclama que o schema está vazio.
**Causa mais comum:** o caminho `schema` em `drizzle.config.ts` está digitado errado (ex: `infrasctructure` em vez de `infrastructure`) — um erro de digitação que não quebra a compilação do TypeScript, só faz o drizzle-kit apontar pra um arquivo que não existe.
**Solução:** confira se `schema: "./src/infrastructure/db/schema.ts"` bate exatamente com o caminho real do arquivo.

### Armadilha 4 — Erros do Better Auth aparecem em inglês na tela

**Sintoma:** o formulário mostra `"Invalid email or password"` em vez de uma mensagem em português.
**Causa:** algum lugar está devolvendo `err.message` direto pro usuário em vez de passar por `translateAuthError`.
**Solução:** toda leitura de erro vindo de `auth.api.*` (login, signup, e no futuro reset de senha) precisa passar pelo `code` através de `translateAuthError` — nunca mostrar `message` cru. Se aparecer um `code` novo não mapeado, adicione em `MESSAGES_BY_CODE` (`src/lib/auth-errors.ts`).

### Armadilha 5 — Signup funciona mas a sessão não é criada

**Sintoma:** o cadastro cria o usuário no banco, mas uma chamada de sessão logo depois (`GET /api/auth/get-session`) devolve vazio.
**Causa:** o plugin `nextCookies()` não está em `auth.ts`, ou não é o último item do array `plugins`.
**Solução:** `import { nextCookies } from "better-auth/next-js"` e `plugins: [nextCookies()]` como **último** item.

### Armadilha 6 — Empresa criada mas membro não (dados inconsistentes)

**Sintoma:** o usuário é criado, mas `findByUserId` não encontra nenhuma empresa pra ele.
**Causa:** a inserção não está de fato dentro de uma transação, ou o índice único `company_members_company_user_unique` está causando conflito silencioso.
**Solução:** confira se `DrizzleCompanyRepository.create()` usa `db.transaction()` envolvendo os dois inserts.

---

### Passo 21 — Prettier com plugin do Tailwind (formatação automática no save)

Não é opcional pro resto da live: a partir daqui todo código novo (Fase 2 em diante) já nasce formatado — sem isso, cada aula ia divergir um pouco no estilo de indentação e ordem de classes.

O Prettier formata o código automaticamente no save. O plugin `prettier-plugin-tailwindcss` ordena as classes Tailwind na sequência oficial do framework (layout → spacing → typography → etc.), evitando divergência de estilo entre desenvolvedores e deixando os diffs mais limpos.

```bash
npm install -D prettier prettier-plugin-tailwindcss
```

`.prettierrc` na raiz do projeto:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

| Opção | Valor | Por quê |
|---|---|---|
| `semi` | `true` | Ponto e vírgula obrigatório — sem ambiguidade |
| `singleQuote` | `false` | Aspas duplas — padrão JSX |
| `tabWidth` | `2` | Indentação padrão JS/TS |
| `trailingComma` | `"es5"` | Trailing comma em arrays e objetos — diffs menores |
| `printWidth` | `100` | Mais espaço que o padrão de 80; adequado para TypeScript verboso |
| `plugins` | `tailwindcss` | Ordena classes Tailwind automaticamente |

VS Code: instale a extensão **Prettier - Code formatter** e adicione ao `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

```bash
npx prettier --write .   # formatar tudo
npx prettier --check .   # só verificar, útil em CI
```

---

## Commits sugeridos da parte (na branch `aula-1`)

Um commit por arquivo numérico desta pasta, na ordem em que a audiência viu — commite só depois que a etapa estiver rodando. O desenvolvedor commita manualmente, o agente nunca commita sozinho.

```bash
git checkout -b aula-1              # ou: git switch aula-1

# 1_Setup-Projeto-e-Dependencias.md
git add . && git commit -m "chore: setup Next 16 + Tailwind + deps + drizzle.config"

# 2_Banco-de-Dados.md
git add . && git commit -m "feat: pool Postgres singleton + schema da Fase 1"

# 3_Dominio-e-Repositorios.md
git add . && git commit -m "feat: contratos de domínio + repositórios Drizzle (user/company)"

# 4_Autenticacao-Better-Auth.md
git add . && git commit -m "feat: Better Auth + CreateUserWithCompany + helpers de tenant"

# 5_Actions-Login-e-Cadastro.md
git add . && git commit -m "feat: server actions signupAction/loginAction + tradução de erros"

# 6_Proxy-Protecao-de-Rotas.md
git add . && git commit -m "feat: proxy de proteção de rotas (Next 16)"

# Passo 21 — Prettier
git add . && git commit -m "chore: prettier + plugin tailwindcss, format-on-save"
```

---

## Próximos passos — Parte 2

Na próxima pasta (`aula-1-parte-2/`) construímos tudo que é tela em cima do que já está pronto e testado aqui:

- Layout de autenticação (`(auth)/layout.tsx`) e as telas de login/cadastro
- Layout protegido (`(protected)/layout.tsx`) com sidebar (bloco `sidebar` do shadcn/ui)
- Página inicial `/prospeccao` (placeholder da Fase 2)
- Checklist final da Aula 1 inteira, testado no navegador de ponta a ponta

Nada do que foi construído aqui muda na Parte 2 — ela só consome via `import`.
