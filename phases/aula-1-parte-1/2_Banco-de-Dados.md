# Aula 1 · Parte 1 — 2. Banco de Dados

> Parte de `aula-1-parte-1`. Pré-requisito: `1_Setup-Projeto-e-Dependencias.md`. Próximo arquivo: `3_Dominio-e-Repositorios.md`.

---

### Passo 6 — Pool de conexão e instância Drizzle

O problema que este arquivo resolve: Neon é serverless, então **nunca** dá pra abrir uma conexão nova por requisição sem reaproveitar (ver conceito #2 do `0_Conceitos-e-Decisoes.md`). E em desenvolvimento, o hot-reload do Next.js recarrega este módulo a cada save — sem guardar o pool em `globalThis`, cada save vazaria uma conexão nova.

Crie `src/infrastructure/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Declara a propriedade no escopo global do Node para o TypeScript aceitar
// `global.__drizzlePool` — sem isso o compilador reclama que a propriedade
// não existe em `typeof globalThis`
declare global {
  var __drizzlePool: Pool | undefined;
}

let connectionString = process.env.DATABASE_URL!;

// O Neon usa um proxy SSL específico; sem "uselibpqcompat=true" o
// node-postgres pode falhar com erro de certificado. Adiciona só se
// ainda não estiver na URL, pra não duplicar se alguém já colocou manualmente
if (!connectionString.includes("uselibpqcompat")) {
  connectionString += connectionString.includes("?") ? "&" : "?";
  connectionString += "uselibpqcompat=true";
}

// Se já existe um pool (sobrou de um hot-reload anterior), reusa —
// só cria um novo na primeira vez que este módulo roda
const pool =
  global.__drizzlePool ??
  new Pool({
    connectionString,
    max: 5, // Neon free tier aguenta ~10 conexões simultâneas; 5 dá margem
    idleTimeoutMillis: 30_000,
  });

if (!global.__drizzlePool) {
  global.__drizzlePool = pool;
}

export const db = drizzle(pool, { schema });
```

**Por que não existe um tipo `DrizzleDB` exportado daqui?** Cada repositório (ver `3_Dominio-e-Repositorios.md`) declara localmente `type DB = NodePgDatabase<typeof schema>`. Parece repetição, mas evita acoplar a assinatura de todo repositório do projeto a um único ponto de export — se esse tipo central mudasse de nome ou local, seria um refactor em cascata.

---

### Passo 7 — Schema do banco (Fase 1)

Duas famílias de tabela aqui, com uma diferença de tipo de PK que importa (ver decisão em `0_Conceitos-e-Decisoes.md`): as 4 tabelas do Better Auth usam `id: text`, as tabelas de negócio usam `id: uuid`.

Crie `src/infrastructure/db/schema.ts`:

```typescript
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Better Auth — 4 tabelas obrigatórias ──────────────────────────────────
// Os nomes de campo e tipos aqui não são escolha nossa: são o contrato que
// o adapter do Better Auth espera encontrar (ver 4_Autenticacao-Better-Auth.md)

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // text, não uuid — o Better Auth gera o próprio formato de ID
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id") // text — referencia usersTable.id, que também é text
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }), // apaga sessões se o user for apagado
});

export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(), // ex: "credential" (email/senha) ou "google", "github" no futuro
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // hash bcrypt, só preenchido pro provider "credential"
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTable = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Multi-tenant ───────────────────────────────────────────────────────────
// Daqui pra baixo é modelagem nossa, não exigência de biblioteca — por isso
// PK em uuid, o padrão do projeto pra tabelas de negócio

export const companiesTable = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // usado em URLs/identificação amigável, único no sistema
  ownerId: text("owner_id") // text, não uuid — referencia usersTable.id
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()), // atualiza sozinho em qualquer UPDATE, sem precisar setar manualmente
});

export const companyRoleEnum = pgEnum("company_role", ["owner", "member"]);

export const companyMembersTable = pgTable(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    userId: text("user_id") // text pelo mesmo motivo de ownerId acima
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: companyRoleEnum("role").default("owner").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // um mesmo usuário não pode ser membro duas vezes da mesma empresa
    companyUserUnique: uniqueIndex("company_members_company_user_unique").on(
      t.companyId,
      t.userId
    ),
    // toda query de negócio filtra por companyId (ver conceito #6) — index aqui
    // é o que mantém essas queries rápidas conforme a tabela cresce
    companyIdIdx: index("company_members_company_id_idx").on(t.companyId),
  })
);
```

O segundo parâmetro de `pgTable()` — a função `(t) => ({...})` — é onde entram indexes e constraints que envolvem mais de uma coluna. Constraints de coluna única (como `.unique()` em `slug`) ficam na própria definição da coluna; constraints que combinam colunas (como o par `companyId` + `userId`) só podem ser expressas aqui.
