# Aula 1 · Parte 1 — 5. Server Actions de Login e Cadastro

> Parte de `aula-1-parte-1`. Pré-requisito: `4_Autenticacao-Better-Auth.md`. Próximo arquivo: `6_Proxy-Protecao-de-Rotas.md`.

---

### Passo 14 — Tradução dos erros do Better Auth

O Better Auth responde erro em inglês (`"Invalid email or password"`, `"User already exists. Use another email."`) e não tem opção de i18n nativa — como o produto é para o público brasileiro, nunca mostramos essa mensagem crua na tela. A pegadinha: **não dá pra confiar no texto** (`message`) porque ele pode mudar a qualquer atualização da lib; dá pra confiar no `code` (`INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), que é a parte estável do contrato da API.

Crie `src/lib/auth-errors.ts`:

```typescript
// mapa code → mensagem em pt-BR. Cresce conforme novos fluxos (reset de
// senha, OAuth) passam a expor outros codes do Better Auth
const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha inválidos",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este email",
  USER_ALREADY_EXISTS: "Já existe uma conta com este email",
  INVALID_EMAIL: "Email inválido",
  PASSWORD_TOO_SHORT: "Senha muito curta",
  PASSWORD_TOO_LONG: "Senha muito longa",
};

export function translateAuthError(
  err: { code?: string; message?: string } | undefined,
  fallback: string
): string {
  // sem code reconhecido (erro de rede, code novo que ainda não mapeamos)
  // cai no fallback pt-BR genérico passado por quem chamou — nunca no inglês
  if (!err?.code) return fallback;
  return MESSAGES_BY_CODE[err.code] ?? fallback;
}
```

**Como descobrir o `code` de um erro que você ainda não mapeou:** rode a chamada direto contra a rota do Better Auth e olhe a resposta —

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@x.com","password":"errada"}'
# {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}
```

---

### Passo 15 — Server Action de signup

A action é deliberadamente fina: valida o formato do input com Zod, monta as dependências concretas, delega pro use case, devolve o resultado. Nenhuma regra de negócio mora aqui — validação de formato é responsabilidade do controller (a action), regra de negócio é responsabilidade do use case.

Crie `src/app/actions/auth/signup.ts`:

```typescript
"use server";

import { z } from "zod";

import { db } from "@/infrastructure/db";
import { DrizzleCompanyRepository } from "@/infrastructure/repositories/DrizzleCompanyRepository";
import { CreateUserWithCompany } from "@/use-cases/auth/CreateUserWithCompany";

// mensagens já em pt-BR — Zod não tem i18n embutido, cada regra carrega
// sua própria mensagem de erro como segundo argumento
const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  companyName: z.string().min(2, "Nome da empresa deve ter ao menos 2 caracteres"),
});

export async function signupAction(formData: {
  name: string;
  email: string;
  password: string;
  companyName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = signupSchema.safeParse(formData);

  if (!parsed.success) {
    // pega só a primeira mensagem de erro — suficiente pro formulário
    // mostrar um único aviso por vez, sem lista de erros
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // aqui, e só aqui, a action escolhe QUAL implementação concreta usar
  const companyRepo = new DrizzleCompanyRepository(db);
  const useCase = new CreateUserWithCompany(companyRepo);

  return useCase.execute(parsed.data);
}
```

> **Convenção de nome:** toda Server Action termina com o sufixo `Action` (`signupAction`, `loginAction`, e mais tarde `createNicheAction`, `moveLeadAction`...). Deixa óbvio, em qualquer import de componente, que aquela função roda no servidor — não é um helper client qualquer.

---

### Passo 16 — Server Action de login

Mesmo mecanismo do signup (Passo 10, arquivo anterior): `asResponse: true` permite ao plugin `nextCookies()` (configurado em `4_Autenticacao-Better-Auth.md`) ler o `Set-Cookie` da resposta e aplicar a sessão automaticamente — sem client SDK, sem chamada extra do navegador.

Crie `src/app/actions/auth/login.ts`:

```typescript
"use server";

import { z } from "zod";

import { auth } from "@/lib/auth";
import { translateAuthError } from "@/lib/auth-errors";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = loginSchema.safeParse(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const response = await auth.api.signInEmail({ body: parsed.data, asResponse: true });

  if (!response.ok) {
    const err = (await response.json()) as { code?: string; message?: string };
    return { ok: false, error: translateAuthError(err, "Credenciais inválidas") };
  }

  return { ok: true };
}
```

---

### Passo 17 — `redirectIfAuthenticated`

Adicione em `src/lib/tenant.ts`, ao lado de `requireUser()`/`requireCompany()` (Passo 12, arquivo anterior). Quem já tem sessão ativa não deveria conseguir abrir `/login` ou `/register` de novo — é o caminho inverso de `requireUser`:

```typescript
export async function redirectIfAuthenticated(destination = "/prospeccao") {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(destination);
  }
}
```

As páginas `/login` e `/register` chamam isso logo no início (ver `aula-1-parte-2/1_UI-Paginas-Auth.md`) — antes de renderizar qualquer formulário.
