# Aula 1 · Parte 1 — 3. Domínio e Repositórios

> Parte de `aula-1-parte-1`. Pré-requisito: `2_Banco-de-Dados.md`. Próximo arquivo: `4_Autenticacao-Better-Auth.md`.

---

### Passo 8 — Interfaces de domínio

Crie as pastas:

```bash
mkdir -p src/domain/repositories
mkdir -p src/infrastructure/repositories
mkdir -p src/use-cases/auth
mkdir -p src/app/actions/auth
mkdir -p src/app/api/auth/'[...all]'

mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/register
mkdir -p src/app/\(protected\)/prospeccao
mkdir -p src/lib
```

**O que é uma interface de domínio, na prática:** é só um contrato TypeScript — nenhum código, nenhuma implementação, nenhum import de Drizzle. Ela declara "quem quiser ser um repositório de empresa precisa saber fazer isso" e nada mais. Quem implementa (a classe concreta) fica na camada de infraestrutura, um passo abaixo neste mesmo arquivo.

**Por que interfaces tão enxutas?** Nesta fase só precisamos criar e buscar empresa — não vale criar uma interface com 10 métodos que não existem ainda. É YAGNI (*You Ain't Gonna Need It*): a interface cresce conforme os use cases realmente precisam de mais operações, não antes.

Crie `src/domain/repositories/IUserRepository.ts`:

```typescript
export interface IUserRepository {
  findById(id: string): Promise<{ id: string; name: string; email: string } | null>;
}
```

Crie `src/domain/repositories/ICompanyRepository.ts`:

```typescript
export interface ICompanyRepository {
  create(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<{ id: string; name: string; slug: string }>;

  findByUserId(userId: string): Promise<{ id: string; name: string; slug: string } | null>;
}
```

---

### Passo 9 — Implementação dos repositórios (empresa e usuário)

**Por que transação aqui?** Criar a empresa e vincular o dono a ela (`company_members`) são duas escritas que só fazem sentido juntas — se a segunda falhar depois da primeira ter sido gravada, sobra uma empresa sem ninguém dono no banco. `db.transaction()` garante que, se qualquer etapa falhar, as duas são desfeitas (rollback automático) — o banco nunca fica num estado inconsistente no meio do caminho.

Crie `src/infrastructure/repositories/DrizzleCompanyRepository.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { companiesTable, companyMembersTable } from "@/infrastructure/db/schema";
import type { ICompanyRepository } from "@/domain/repositories/ICompanyRepository";
import type * as schema from "@/infrastructure/db/schema";

// declarado aqui, não importado de um lugar central — ver a justificativa
// em 2_Banco-de-Dados.md (Passo 6)
type DB = NodePgDatabase<typeof schema>;

export class DrizzleCompanyRepository implements ICompanyRepository {
  // `db` chega pronto pelo construtor (injeção de dependência) — esta classe
  // nunca importa `db` global, então dá pra testar passando um `db` fake aqui
  constructor(private db: DB) {}

  async create(data: { name: string; slug: string; ownerId: string }) {
    // tudo dentro de tx: se o insert do member falhar, o rollback desfaz
    // o insert da empresa também — nunca fica "órfã"
    return await this.db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companiesTable)
        .values({ name: data.name, slug: data.slug, ownerId: data.ownerId })
        // .returning() com objeto → só os 3 campos que a interface promete
        // devolver, não a linha inteira (evita vazar colunas internas)
        .returning({ id: companiesTable.id, name: companiesTable.name, slug: companiesTable.slug });

      await tx.insert(companyMembersTable).values({
        companyId: company.id,
        userId: data.ownerId,
        role: "owner", // quem cria a empresa é sempre o primeiro "owner"
      });

      return company;
    });
  }

  async findByUserId(userId: string) {
    // join: a pergunta é "qual empresa este usuário pertence", e essa
    // relação mora na tabela de junção company_members, não em companies
    const result = await this.db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        slug: companiesTable.slug,
      })
      .from(companyMembersTable)
      .innerJoin(companiesTable, eq(companyMembersTable.companyId, companiesTable.id))
      .where(eq(companyMembersTable.userId, userId))
      .limit(1);

    // .select() sempre devolve array, mesmo esperando 0 ou 1 linha —
    // pegamos o primeiro item ou null, nunca deixamos undefined vazar
    return result[0] ?? null;
  }
}
```

**Por que `implements ICompanyRepository`?** O TypeScript compara a classe com a interface e recusa compilar se faltar algum método ou a assinatura divergir — é a garantia de que a implementação nunca sai fora do contrato que o use case (Passo 10, próximo arquivo) espera receber.

Crie também `src/infrastructure/repositories/DrizzleUserRepository.ts` — implementação de `IUserRepository` (Passo 8). Ela ainda não é chamada por nenhum use case nesta parte, mas faz parte dos entregáveis obrigatórios da estrutura de pastas (ver `AGENTS.md`) porque a Fase 4 vai precisar de `findById` para o convite de membros por email:

```typescript
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { usersTable } from "@/infrastructure/db/schema";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import type * as schema from "@/infrastructure/db/schema";

type DB = NodePgDatabase<typeof schema>;

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: DB) {}

  async findById(id: string) {
    const result = await this.db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return result[0] ?? null;
  }
}
```

**Por que criar um repositório que ninguém usa ainda?** É a mesma exceção ao YAGNI que abrimos para `IUserRepository` no Passo 8: o contrato (`findById`) é trivial e estável — não vai mudar quando o use case de convite de membros (Fase 4) precisar dele. Diferente de deixar métodos especulativos numa interface grande, aqui é uma implementação completa de um contrato já fechado, só sem consumidor por enquanto.
