# Aula 1 · Parte 1 — 1. Setup do Projeto e Dependências

> Parte de `aula-1-parte-1`. Leia antes: `0_Conceitos-e-Decisoes.md`. Próximo arquivo: `2_Banco-de-Dados.md`.

---

### Passo 1 — Criar o projeto Next.js

As flags abaixo não são arbitrárias: cada uma corresponde a uma decisão que o resto da Aula 1 depende. `--src-dir` porque toda a estrutura de pastas documentada (`src/domain`, `src/use-cases`, etc.) pressupõe isso; `--import-alias "@/*"` porque todo import do projeto usa esse prefixo em vez de caminhos relativos gigantes.

```bash
npx create-next-app@latest prospflow \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd prospflow
```

**Flags explicadas:**
- `--typescript` → TypeScript habilitado (obrigatório para o projeto)
- `--tailwind` → Tailwind CSS v4 configurado automaticamente
- `--eslint` → linting configurado
- `--app` → usa App Router (não Pages Router)
- `--src-dir` → coloca tudo dentro de `src/`
- `--import-alias "@/*"` → permite `import { db } from "@/infrastructure/db"` em vez de `"../../../infrastructure/db"`

---

### Passo 2 — Instalar dependências

`bcryptjs` em vez de `bcrypt` é intencional: `bcrypt` compila um binário nativo (`node-gyp`) que quebra silenciosamente em builds serverless como a Vercel se a versão do Node do build divergir da de runtime. `bcryptjs` é puro JavaScript — mais lento, mas nunca quebra por incompatibilidade de plataforma.

```bash
# Dependências de produção
npm install drizzle-orm pg better-auth bcryptjs zod

# Dependências de desenvolvimento
npm install -D drizzle-kit @types/pg @types/bcryptjs
```

**O que cada pacote faz:**
- `drizzle-orm` — o ORM em si (queries, schema, tipos)
- `pg` — driver PostgreSQL para Node.js (Drizzle não inclui o driver, você escolhe)
- `better-auth` — biblioteca de autenticação completa
- `bcryptjs` — hash de senhas, sem binário nativo
- `zod` — validação de schemas TypeScript em runtime
- `drizzle-kit` — CLI de migrations e push de schema (só em dev)
- `@types/pg`, `@types/bcryptjs` — tipos TypeScript das libs

---

### Passo 3 — Instalar shadcn/ui

```bash
npx shadcn@latest init
```

Quando perguntar, escolha: Style → `base-nova`, Base color → `Neutral`, CSS variables → `Yes`.

```bash
npx shadcn@latest add button input label card
```

Isso cria `src/components/ui/` com os componentes que esta parte usa. `badge` só entra na Fase 2, quando passa a ser usado de fato — instalar componente sem consumidor deixa código morto no projeto.

---

### Passo 4 — Criar variáveis de ambiente

Crie `.env.local` na raiz (nunca vai pro git — está no `.gitignore`):

```env
DATABASE_URL=postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=cole_aqui_o_secret
```

Gere o `BETTER_AUTH_SECRET`:

```bash
npx better-auth secret
# Cole o valor gerado no .env.local
```

> **Se o comando acima falhar** (`npm error could not determine executable to run`), gere 32 bytes aleatórios em hex direto com o Node — é exatamente o formato que o Better Auth espera:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

Crie também `.env.example` (sem valores reais — este sim vai para o git, é o template para quem clonar o projeto):

```env
DATABASE_URL=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=
```

**Onde pegar a `DATABASE_URL`:** [neon.tech](https://neon.tech) → criar projeto → "Connection string" → copiar a string com `?sslmode=require`.

---

### Passo 5 — Configurar o Drizzle Kit

```typescript
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// carrega .env.local ANTES do defineConfig ler process.env — sem isso,
// DATABASE_URL chega undefined aqui (o Next.js carrega .env.local sozinho
// em runtime, mas o drizzle-kit roda como script isolado, fora do Next.js)
config({ path: ".env.local" });

export default defineConfig({
  out: "./drizzle", // onde o drizzle-kit grava os arquivos de migration gerados
  schema: "./src/infrastructure/db/schema.ts", // única fonte de verdade do schema
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // "!" — sabemos que existe, validado no passo 4
  },
});
```

Salve como `drizzle.config.ts` na raiz do projeto.

**Por que isso importa:** um erro de digitação no caminho de `schema` (por exemplo `infrasctructure` em vez de `infrastructure`) faz o `drizzle-kit push` falhar dizendo que não encontra nenhuma tabela — sem apontar pra linha errada. Vale conferir o caminho duas vezes.
