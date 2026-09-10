# Aula 1 · Parte 1 — 4. Autenticação com Better Auth

> Parte de `aula-1-parte-1`. Pré-requisito: `3_Dominio-e-Repositorios.md`. Próximo arquivo: `5_Actions-Login-e-Cadastro.md`.

---

### Passo 10 — Use case: criar usuário com empresa

Este use case orquestra dois sistemas que não se conhecem: o Better Auth (que sabe criar usuário + sessão) e o `ICompanyRepository` (que sabe criar empresa + vínculo). Nenhum dos dois sabe da existência do outro — quem os conecta é este arquivo.

Crie `src/use-cases/auth/CreateUserWithCompany.ts`:

```typescript
import { auth } from "@/lib/auth";
import { translateAuthError } from "@/lib/auth-errors";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository";

interface Input {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

type Result = { ok: true } | { ok: false; error: string };

// gera um slug seguro pra URL a partir do nome da empresa:
// "Acme Marketing!" → "acme-marketing"
function slugify(s: string): string {
  return s
    .normalize("NFD") // separa acentos das letras ("á" → "a" + "´")
    .replace(/[̀-ͯ]/g, "") // remove os acentos já separados
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // qualquer sequência de caracteres não-alfanuméricos vira "-"
    .replace(/(^-|-$)/g, ""); // remove "-" sobrando no início/fim
}

export class CreateUserWithCompany {
  constructor(private companyRepo: ICompanyRepository) {}

  async execute({ name, email, password, companyName }: Input): Promise<Result> {
    try {
      // asResponse: true — ver justificativa completa logo abaixo
      const response = await auth.api.signUpEmail({
        body: { name, email, password },
        asResponse: true,
      });

      if (!response.ok) {
        // o Better Auth devolve { code, message } em inglês — nunca mostramos
        // isso cru pro usuário, sempre passa por translateAuthError primeiro
        const err = (await response.json()) as { code?: string; message?: string };
        return { ok: false, error: translateAuthError(err, "Erro ao criar usuário") };
      }

      const data = (await response.json()) as { user: { id: string } };
      const userId = data.user.id;

      const slug = slugify(companyName);

      // regra de negócio de verdade: empresa + membro-dono nascem juntos,
      // em transação (ver DrizzleCompanyRepository.create em 3_Dominio-e-Repositorios.md)
      await this.companyRepo.create({ name: companyName, slug, ownerId: userId });

      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      return { ok: false, error: message };
    }
  }
}
```

**Por que `asResponse: true`?** Chamar `auth.api.signUpEmail` com esse parâmetro, de dentro de uma Server Action, é o que permite ao plugin `nextCookies()` (configurado no Passo 11) interceptar o `Set-Cookie` da resposta e aplicá-lo via `next/headers` — a sessão já fica ativa assim que o cadastro termina, sem uma chamada extra do client SDK. O Server Action de login reaproveita o mesmo mecanismo (ver `5_Actions-Login-e-Cadastro.md`).

**Por que este use case importa `auth` direto, quebrando a regra "use case não conhece infraestrutura"?** O Better Auth é a fronteira de autenticação do sistema — ele gera o usuário, a sessão e o token. Trocar de biblioteca de auth exigiria reescrever esta camada inteira de qualquer forma, então abstrair isso atrás de uma interface não compraria flexibilidade real, só indireção. Já a criação de empresa, essa sim abstraímos via `ICompanyRepository`, porque o banco por trás dela pode mudar sem que a regra de negócio mude.

---

### Passo 11 — Configurar Better Auth

Crie `src/lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/infrastructure/db";
import * as schema from "@/infrastructure/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: false,
    // passa o módulo inteiro — o adapter reconhece sozinho as tabelas
    // "users", "sessions", "accounts", "verifications" dentro dele
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    password: {
      // import dinâmico: bcryptjs só carrega quando o hash/verify roda de
      // verdade (login ou cadastro), não em todo request que toca este arquivo
      hash: async (password: string) => {
        const bcrypt = await import("bcryptjs");
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        const bcrypt = await import("bcryptjs");
        return await bcrypt.compare(password, hash);
      },
    },
  },
  // o schema.ts usa o sufixo "Table" nos nomes das tabelas (convenção do
  // projeto) — aqui dizemos ao Better Auth qual export corresponde a cada papel
  user: { modelName: "usersTable" },
  session: { modelName: "sessionsTable" },
  account: { modelName: "accountsTable" },
  verification: { modelName: "verificationsTable" },
  // sempre o ÚLTIMO plugin do array — ver por quê logo abaixo
  plugins: [nextCookies()],
});
```

