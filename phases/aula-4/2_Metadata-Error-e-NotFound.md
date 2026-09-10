# Aula 4 — 2. Metadata, Error e Not Found

> Parte de `aula-4`. Pré-requisito: `1_Seed-Automatico-no-Cadastro.md`. Próximo arquivo: `3_Proxy-Validacao-de-Sessao.md`.

---

### Passo 4 — `generateMetadata()` no dashboard, a última página que faltava

Desde a Aula 1, toda página nova ganhou `generateMetadata()` (ou `metadata` estático) assim que era criada — exceto o dashboard, que nasceu como placeholder estático na Aula 1 e virou dashboard real só na Aula 2, Parte 6, sem essa peça ter sido revisitada na hora. Fechando a lacuna:

```typescript
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Dashboard" };
}
```

Adicionado em `src/app/(protected)/prospeccao/page.tsx`, junto do `import type { Metadata } from "next"`. Com isso, toda página de rota (exceto a raiz `/`, que só redireciona, e os layouts, que herdam o `metadata` estático do root) tem título próprio.

---

### Passo 5 — `not-found.tsx` e `error.tsx`: duas convenções, dois comportamentos

O App Router do Next.js tem dois arquivos especiais que capturam situações diferentes:

- **`not-found.tsx`** — renderiza quando `notFound()` é chamado explicitamente ou uma rota simplesmente não existe. Pode ser Server Component: é UI estática, sem estado nem efeito.
- **`error.tsx`** — um *error boundary* de React, que captura exceções lançadas durante a renderização daquele segmento. **Precisa** ser Client Component (`"use client"`) porque error boundaries são um conceito que só existe no cliente. Recebe sempre `{ error, reset }` como props — `reset()` tenta re-renderizar o segmento do zero, sem recarregar a página inteira.

Um `error.tsx` na raiz de `src/app/` cobre qualquer erro não capturado em nenhum nível mais específico — mas quando ele dispara, substitui a **tela inteira**, sidebar incluída. Por isso este projeto também ganha um `error.tsx` **dentro de `(protected)`**: um erro numa página interna (dashboard, nichos, campanhas...) é capturado ali, preenchendo só a área de conteúdo — a sidebar continua no lugar, e o usuário nunca perde a navegação por causa de um erro numa única página. O global só entra em cena se o próprio layout protegido falhar (algo bem mais raro).

Crie `src/app/not-found.tsx` — Server Component, com `metadata` estático próprio (não `generateMetadata`, porque não há nada assíncrono a resolver):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Compass className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Página não encontrada</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O endereço acessado não existe ou foi movido.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/prospeccao" />}>
            Voltar para o dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

> `Button render={<Link .../>}` é a API do Base UI (base do shadcn deste projeto): em vez de `asChild` (padrão Radix), o `Button` renderiza o elemento passado em `render`, herdando o estilo. É como o botão "vira" um link do Next sem perder o visual. O `nativeButton={false}` é necessário sempre que o `render` troca o elemento por algo que não é um `<button>` de verdade — ver a Armadilha correspondente em `4_Verificacao-Armadilhas-e-Pendencias.md`, encontrada testando esta própria página no navegador.

Crie `src/app/error.tsx` — Client Component global:

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente novamente ou volte para o dashboard.
            </p>
          </div>
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Tentar novamente
            </Button>
            <Button className="flex-1" nativeButton={false} render={<Link href="/prospeccao" />}>
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

`useEffect(() => console.error(error), [error])` existe porque o React não loga automaticamente o erro capturado por um boundary no console — sem essa linha, o erro simplesmente desapareceria da visão de quem está depurando, mesmo com a UI de fallback funcionando perfeitamente.

Crie `src/app/(protected)/error.tsx` — o boundary do segmento protegido, sem o `min-h-screen` (não é tela cheia; preenche só a área de conteúdo dentro da shell que já tem a sidebar):

```tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProtectedError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ocorreu um erro ao carregar esta página. Tente novamente.
            </p>
          </div>
          <Button variant="outline" onClick={reset}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

Este boundary não tem botão de "Dashboard" — só "Tentar novamente" — porque a sidebar já está visível ao lado; navegar pra outra página é um clique nela, sem precisar de mais um atalho na própria tela de erro.
