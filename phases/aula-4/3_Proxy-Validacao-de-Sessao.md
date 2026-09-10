# Aula 4 — 3. Proxy: Validação Real de Sessão

> Parte de `aula-4`. Pré-requisito: `2_Metadata-Error-e-NotFound.md`. Próximo arquivo: `4_Verificacao-Armadilhas-e-Pendencias.md`.

---

### Passo 6 — De "cookie existe" para "sessão é válida"

O `src/proxy.ts` desde a Aula 1 só checava se o cookie `better-auth.session_token` (ou sua variante `__Secure-`) estava presente na requisição — um cookie com **qualquer** valor passava. A invalidação de verdade só acontecia depois, já dentro do Server Component, via `requireUser()`. Funcionalmente isso nunca deixou nada vazar (`requireUser()` sempre barrava uma sessão falsa antes de qualquer dado sensível ser lido), mas permitia uma janela estranha: uma página protegida começava a renderizar (layout, sidebar) antes de a sessão ser invalidada.

Agora o Proxy chama `auth.api.getSession({ headers: request.headers })` — a mesma função que o Better Auth usa em qualquer outro lugar do servidor — e só deixa passar se ela devolver uma sessão real, existente no banco:

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const publicPaths = ["/login", "/register"];
const authApiPrefix = "/api/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.includes(pathname) || pathname.startsWith(authApiPrefix)) {
    return NextResponse.next();
  }

  // Validação real de sessão (consulta o banco via Better Auth), não só presença do cookie.
  // Só é possível porque o Proxy (Next.js 16) sempre roda em runtime Node.js — o pool pg
  // usado pelo Drizzle não funcionaria em Edge Runtime.
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

Substitui o arquivo inteiro — não sobra nenhuma lógica de checagem manual de cookie, `auth.api.getSession()` já lê o cookie certo sozinho a partir dos headers da requisição.

**Não declare `export const runtime = "..."` neste arquivo.** No Next.js 16 isso é erro de build (`Route segment config is not allowed in Proxy file... Proxy always runs on Node.js runtime`) — o Proxy já roda em Node.js por padrão, e é exatamente por isso que dá pra chamar `getSession()` (que depende do pool `pg` do Drizzle) direto aqui.

---

### Passo 7 — Testar a validação de verdade, não só ler o código

`proxy` mudou de função síncrona pra `async` — qualquer teste que só olhe pro tipo de retorno sem rodar contra um servidor de verdade não prova nada. O teste real precisa manipular o cookie de sessão diretamente (não dá pra fazer isso de dentro da própria página, porque o cookie é `httpOnly` — invisível pra `document.cookie`) e confirmar o redirect:

**Cookie corrompido** (valor qualquer, que não existe no banco):
```
urlAfterInvalid: "http://localhost:3001/login"
```

**Sem cookie nenhum**:
```
urlNoCookie: "http://localhost:3001/login"
```

Nos dois casos, o cookie original foi restaurado logo em seguida (via `context.addCookies([original])`) e a navegação de volta a `/prospeccao` confirmou a sessão real intacta — o teste manipula o cookie no nível do contexto do navegador, não do usuário logado de verdade.

Antes desta mudança, o primeiro cenário (cookie corrompido, mas presente) **passava** — era exatamente o comportamento que o Passo 6 corrige.
