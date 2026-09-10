# Aula 1 · Parte 2 — Interface (Telas, Layout e Sidebar)

> **Para a live:** Índice de leitura da Parte 2. Pré-requisito: `aula-1-parte-1/` completa e testada — esta parte só consome o que já existe (Server Actions, `tenant.ts`, `auth.ts`), nunca reescreve.
> Tempo estimado: ~1h30–2h ao vivo.
> Ao final: login, cadastro, sidebar e proteção de rota funcionando de ponta a ponta **no navegador**.

---

## O que já temos, vindo da Parte 1

Backend inteiro pronto e testado via `curl`: banco (schema + pool), domínio (`ICompanyRepository`/`IUserRepository` + implementações Drizzle), Better Auth configurado, `CreateUserWithCompany`, Server Actions `signupAction`/`loginAction` com erros traduzidos, `tenant.ts` (`requireUser`, `requireCompany`, `redirectIfAuthenticated`) e `src/proxy.ts` protegendo rotas por presença de cookie. Esta parte não toca em nenhum desses arquivos — só importa.

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_UI-Paginas-Auth.md` | Root layout, layout de auth, páginas e formulários de login/cadastro |
| `2_Layout-Protegido-e-Sidebar.md` | Layout protegido, sidebar (shadcn/ui), página inicial |
| `3_Verificacao-e-Armadilhas.md` | Teste de ponta a ponta no navegador, checklist final da Aula 1, próximos passos |

## O que é construído nesta parte

| Arquivo | Propósito |
|---|---|
| `src/app/layout.tsx` | Root layout do Next.js |
| `src/app/globals.css` | Design tokens (indigo de marca + escala de camadas) e ligação `--font-sans` → `--font-geist-sans` |
| `src/app/(auth)/layout.tsx` | Layout público centralizado (painel de marca + formulário) |
| `src/app/(auth)/login/page.tsx` + `_components/LoginForm.tsx` | Tela de login |
| `src/app/(auth)/register/page.tsx` + `_components/RegisterForm.tsx` | Tela de cadastro |
| `src/app/(protected)/layout.tsx` | Layout protegido: `SidebarProvider` + `AppSidebar` + `SidebarInset` |
| `src/app/(protected)/prospeccao/page.tsx` | Página inicial protegida: header + empty-state (Fase 2 substitui pelo dashboard real) |
| `src/components/layout/Sidebar.tsx` | `AppSidebar` — construída sobre o bloco `sidebar` do shadcn/ui |
| `src/components/ui/sidebar.tsx` (+ `separator`, `sheet`, `skeleton`, `tooltip`) | Bloco `sidebar` do shadcn/ui e suas dependências internas |
| `src/hooks/use-mobile.ts` | Hook usado pelo `sidebar` para detectar viewport mobile |

---

## Conceito que você precisa entender antes de codar

### Grupos de rotas no Next.js App Router: `(auth)` e `(protected)`

Parênteses no nome de uma pasta criam um **grupo de rotas** — a pasta existe na estrutura de arquivos, mas não aparece na URL:

```
app/
├── (auth)/
│   ├── login/page.tsx     → URL: /login
│   └── register/page.tsx  → URL: /register
└── (protected)/
    └── prospeccao/page.tsx → URL: /prospeccao
```

**Por que usar isso?** Pra ter **layouts diferentes sem afetar as URLs**:
- `(auth)/layout.tsx` → tela centralizada, sem sidebar, sem verificação de sessão
- `(protected)/layout.tsx` → com sidebar, chama `requireUser()`

Sem grupos de rota, tudo cairia num único layout com lógica condicional (`if (isAuthPage) {...}`) espalhada — os grupos resolvem isso de graça, só pela estrutura de pastas.
