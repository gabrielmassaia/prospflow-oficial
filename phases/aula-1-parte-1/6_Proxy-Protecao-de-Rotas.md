# Aula 1 · Parte 1 — 6. Proxy de Proteção de Rotas

> Parte de `aula-1-parte-1`. Pré-requisito: `5_Actions-Login-e-Cadastro.md`. Próximo arquivo: `7_Verificacao-e-Armadilhas.md`.

---

### Passo 18 — Proxy de proteção de rotas (Next.js 16)

> **⚠️ Mudança do Next.js 16:** o arquivo `middleware.ts` foi renomeado para `proxy.ts`, e a função exportada de `middleware` para `proxy`. Usar o nome antigo não gera erro de compilação — o Next.js simplesmente ignora o arquivo em silêncio, e suas rotas ficam desprotegidas sem nenhum aviso.

A estratégia é em duas camadas, cada uma resolvendo um problema diferente:
- **Aqui no proxy** → só confere se o cookie de sessão *existe*. Roda em toda requisição, incluindo imagens e fontes — validar a sessão no banco a cada uma seria desperdício.
- **`requireUser()` na página** (arquivo `4_Autenticacao-Better-Auth.md`) → confere se a sessão *é válida* de verdade, consultando o banco. Essa é a camada de segurança real.

Crie `src/proxy.ts` (dentro de `src/`, ao lado de `app/`):

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/register"];
const authApiPrefix = "/api/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // rotas de auth e a própria API do Better Auth passam direto — não faz
  // sentido exigir cookie pra acessar a página de login
  if (publicPaths.includes(pathname) || pathname.startsWith(authApiPrefix)) {
    return NextResponse.next();
  }

  // só verifica presença — a validade real fica por conta do requireUser()
  // no Server Component. Dois nomes de cookie porque o Better Auth usa
  // prefixo "__Secure-" quando o cookie é setado sobre HTTPS
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // exclui pastas internas do Next.js e qualquer arquivo com extensão
  // (imagens, fontes, etc. servidos de /public) — rodar a checagem de
  // sessão nesses assets seria trabalho sem propósito
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

**Importante:** o cookie só prova que existe uma sessão — nunca que ela é válida (pode estar expirada, revogada, etc.). Por isso `requireUser()` nas páginas continua obrigatório.

> Numa fase futura este mesmo arquivo pode trocar a checagem de presença por uma validação real de sessão (`auth.api.getSession()`), já que o Proxy do Next.js 16 sempre roda em Node.js e suportaria isso — mas o custo de bater no banco em toda requisição normalmente não compensa.
