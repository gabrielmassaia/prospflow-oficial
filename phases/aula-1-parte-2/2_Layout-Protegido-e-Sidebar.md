# Aula 1 · Parte 2 — 2. Layout Protegido e Sidebar

> Parte de `aula-1-parte-2`. Pré-requisito: `1_UI-Paginas-Auth.md`. Próximo arquivo: `3_Verificacao-e-Armadilhas.md`.

---

### Passo 5 — Placeholder do layout protegido e raiz do app

Crie `src/app/(protected)/layout.tsx` — placeholder simples por enquanto; a versão final, com `AppSidebar`, vem no Passo 9 deste mesmo arquivo, depois que a sidebar existir:

```tsx
import { requireUser } from "@/lib/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser(); // redireciona para /login se não autenticado (ver Parte 1)
  return <div className="min-h-screen">{children}</div>;
}
```

Crie `src/app/page.tsx` (raiz do site):

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/prospeccao");
}
```

**Por que redirecionar direto pra `/prospeccao` em vez de `/login`?** Sem esse arquivo, acessar `/` dá 404. E não precisa decidir aqui se o usuário está logado ou não: se não tiver sessão, o `requireUser()` do layout protegido (acima) já lança o redirect pra `/login` assim que `/prospeccao` tentar renderizar — duplicar essa checagem na raiz seria redundante.

---

### Passo 6 — Página inicial protegida

Crie `src/app/(protected)/prospeccao/page.tsx`:

```tsx
import { Target } from "lucide-react";

import { requireCompany, requireUser } from "@/lib/tenant";

export default async function ProspeccaoPage() {
  const user = await requireUser();
  const { company } = await requireCompany(user.id); // encadeamento: só busca empresa se já tem usuário

  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Prospecção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Olá, {firstName}. Bem-vindo de volta à{" "}
          <span className="font-medium text-foreground">{company.name}</span>.
        </p>
      </div>

      {/* Placeholder — a Fase 2 substitui isso pelo dashboard real de campanhas */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">Nenhuma campanha ainda</h2>
        <p className="mt-1.5 max-w-sm text-center text-sm text-muted-foreground">
          Na Fase 2 vamos criar campanhas de prospecção com busca geolocalizada e geração de leads
          automática via Cloudflare AI.
        </p>
      </div>
    </div>
  );
}
```

Já usa os tokens de tema (`text-foreground`, `bg-primary/10`) e o bloco `Sidebar`/`(protected)/layout.tsx` que construímos a seguir — o ícone `Target` e o empty-state já conversam visualmente com o resto do app desde a Aula 1.

---

## Sistema de Design e Sidebar

### Design tokens no `globals.css`

O ProspFlow usa **indigo como cor primária de marca** (`oklch(0.511 0.243 264)` ≈ `#4F46E5`), usado só em pontos de destaque (botões, links, foco, item ativo da nav) — nunca como cor de fundo de página inteira. Os neutrals têm um leve viés violeta — cinzas "escolhidos", não herdados do padrão do Tailwind.

O que mais importa aqui não é o matiz, é a **escala de camadas**: fundo, card e sidebar precisam ter luminosidade perceptivelmente diferente entre si — senão a interface parece "uma folha branca só" e hovers ficam invisíveis.

```
--background     0.965  → fundo da página (cinza suave, não branco)
--card           0.995  → superfície dos cards (mais clara que o fundo — "flutua")
--sidebar        0.930  → sidebar com "chrome" próprio, mais escura que o conteúdo
--muted/secondary 0.930 → zonas neutras e badges
--accent         0.900  → base do hover — precisa ser visivelmente mais escuro que card/muted
--border         0.870  → bordas discretas, trabalham junto com shadow-sm/shadow-md
```

Cada token tem equivalente para `.dark`, com background `oklch(0.118 0.016 264)` (preto com viés azul-violeta — mais sofisticado que preto puro).

**Por que a sidebar é mais escura que o card, e não mais clara?** Cria a sensação de "app real" (como Linear/Vercel): a sidebar é o "chrome" da aplicação, o conteúdo é o que importa — e por isso fica na camada mais clara/destacada.

