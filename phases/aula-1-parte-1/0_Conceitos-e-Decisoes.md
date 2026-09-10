# Aula 1 · Parte 1 — O Motor (Setup, Banco, Domínio e Autenticação)

> **Para a live:** Este é o índice de leitura da Parte 1. Leia por inteiro antes de abrir o editor — os conceitos aqui explicam o "porquê" de tudo que os arquivos numerados (`1_...` a `6_...`) vão construir.
> Tempo estimado: ~2 horas ao vivo.
> Ao final desta parte: banco de dados, cadastro, login e proteção de rota funcionando **sem nenhuma interface gráfica** — tudo testável via `curl` ou Postman. A Parte 2 (`aula-1-parte-2/`) constrói as telas em cima disso.

---

## Por que dividir a Aula 1 em duas partes?

A Aula 1 original tentava caber setup + banco + domínio + auth + proxy + telas + sidebar em ~2h. Não cabe — e a plateia perde o fio quando o ritmo acelera demais. A divisão segue uma fronteira natural do próprio Next.js: tudo que roda **sem navegador** (schema, repositórios, use case, Server Actions, proxy) numa parte; tudo que **é tela** (formulários, layout, sidebar) na outra. Cada metade tem começo, meio e fim — dá pra parar depois da Parte 1 e o backend já está 100% funcional e testável.

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Setup-Projeto-e-Dependencias.md` | Criação do projeto Next.js, dependências, shadcn/ui, variáveis de ambiente, Drizzle Kit |
| `2_Banco-de-Dados.md` | Pool de conexão + schema da Fase 1 |
| `3_Dominio-e-Repositorios.md` | Interfaces (`IUserRepository`, `ICompanyRepository`) + implementações Drizzle |
| `4_Autenticacao-Better-Auth.md` | Use case `CreateUserWithCompany`, configuração do Better Auth, helpers de tenant, route handler |
| `5_Actions-Login-e-Cadastro.md` | Server Actions `signup` e `login`, mensagens de erro traduzidas |
| `6_Proxy-Protecao-de-Rotas.md` | `src/proxy.ts` |
| `7_Verificacao-e-Armadilhas.md` | Aplicar schema no banco, testar via curl, checklist, armadilhas comuns |

---

## O que foi construído nesta parte

| Arquivo | Propósito |
|---|---|
| `drizzle.config.ts` | Configura o Drizzle Kit (onde está o schema, qual banco, onde gerar migrations) |
| `.env.example` | Template das variáveis de ambiente necessárias |
| `src/infrastructure/db/index.ts` | Pool de conexão PostgreSQL singleton + instância Drizzle tipada |
| `src/infrastructure/db/schema.ts` | Todas as tabelas da Fase 1 (4 do Better Auth + companies + company_members) |
| `src/domain/repositories/IUserRepository.ts` | Contrato de repositório de usuário |
| `src/domain/repositories/ICompanyRepository.ts` | Contrato de repositório de empresa |
| `src/infrastructure/repositories/DrizzleCompanyRepository.ts` | Implementação concreta com Drizzle |
| `src/infrastructure/repositories/DrizzleUserRepository.ts` | Implementação concreta com Drizzle (ainda sem consumidor — usado na Fase 4) |
| `src/use-cases/auth/CreateUserWithCompany.ts` | Lógica de negócio: criar usuário + empresa em transação |
| `src/lib/auth.ts` | Instância central do Better Auth (servidor) |
| `src/lib/auth-client.ts` | Cliente React do Better Auth (browser) |
| `src/lib/auth-errors.ts` | Tradução dos códigos de erro do Better Auth (a lib responde em inglês) |
| `src/lib/tenant.ts` | `requireUser()`, `requireCompany()` e `redirectIfAuthenticated()` |
| `src/app/api/auth/[...all]/route.ts` | Handler universal de autenticação |
| `src/app/actions/auth/signup.ts` | Server Action de cadastro (controller) |
| `src/app/actions/auth/login.ts` | Server Action de login (controller) |
| `src/proxy.ts` | Proteção de rotas — redireciona não-autenticados para `/login` |
| `.prettierrc` | Config do Prettier + plugin de ordenação de classes Tailwind |
| `.vscode/settings.json` | Format-on-save apontando pro Prettier |

A Parte 2 usa tudo isso por baixo dos panos, mas não reescreve nada daqui — só consome via `import`.

---

## Conceitos que você precisa entender antes de codar

### 1. O que é Drizzle ORM e por que não usamos Prisma

**Drizzle** é um ORM TypeScript que representa o schema do banco como código TypeScript — não como um arquivo `.prisma` separado. Os tipos das suas queries são inferidos diretamente das definições de tabela, sem geração de código intermediário.

Por que não Prisma? Ele gera um cliente em `node_modules/.prisma/client` — isso cria problemas no Edge Runtime do Next.js e exige um passo extra de geração toda vez que o schema muda. O Drizzle funciona direto, sem geração, e tem suporte nativo ao `pg` pool que o Neon precisa.

```typescript
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

