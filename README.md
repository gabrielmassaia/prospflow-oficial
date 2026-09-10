# ProspFlow

Prospecção ativa e gestão comercial para agências: gera leads reais a partir de nichos de mercado e endereços/raio geográfico, qualifica com IA e leva o lead até o fechamento em um funil de vendas (CRM) estilo Kanban.

> Projeto desenvolvido como material de estudo (curso fullstackclub), evoluindo aula a aula. A stack e a arquitetura, porém, são as de um SaaS real — multi-tenant, com Clean Architecture e integrações externas de geolocalização e IA.

## Índice

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack técnica](#stack-técnica)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)

## Visão geral

O ProspFlow tem dois módulos que se conectam:

1. **Prospecção** — a partir de um *nicho* (segmento de mercado, ex.: "clínicas odontológicas"), o usuário cria uma *campanha* informando um endereço/CEP e um raio em km. O sistema busca estabelecimentos reais nesse raio via **OpenStreetMap (Overpass API)**, usa **IA** para decidir quais tags OSM são relevantes para o nicho, e gera uma lista de *leads* com score de qualificação, diagnóstico de presença digital (site, Instagram, WhatsApp) e sugestão de abordagem.
2. **Funil / CRM** — um quadro Kanban com as etapas do funil de vendas da empresa. Leads qualificados na prospecção podem ser convertidos em leads do CRM (ou criados manualmente), movidos entre etapas por drag-and-drop, com histórico de atividades por lead.

A aplicação é **multi-tenant por empresa**: cada usuário pertence a uma empresa (criada automaticamente no cadastro) e todos os dados — nichos, campanhas, leads, funil — são isolados por `companyId`.

## Funcionalidades

- Cadastro e login (Better Auth), com criação automática da empresa e seed das etapas padrão do funil.
- Dashboard com métricas: nichos ativos, campanhas concluídas, leads prospectados/qualificados e campanhas recentes.
- CRUD de **nichos** (keywords, serviços-alvo, dores comuns, template de mensagem base).
- Criação de **campanhas** de prospecção geolocalizada, com resolução de endereço a partir de CEP (ViaCEP + Nominatim) e acompanhamento em tempo quase real da execução.
- Busca de estabelecimentos via Overpass API + seleção de tags relevantes por IA, com **mapa interativo** (Leaflet) das campanhas e dos leads encontrados.
- Ações de IA por lead: diagnóstico do negócio e geração de mensagem de abordagem personalizada.
- Conversão de lead de prospecção em lead de CRM, com histórico de origem.
- **Funil Kanban** (drag-and-drop) com etapas configuráveis, movimentação de leads e timeline de atividades.

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React Compiler habilitado) |
| Linguagem | TypeScript |
| UI | React 19 + [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4 |
| Banco de dados | PostgreSQL ([Neon](https://neon.tech), serverless) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit (migrations) |
| Autenticação | [Better Auth](https://www.better-auth.com) (email/senha, sessão validada no servidor) |
| Drag and drop | [dnd-kit](https://dndkit.com) (quadro Kanban do funil) |
| Mapas | Leaflet / react-leaflet |
| Geolocalização | Overpass API (OpenStreetMap), ViaCEP, Nominatim |
| IA | Cloudflare Workers AI |
| Validação | Zod |

## Arquitetura

O código em `src/` segue uma separação em camadas inspirada em Clean Architecture:

```
app/actions  →  use-cases  →  domain (interfaces)
                                 ↑
                          infrastructure (implementações)
```

- **`domain/`** — contratos puros (`I*Repository`, `I*Service`) e regras de negócio sem dependência de infraestrutura (ex.: threshold de qualificação de lead).
- **`infrastructure/`** — implementações concretas: repositórios Drizzle (Postgres) e serviços externos (IA da Cloudflare, geolocalização via Overpass).
- **`use-cases/`** — regras de aplicação por domínio (ex.: `CreateCampaign`, `RunCampaign`, `MoveLead`, `ConvertProspectingLead`), recebendo as dependências (repositórios/serviços) por injeção no construtor.
- **`app/actions/`** — Server Actions finas (`"use server"`) que validam autenticação/tenant e delegam ao use-case correspondente. Use-cases e actions retornam `{ ok: true, data }` / `{ ok: false, error }` em vez de lançar exceção para erros de negócio esperados.
- **`app/(protected)/...`** — páginas e componentes de apresentação (Server + Client Components), protegidas por sessão.

Outros pontos relevantes:

- **`src/proxy.ts`** — proteção de rotas na raiz da aplicação (convenção do Next.js 16). Diferente de uma checagem ingênua de cookie, ele chama `auth.api.getSession()` no servidor para validar a sessão de verdade antes de liberar o acesso às rotas protegidas.
- **`src/lib/tenant.ts`** — helpers `requireUser()`/`requireCompany()` usados nos layouts/Server Components para garantir sessão + empresa vinculada.
- **Fallback gracioso de IA** — campanhas não travam em "em execução" caso as credenciais da Cloudflare não estejam configuradas; a busca de estabelecimentos continua funcionando sem o enriquecimento por IA.

## Modelo de dados

Principais tabelas (Drizzle, `src/infrastructure/db/schema.ts`):

- **Auth**: `users`, `sessions`, `accounts`, `verifications` (padrão Better Auth).
- **Tenant**: `companies`, `company_members` (papel `owner`/`member`).
- **Prospecção**: `prospecting_niches` (nichos) → `prospecting_campaigns` (campanhas) → `prospecting_leads` (leads encontrados, com score e status).
- **Funil/CRM**: `funnel_stages` (etapas configuráveis por empresa) → `crm_leads` (opcionalmente originado de um `prospecting_leads`) → `lead_activities` (histórico de movimentação entre etapas).

Todas as tabelas de negócio têm `companyId` indexado, garantindo o isolamento multi-tenant.

## Estrutura de pastas

```
src/
├── app/
│   ├── (auth)/            # login, register — rotas públicas
│   ├── (protected)/       # funil, prospeccao — exigem sessão + empresa
│   ├── actions/           # Server Actions por domínio
│   └── api/auth/[...all]/ # route handler do Better Auth
├── components/             # componentes de UI (shadcn) e específicos (mapas, sidebar)
├── domain/                 # interfaces de repositórios/serviços e regras de negócio
├── infrastructure/         # implementações Drizzle e serviços externos (IA, geo)
├── use-cases/               # regras de aplicação, por domínio
├── lib/                     # auth, tenant, formatação, utils
└── proxy.ts                 # proteção de rotas (Next.js 16)
```

## Como rodar localmente

Pré-requisitos: Node.js 20+, uma conta [Neon](https://neon.tech) (ou outro Postgres) e, opcionalmente, uma conta Cloudflare para as features de IA.

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env.local
# preencha DATABASE_URL, BETTER_AUTH_URL e BETTER_AUTH_SECRET
# (gere o secret com: npx @better-auth/cli secret)

# 3. aplicar o schema no banco
npx drizzle-kit push

# 4. rodar em desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`, crie uma conta em `/register` (isso já cria sua empresa e semeia as etapas do funil) e comece a criar nichos e campanhas.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string do PostgreSQL (Neon). |
| `BETTER_AUTH_URL` | sim | URL base da aplicação (ex.: `http://localhost:3000` em dev). |
| `BETTER_AUTH_SECRET` | sim | Segredo usado pelo Better Auth para assinar sessões (`npx @better-auth/cli secret`). |
| `CLOUDFLARE_ACCOUNT_ID` | não* | ID da conta Cloudflare, para as features de IA (seleção de tags OSM, diagnóstico e geração de mensagem). |
| `CLOUDFLARE_AI_TOKEN` | não* | Token da Cloudflare Workers AI. |
| `CLOUDFLARE_AI_MODEL` | não | Modelo a usar (default: `@cf/meta/llama-3.1-70b-instruct`). |

\* Sem as credenciais da Cloudflare, a busca de estabelecimentos nas campanhas continua funcionando (sem enriquecimento por IA), mas diagnóstico e geração de mensagem por IA ficam indisponíveis.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento em `http://localhost:3000`. |
| `npm run build` | Build de produção. |
| `npm start` | Sobe o build de produção. |
| `npm run lint` | Roda o ESLint. |
| `npx drizzle-kit push` | Aplica o schema atual direto no banco (uso em dev). |
| `npx drizzle-kit generate` + `npx drizzle-kit migrate` | Gera e aplica migrations versionadas. |

A pasta `scripts/` contém scripts de validação manual (`manual-test-campanha.ts`, `manual-test-leads.ts`) usados durante o desenvolvimento para testar os fluxos de prospecção/leads fora da UI — não fazem parte da suíte de testes automatizada.