Substitua `src/app/globals.css` (o `create-next-app` gera um tema cinza padrão — sem chroma nenhum — que precisa ser trocado pelos tokens acima):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* liga a variável genérica que as classes utilitárias (font-sans) usam
     à variável real que o next/font gera — sem essa linha, --font-sans
     fica indefinida e o browser cai pro fallback do sistema (serif) */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  /* ...restante do mapeamento de --color-* e --radius-* segue igual ao
     que o `shadcn init` já gerou — só os tokens de :root/.dark abaixo mudam */
}

:root {
  --brand: oklch(0.511 0.243 264); /* indigo de marca — só em pontos de destaque */
  --brand-foreground: oklch(0.985 0 0);

  --background: oklch(0.965 0.006 264); /* camada 1 — fundo, nunca branco puro */
  --foreground: oklch(0.13 0.022 264);
  --card: oklch(0.995 0.002 264); /* camada 2 — mais clara que o fundo, "flutua" */
  --card-foreground: oklch(0.13 0.022 264);

  --primary: oklch(0.511 0.243 264);
  --primary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.93 0.008 264);
  --muted-foreground: oklch(0.5 0.012 264);
  --accent: oklch(0.9 0.016 264); /* base do hover — mais escuro que muted/card */
  --border: oklch(0.87 0.01 264);
  --ring: oklch(0.511 0.243 264);
  --radius: 0.625rem;

  --sidebar: oklch(0.93 0.014 264); /* camada 3 — "chrome", mais escura que o conteúdo */
  --sidebar-foreground: oklch(0.13 0.022 264);
  --sidebar-primary: oklch(0.511 0.243 264);
  --sidebar-accent: oklch(0.87 0.02 264);
  --sidebar-border: oklch(0.87 0.014 264);
}

.dark {
  --brand: oklch(0.63 0.22 264); /* clareado — precisa continuar legível sobre fundo escuro */
  --background: oklch(0.118 0.016 264); /* preto com viés azul-violeta, não preto puro */
  --foreground: oklch(0.945 0.009 264);
  --card: oklch(0.165 0.018 264);
  --primary: oklch(0.63 0.22 264);
  --muted: oklch(0.215 0.02 264);
  --muted-foreground: oklch(0.6 0.016 264);
  --accent: oklch(0.245 0.025 264);
  --border: oklch(1 0 0 / 9%);
  --ring: oklch(0.63 0.22 264);
  --sidebar: oklch(0.148 0.018 264);
  --sidebar-foreground: oklch(0.945 0.009 264);
  --sidebar-primary: oklch(0.63 0.22 264);
  --sidebar-accent: oklch(0.215 0.022 264);
  --sidebar-border: oklch(1 0 0 / 9%);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  html {
    @apply font-sans;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3, h4, h5, h6 {
    text-wrap: balance; /* evita título quebrando numa palavra órfã sozinha na última linha */
    letter-spacing: -0.02em; /* headings em Geist ficam soltos demais no tracking padrão */
  }
}
```

**A pegadinha real de `--font-sans: var(--font-geist-sans)`:** o `next/font` (em `app/layout.tsx`) gera `--font-geist-sans` como uma CSS custom property com o nome literal da fonte. Mas a classe utilitária `font-sans` do Tailwind lê `--font-sans` — um nome genérico diferente. Se ninguém conectar as duas, `--font-sans` fica com valor vazio e **o Chrome não lança nenhum erro**: ele silenciosamente usa a fonte serif padrão do sistema (geralmente Times New Roman) no lugar. O sintoma na tela não parece "fonte errada" — parece "fonte fina e estranha", porque um serif do sistema, sem hinting nenhum, realmente fica mais fino que um sans-serif desenhado pra tela como o Geist. Vale conferir isso com `getComputedStyle(document.body).fontFamily` no console do browser sempre que a tipografia parecer "errada" de um jeito difícil de apontar.

### Sidebar — construída sobre o `Sidebar` do shadcn/ui

A sidebar **não** é um `<aside>`/`<div>` escrito à mão — é construída sobre o bloco `sidebar` do shadcn/ui, que já resolve responsividade (vira um `Sheet` deslizante no mobile, fixa no desktop), estado ativo/colapsado e acessibilidade. Reescrever isso à mão funcionaria pro dia 1, mas custaria caro quando o menu ganhar mais itens nas próximas fases.

```bash
npx shadcn@latest add sidebar
```

Instala `src/components/ui/sidebar.tsx` e as dependências que ele usa internamente: `separator`, `sheet`, `skeleton`, `tooltip` e o hook `src/hooks/use-mobile.ts`.

---

### Passo 7 — Componente `AppSidebar`

Três zonas, montadas com as peças do shadcn (`SidebarHeader`, `SidebarContent`/`SidebarGroup`/`SidebarMenu`, `SidebarFooter`): **Header** (ícone `Crosshair` + wordmark), **Menu** (um item por rota) e **Footer** (avatar com iniciais, nome + empresa, botão de logout).

Crie `src/components/layout/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crosshair, LogOut, Target } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  user: { name: string; email: string };
  company: { name: string };
}

