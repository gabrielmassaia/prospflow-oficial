# Aula 1 · Parte 2 — 1. UI: Layouts e Páginas de Autenticação

> Parte de `aula-1-parte-2`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Layout-Protegido-e-Sidebar.md`.

---

### Passo 1 — Root layout

Crie `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProspFlow",
  description: "Prospecção ativa e gestão comercial para agências",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR" // afeta leitores de tela, corretor ortográfico do browser e SEO
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

O `<Toaster>` do `sonner` **não** entra nesta fase — o pacote só é instalado na Fase 2 (junto com `react-hook-form`, `date-fns`, `lucide-react`), quando as primeiras ações de nichos/campanhas passarem a disparar toasts de sucesso/erro.

---

### Passo 2 — Layout de autenticação

Layout de duas colunas: painel esquerdo com marca/tagline/features (só desktop), painel direito com o formulário — `{children}` recebe `LoginForm`/`RegisterForm` dentro de um card. Puramente visual, sem lógica — vale menos comentário linha a linha e mais atenção ao resultado renderizado.

Crie `src/app/(auth)/layout.tsx`:

```tsx
import { BarChart2, Crosshair, MapPin, Shield, Sparkles } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Busca geolocalizada de leads",
    description: "Encontre empresas por nicho e localização em segundos via mapa interativo.",
  },
  {
    icon: Sparkles,
    title: "Diagnóstico e mensagem com IA",
    description: "Gere análises do negócio e mensagens personalizadas automaticamente.",
  },
  {
    icon: BarChart2,
    title: "Funil comercial completo",
    description: "Acompanhe cada lead do primeiro contato até o fechamento.",
  },
  {
    icon: Shield,
    title: "Multi-agências com isolamento",
    description: "Gerencie múltiplos clientes com dados 100% separados e seguros.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen lg:h-screen">
      {/* ── Painel esquerdo — brand (50%, só desktop) ──────────────── */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:w-1/2">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/[0.05]" />
        <div className="absolute -bottom-40 -left-20 h-[480px] w-[480px] rounded-full bg-white/[0.05]" />
        <div className="absolute bottom-32 right-10 h-52 w-52 rounded-full bg-white/[0.05]" />

        <div className="relative flex flex-1 flex-col p-12 xl:p-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Crosshair className="h-[15px] w-[15px] text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">ProspFlow</span>
          </div>

          <div className="mt-12">
            <h2 className="text-[2.2rem] font-bold leading-[1.15] tracking-tight text-white xl:text-[2.6rem]">
              Prospecte mais,
              <br />
              feche mais.
            </h2>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/65 xl:text-[15px]">
              O sistema de prospecção ativa para agências de marketing digital que querem crescer
              sem depender de indicações.
            </p>

            <ul className="mt-10 space-y-5">
              {features.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white">{title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-12 text-[11px] text-white/35">
            © 2025 ProspFlow · Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* ── Painel direito — form (50%) ─────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:w-1/2 lg:flex-none">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block lg:w-1/2"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.511 0.243 264 / 0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="flex h-14 items-center gap-2.5 border-b border-border px-6 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Crosshair className="h-[13px] w-[13px] text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            ProspFlow
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-[400px] rounded-2xl border border-border/60 bg-card p-8 shadow-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Passo 3 — Página e formulário de login

`LoginPage` é um Server Component fino — só checa a sessão (via `redirectIfAuthenticated`, da Parte 1) e renderiza o form. Sem `Suspense`/skeleton: diferente das listagens da Fase 2, não há dado nenhum pra buscar antes de renderizar.

Crie `src/app/(auth)/login/page.tsx`:

```tsx
import type { Metadata } from "next";

import { redirectIfAuthenticated } from "@/lib/tenant";

import { LoginForm } from "./_components/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Entrar" };
}

export default async function LoginPage() {
  await redirectIfAuthenticated(); // quem já está logado nunca vê este formulário

  return <LoginForm />;
}
```

Toda a interatividade (estado, `handleSubmit`, toggle de mostrar/ocultar senha) fica no form — chama `loginAction(...)` (Server Action da Parte 1) no lugar de um client SDK.

Crie `src/app/(auth)/login/_components/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { loginAction } from "@/app/actions/auth/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // evita o reload de página padrão do <form>
    setError("");
    setLoading(true);

    // FormData em vez de um estado por campo — menos boilerplate pra um
    // form pequeno que só lê os valores no submit, nunca antes disso
    const form = new FormData(e.currentTarget);
    const result = await loginAction({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error); // já vem traduzido — ver auth-errors.ts na Parte 1
      return;
    }

    router.push("/prospeccao");
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bem-vindo de volta
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Entre na sua conta para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="voce@empresa.com" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              className="h-10 pr-10"
            />
            <Button
              type="button" // crítico: sem isso, este botão dispararia o submit do form
              variant="ghost"
              size="icon-xs"
              tabIndex={-1} // fora da ordem de tab — não é um campo do formulário
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/register" className="font-medium text-primary transition-colors hover:text-primary/75">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
```

---

### Passo 4 — Página e formulário de cadastro

Mesmo formato de `LoginPage`:

```tsx
import type { Metadata } from "next";

import { redirectIfAuthenticated } from "@/lib/tenant";

import { RegisterForm } from "./_components/RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Criar conta" };
}

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return <RegisterForm />;
}
```

Salve como `src/app/(auth)/register/page.tsx`.

`RegisterForm` chama `signupAction(...)` (cria usuário + empresa) e, só se der certo, `loginAction(...)` (estabelece a sessão) — duas chamadas em sequência, ambas Server Actions.

Crie `src/app/(auth)/register/_components/RegisterForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { loginAction } from "@/app/actions/auth/login";
import { signupAction } from "@/app/actions/auth/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const companyName = String(form.get("companyName") ?? "");

    // 1ª chamada: cria usuário + empresa (transação, ver Parte 1)
    const result = await signupAction({ name, email, password, companyName });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return; // não tenta logar se o cadastro falhou
    }

    // 2ª chamada: só depois do cadastro confirmado, estabelece a sessão —
    // é o Better Auth quem cria o usuário no signup, não quem loga sozinho
    const loginResult = await loginAction({ email, password });

    setLoading(false);

    if (!loginResult.ok) {
      // caso raro: conta criada mas login falhou (ex: erro transitório de rede)
      setError("Conta criada. Tente fazer login.");
      return;
    }

    router.push("/prospeccao");
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Criar conta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Comece a prospectar clientes hoje mesmo
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" required placeholder="João Silva" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="companyName">Nome da agência</Label>
          <Input id="companyName" name="companyName" required placeholder="Acme Marketing" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="voce@empresa.com" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="h-10 pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? "Criando conta..." : "Criar conta grátis"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/75">
          Entrar
        </Link>
      </p>
    </div>
  );
}
```