// Totalmente tipado, sem geração de código — o tipo de `user` é inferido
// da definição da tabela acima: { id: string, name: string, email: string } | undefined
const user = await db.query.usersTable.findFirst({
  where: eq(usersTable.email, "joao@email.com"),
});
```

---

### 2. Por que Pool de conexão e não conexão direta

O Neon é PostgreSQL serverless. Cada requisição ao Next.js pode rodar numa função serverless nova. Se cada função abrisse uma conexão e não a encerrasse, em segundos teríamos centenas de conexões abertas — o banco recusa novas conexões e a aplicação cai.

O **Pool** mantém um conjunto fixo de conexões abertas (`max: 5` no nosso caso) e as reutiliza entre requisições. Quando uma requisição termina, a conexão volta pro pool — não é fechada.

O detalhe que costuma pegar todo mundo de surpresa: em desenvolvimento, o Next.js recarrega módulos a cada save (hot-reload). Sem guardar o pool em `globalThis`, cada save recriaria um pool novo sem encerrar o anterior — você vê isso acontecer no arquivo `2_Banco-de-Dados.md`.

---

### 3. O que é Better Auth e como funciona o fluxo

**Better Auth** é uma biblioteca de autenticação que roda 100% no servidor. Ela gerencia criação/validação de usuários (email + senha com bcrypt), sessões com tokens em cookies HTTP-only, e expõe rotas de API para todas as operações.

```
Usuário → Server Action loginAction() chama auth.api.signInEmail(...)
         ↓
Better Auth valida email + senha no banco
         ↓
Cria registro em `sessions` + devolve Set-Cookie na resposta
         ↓
Plugin nextCookies() intercepta e aplica o cookie via next/headers
         ↓
Sessão já está ativa quando a Server Action retorna
```

O cookie é HTTP-only — JavaScript do browser não consegue lê-lo, o que impede XSS de roubar a sessão. Repare que **não existe client SDK nesse fluxo**: login e cadastro são Server Actions puras (ver `5_Actions-Login-e-Cadastro.md`) — o `authClient` só aparece na Parte 2, para o logout.

---

### 4. O que é Clean Architecture e como aplicamos aqui

Clean Architecture organiza o código para que **regras de negócio não dependam de frameworks**. Na prática, três camadas com uma regra de dependência de mão única — de fora pra dentro, nunca o contrário:

**Domínio** (`src/domain/`) define contratos (interfaces). Não sabe que Drizzle existe:
```typescript
export interface ICompanyRepository {
  create(data: { name: string; slug: string; ownerId: string }): Promise<Company>;
  findByUserId(userId: string): Promise<Company | null>;
}
```

**Infraestrutura** (`src/infrastructure/`) implementa os contratos com ferramentas reais:
```typescript
export class DrizzleCompanyRepository implements ICompanyRepository {
  constructor(private db: DrizzleDB) {} // recebe o db de fora — nunca importa direto

  async create(data) {
    return await this.db.transaction(async (tx) => { /* ... */ });
  }
}
```

**Use Cases** (`src/use-cases/`) orquestram a regra de negócio. Recebem interfaces, nunca sabem que Drizzle existe:
```typescript
export class CreateUserWithCompany {
  constructor(private companyRepo: ICompanyRepository) {} // interface, não Drizzle
  async execute(input: Input) { /* orquestra a lógica */ }
}
```

**Por que isso importa na prática:** se amanhã o Neon vira PlanetScale, só `DrizzleCompanyRepository` muda. O use case, as actions e os componentes React continuam idênticos — eles nunca "viram" o Drizzle diretamente.

---

### 5. Server Actions vs Route Handlers no Next.js 16

**Server Actions** são funções `"use server"` chamadas diretamente de componentes React ou formulários, sem precisar declarar uma rota HTTP. **Route Handlers** (`route.ts`) criam endpoints HTTP convencionais.

Usamos Server Actions para toda operação de negócio (criar empresa, mais tarde mover lead no funil) e Route Handler só para o Better Auth (`[...all]/route.ts`), porque a lib precisa de endpoints HTTP reais para o seu próprio protocolo interno — não porque é "melhor", é o que a biblioteca exige.

---

### 6. O que é Multi-tenancy e como implementamos

Multi-tenancy significa que um único sistema atende múltiplos clientes (tenants) isolados. No ProspFlow, cada **empresa** é um tenant — o risco, sem isolamento, é um usuário da empresa A ver dados da empresa B.

```typescript
// SEGURO — toda query de negócio filtra pelo tenant
.where(eq(prospectingNichesTable.companyId, companyId))

// INSEGURO — vaza dados entre tenants
await db.select().from(prospectingNichesTable); // ❌ sem where
```

`requireCompany(userId)`, em `tenant.ts`, extrai o `companyId` da sessão ativa. Toda action de negócio (a partir da Fase 2) começa chamando `requireUser()` → `requireCompany()`.

---

## Decisões técnicas e justificativas

### Por que `id` do usuário é `text` e não `uuid`?

**Decisão:** a tabela `users` usa `text` como tipo de PK, não `uuid`.

**Motivo:** o Better Auth gera IDs próprios em formato string — ele precisa controlar esse formato para garantir unicidade entre providers OAuth e email/senha. Forçar `uuid` quebra a inserção do adapter.

**Impacto em cascata:** toda tabela que referencia `users.id` (como `company_members.user_id`) também precisa ser `text`, nunca `uuid` — é um detalhe fácil de esquecer quando se cria uma tabela nova mais adiante no projeto.

### Por que `db.transaction()` na criação de empresa?

Sem transação: criar a empresa pode ter sucesso e criar o `company_member` pode falhar por constraint — a empresa fica órfã, sem dono, no banco. Com transação, se qualquer etapa falhar, as duas são revertidas (rollback automático) e o banco nunca fica num estado intermediário inconsistente. O código exato está em `3_Dominio-e-Repositorios.md`.

### Por que o repositório recebe `db` no construtor em vez de importar direto?

Importar `db` globalmente dentro do repositório acopla a classe à implementação concreta do banco — não dá pra trocar por um `db` de teste. Recebendo `db` no construtor (injeção de dependência), a action decide qual `db` passar: o real em produção, um mock em teste. O repositório nunca sabe a diferença.