// Só a rota desta fase. Cada fase seguinte adiciona seus próprios itens
// aqui (ver aula-2/5_Dashboard-e-Layout.md) — a estrutura do componente não muda
const navItems = [{ href: "/prospeccao", label: "Prospecção", icon: Target, exact: true }];

// "João Silva" → "JS" · "Maria" → "M"
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AppSidebar({ user, company }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut(); // única chamada de auth feita direto do client SDK no projeto
    router.push("/login");
  }

  const initials = getInitials(user.name);

  return (
    <Sidebar>
      <SidebarHeader className="h-14 flex-row items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Crosshair className="h-[15px] w-[15px] text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
          ProspFlow
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon, exact }) => {
                // exact: true (rota raiz "/prospeccao") não pode dar match em
                // "/prospeccao/campanhas" também — senão dois itens do menu
                // ficariam marcados como ativos ao mesmo tempo
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
                return (
                  <SidebarMenuItem key={href}>
                    {/* render={<Link .../>} (padrão base-ui) em vez de asChild:
                        o <Link> vira o elemento renderizado de fato, e isActive
                        já controla o estilo do item ativo sem precisar de cn() manual */}
                    <SidebarMenuButton isActive={active} render={<Link href={href} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {company.name}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            title="Sair"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-[15px] w-[15px]" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

> **Convenção do projeto:** todo botão clicável — mesmo pequeno, como o ícone de logout acima ou o toggle de mostrar senha nos formulários (Parte 2, arquivo 1) — usa o `Button` de `@/components/ui/button` (com `variant="ghost"` e `size="icon-sm"`/`"icon-xs"` pra botões só de ícone) em vez de um `<button>` cru. Mantém foco/hover/disabled consistentes sem reimplementar isso a cada componente novo.

---

### Passo 8 — Layout protegido final

O layout vira um Server Component `async`: busca `user` e `company` via `requireUser()` → `requireCompany()` (Parte 1), e monta a estrutura oficial do bloco `sidebar` — `SidebarProvider` (contexto de aberto/fechado, inclusive no mobile) envolvendo `AppSidebar` + `SidebarInset` (a área de conteúdo).

Substitua o placeholder do Passo 5 por `src/app/(protected)/layout.tsx`:

```tsx
import { Crosshair } from "lucide-react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { AppSidebar } from "@/components/layout/Sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { company } = await requireCompany(user.id);

  return (
    <SidebarProvider className="h-screen overflow-hidden bg-background">
      <AppSidebar user={{ name: user.name, email: user.email }} company={company} />
      <SidebarInset className="overflow-y-auto">
        {/* header só aparece no mobile — no desktop a sidebar já fica sempre
            visível, sem precisar de um gatilho pra abrir/fechar */}
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border bg-sidebar px-4 md:hidden">
          <SidebarTrigger />
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Crosshair className="h-[15px] w-[15px] text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
            ProspFlow
          </span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

A separação Server/Client é intencional: o layout busca os dados (Server), a sidebar reage ao `pathname` e dispara logout (Client). Dados fluem de cima pra baixo — nunca o contrário.

**Por que não escrever a sidebar à mão?** Um `<aside>` fixo com Tailwind puro seria mais rápido de digitar na hora, mas o comportamento mobile (menu virando overlay) precisaria ser implementado manualmente, e não haveria estado compartilhado (`useSidebar()`) caso outra parte da UI precise saber se o menu está aberto. O bloco oficial do shadcn resolve isso de graça — e é o mesmo padrão usado no resto do projeto pra `Dialog`, `Sheet`, `Table`, etc.