**Por que não passamos `secret` explicitamente?** O Better Auth lê `BETTER_AUTH_SECRET` do `process.env` sozinho quando a opção não é informada.

**Por que `plugins: [nextCookies()]` é obrigatório?** Server Actions no Next.js não conseguem setar cookies diretamente via header `Set-Cookie` — o framework bloqueia isso por segurança. O plugin intercepta as respostas do Better Auth e usa o helper `cookies()` do Next.js para setar o cookie corretamente. **Sem ele, o signup cria o usuário no banco mas não seta a sessão** — o usuário é redirecionado como se tivesse logado, mas na verdade está deslogado. Precisa ser o último item do array.

---

Crie `src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

Este arquivo só é importado em componentes `"use client"`. Login e cadastro **não** o usam — são Server Actions (Passo 14, próximo arquivo). Ele entra em cena na Parte 2, no botão de logout da Sidebar (`authClient.signOut()`) — a única operação de auth que ainda faz sentido disparar direto do navegador.

---

### Passo 12 — Helpers de tenant

Três funções que toda página protegida (e, mais adiante, toda Server Action de negócio) vai chamar. `requireUser`/`requireCompany` nascem aqui; `redirectIfAuthenticated` chega no próximo arquivo, junto com login/signup, pra manter os três helpers de tenant no mesmo lugar conceitual.

Crie `src/lib/tenant.ts`:

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/infrastructure/db";
import { DrizzleCompanyRepository } from "@/infrastructure/repositories/DrizzleCompanyRepository";
import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(), // Server Components não têm acesso direto ao request — headers() é a ponte
  });

  // redirect() lança uma exceção especial internamente — o código depois
  // desta linha nunca executa se não houver sessão (ver nota abaixo)
  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function requireCompany(userId: string) {
  // reaproveita a mesma query de DrizzleCompanyRepository.findByUserId
  // (3_Dominio-e-Repositorios.md) em vez de reescrever o join aqui
  const companyRepo = new DrizzleCompanyRepository(db);
  const company = await companyRepo.findByUserId(userId);

  if (!company) {
    redirect("/login"); // usuário sem empresa vinculada — não deveria acontecer, mas se acontecer, não deixa passar
  }

  return { companyId: company.id, company };
}
```

**Por que `requireUser` chama `redirect()` em vez de retornar `null`?** `redirect()` lança uma exceção especial que o Next.js intercepta e transforma num HTTP 307 — ela aborta a execução do Server Component ali mesmo. Isso garante que nenhum código depois de `requireUser()` roda se o usuário não estiver autenticado, sem precisar de `if (!user) return` espalhado em toda página. `requireCompany()` segue a mesma lógica.

**Por que `requireCompany` faz a query direto no repositório em vez de passar por um use case?** `tenant.ts` é infraestrutura cross-cutting — chamado em praticamente toda página protegida — não é uma regra de negócio isolada. Não existe nenhuma decisão de domínio acontecendo aqui, só resolução de sessão/tenant; passar por um "use case" adicionaria uma camada sem propósito. `ICompanyRepository`/`DrizzleCompanyRepository` continuam sendo usados de verdade onde a regra de negócio mora: o use case de cadastro (Passo 10).

---

### Passo 13 — Route Handler do Better Auth

```typescript
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// toNextJsHandler devolve os dois métodos HTTP que o Better Auth precisa —
// GET pra leituras (ex: get-session) e POST pra ações (sign-in, sign-up, sign-out)
export const { POST, GET } = toNextJsHandler(auth);
```

Salve como `src/app/api/auth/[...all]/route.ts`. O `[...all]` é um catch-all route do Next.js — captura qualquer rota sob `/api/auth/*`: `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`, `/api/auth/get-session`, etc. Um único arquivo cobre toda a API do Better Auth.
