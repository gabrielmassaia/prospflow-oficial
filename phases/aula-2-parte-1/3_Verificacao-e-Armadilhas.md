# Aula 2 · Parte 1 — 3. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-2-parte-1`. Pré-requisito: `2_Nichos.md`. Fecha a Parte 1 — próxima pasta: `aula-2-parte-2/`.

---

### Passo 12 — Testar no navegador

```bash
npm run dev
```

Com uma sessão já logada (Aula 1), acesse `/prospeccao/nichos`:

1. Clique **Novo nicho** → digite um nome → **Preencher** (confirma que os defaults estáticos preenchem descrição, keywords, serviços, dores e template) → **Salvar**
2. O card aparece na grade, badge **Ativo**, toast de sucesso
3. Clique **Editar** → altere algo → **Salvar** → confirma que o card atualiza sem reload
4. Clique no ícone de energia para desativar → badge vira **Inativo** → o ícone de lixeira aparece (só existe pra nicho inativo)
5. Clique o ícone de lixeira → confirme no alert dialog → o card some da lista, toast de sucesso
6. Recarregue a página inteira (`F5`) — a lista deve refletir exatamente o estado do banco (prova de que a leitura inicial é real, não só estado do React)

---

## Verificação — como saber que funcionou

- [ ] `npx drizzle-kit push` cria 3 tabelas + 3 enums sem erro
- [ ] `/prospeccao/nichos` carrega sem erro no console
- [ ] Criar nicho funciona, incluindo o botão "Preencher"
- [ ] Editar nicho atualiza o card sem reload da página
- [ ] Tentar excluir um nicho **ativo** não é possível (ícone de lixeira nem aparece)
- [ ] Desativar → excluir funciona, some da lista e do banco
- [ ] Item "Nichos" aparece na sidebar e marca como ativo nas subrotas

---

## Armadilhas e problemas comuns

### Armadilha 0 — `TypeError: import_pg_core.sql is not a function`

**Sintoma:** `npx drizzle-kit push` quebra com esse erro apontando pro `schema.ts`.
**Causa:** `sql` foi importado de `"drizzle-orm/pg-core"` junto com os tipos de coluna (`pgTable`, `text`, `uuid`...). Esse pacote não exporta `sql` — quem exporta é o pacote raiz `"drizzle-orm"`.
**Solução:** separar o import — `import { sql } from "drizzle-orm";` numa linha, o resto (`boolean`, `pgTable`, etc.) em `"drizzle-orm/pg-core"` noutra. Ver `1_Fundacao-Dependencias-e-Schema.md`, Passo 2.

### Armadilha 1 — `ReferenceError: Loader2 is not defined`

**Sintoma:** ao clicar **Salvar** no formulário de nicho, a página quebra com esse erro no console.
**Causa:** o botão de salvar usa `<Loader2 className="animate-spin" />` como indicador de carregamento, mas `Loader2` não estava na lista de ícones importados de `lucide-react` no topo do arquivo.
**Solução:** conferir que o import inclui `Loader2`: `import { FileText, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";`.

### Armadilha 2 — Página de Nichos dá 404 mesmo com o arquivo no lugar certo

**Sintoma:** `src/app/(protected)/prospeccao/nichos/page.tsx` existe, mas acessar a rota dá 404.
**Causa:** cache do Next.js (`.next/`) desatualizado — comum depois de mover/renomear pastas de rota (como aconteceu na Aula 1 com o route handler do Better Auth) ou depois de muitas mudanças estruturais numa mesma sessão de dev server.
**Solução:** parar o servidor, apagar a pasta `.next/` e rodar `npm run dev` de novo. Se o 404 persistir, confira se não tem **dois** servidores rodando em portas diferentes (`npm run dev` avisa "Port 3000 is in use... using available port 3001" quando isso acontece) — testar na porta errada mostra a versão antiga do código.

### Armadilha 3 — `Property 'sql' does not exist` ou erro de tipo em `.default(sql\`'{}'\`)`

**Sintoma:** erro de TypeScript nos campos de array (`keywords`, `targetServices`, etc.).
**Causa:** mesma raiz da Armadilha 0 — sem o import correto de `sql`, o TypeScript também não reconhece o template tag.
**Solução:** mesma da Armadilha 0.

---

## Commits sugeridos da parte (na branch `aula-2`)

```bash
git checkout -b aula-2   # nasce da aula-1

# 1_Fundacao-Dependencias-e-Schema.md
git add . && git commit -m "feat: deps da fase 2 + schema (nichos/campanhas/leads) + IA compartilhada + BasePageLayout"

# 2_Nichos.md
git add . && git commit -m "feat: CRUD completo de nichos (domain/infra/use-cases/actions/UI)"
```

---

## Próximos passos — Parte 2

Em `aula-2-parte-2/` começamos Campanhas — a feature mais densa da Aula 2:

- Domínio: `ICampaignRepository` e `IGeoService`
- Infraestrutura: `DrizzleCampaignRepository` e `OverpassGeoService` (busca georreferenciada, sem chave de API)
- Use cases: `CreateCampaign` e `RunCampaign` (orquestra Overpass + regra de score + persiste leads)
- Server Actions de escrita e as duas de leitura via polling (`listCampaignsAction`, `getCampaignDetailAction`)

Essa parte termina **sem UI** — tudo testável chamando as actions diretamente ou via um script — a tela de campanhas fica pra `aula-2-parte-3/`. `src/lib/format.ts` (labels e cores de status) também nasce lá, assim que `CampaignStatus` existe.
