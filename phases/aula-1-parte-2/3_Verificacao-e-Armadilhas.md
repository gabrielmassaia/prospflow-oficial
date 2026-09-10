# Aula 1 · Parte 2 — 3. Verificação, Armadilhas e Próximos Passos

> Parte de `aula-1-parte-2`. Pré-requisito: `2_Layout-Protegido-e-Sidebar.md`. Fecha a Aula 1 inteira — próxima pasta: `aula-2/`.

---

### Passo 9 — Testar no navegador, de ponta a ponta

```bash
npm run dev
```

Acesse `http://localhost:3000` — deve cair direto em `/login` (proxy da Parte 1 barrando por falta de cookie). Fluxo completo pra testar manualmente:

1. `/register` → preencha nome, empresa, email, senha → **Criar conta grátis**
2. Deve redirecionar pra `/prospeccao` já logado, mostrando "Olá, `<seu nome>`. Bem-vindo de volta à `<sua empresa>`."
3. Clique em **Sair** no rodapé da sidebar → volta pra `/login`
4. Faça login de novo com as mesmas credenciais → volta pra `/prospeccao`
5. Tente `/login` com a sessão ativa → redireciona automaticamente pra `/prospeccao` (`redirectIfAuthenticated`)
6. Em uma aba anônima (sem sessão), acesse `/prospeccao` direto pela URL → redireciona pra `/login`

Este roteiro foi validado ponta a ponta com um usuário real antes de fechar a Aula 1 — inclusive o caso de senha errada e email duplicado (armadilhas 3 e 4 abaixo).

---

## Verificação — como saber que funcionou

- [ ] `/register` carrega o formulário sem erros no console
- [ ] Submeter o formulário cria o usuário e redireciona pra `/prospeccao` já autenticado
- [ ] A sidebar mostra as iniciais corretas, nome e empresa no rodapé
- [ ] `/login` com as credenciais criadas funciona e redireciona pra `/prospeccao`
- [ ] `/login` com senha errada mostra **"Email ou senha inválidos"** (em português)
- [ ] `/register` com um email já cadastrado mostra **"Já existe uma conta com este email"**
- [ ] Logout funciona e volta pra `/login`
- [ ] Acessar `/prospeccao` numa aba anônima (sem cookie) redireciona pra `/login`
- [ ] Acessar `/login` já autenticado redireciona pra `/prospeccao`
- [ ] O texto renderiza em Geist Sans (confira com `getComputedStyle(document.body).fontFamily` no console), e o indigo de marca aparece no botão de submit, no ícone ativo do menu e no painel esquerdo do `(auth)/layout.tsx`

---

## Armadilhas e problemas comuns

### Armadilha 0 — `redirect()` causa erro "NEXT_REDIRECT" nos logs

**Sintoma:** `Error: NEXT_REDIRECT` aparece no console do servidor.
**Causa:** não é um erro real — o Next.js implementa `redirect()` lançando uma exceção internamente, e ela precisa "escapar" até o framework capturar.
**Solução:** nunca coloque `requireUser()` ou `requireCompany()` dentro de um `try/catch` num Server Component — o catch engole a exceção do redirect e ele para de funcionar.

### Armadilha 1 — Sidebar não aparece / erro de módulo não encontrado

**Sintoma:** `Module not found: Can't resolve '@/components/ui/sidebar'` ou similar para `separator`/`sheet`/`skeleton`/`tooltip`.
**Causa:** o bloco `sidebar` do shadcn não instalou completo — se o comando `npx shadcn@latest add sidebar` falhar por timeout de rede, ele pode não escrever todos os arquivos de dependência.
**Solução:** confira se `src/components/ui/` tem os 5 arquivos (`sidebar`, `separator`, `sheet`, `skeleton`, `tooltip`) e se `src/hooks/use-mobile.ts` existe. Rode o comando de novo, ou copie os arquivos manualmente de um projeto que já os tenha.

### Armadilha 2 — O avatar da sidebar parece mostrar a letra errada

**Sintoma:** no canto inferior esquerdo, aparece uma letra que não bate com as iniciais do usuário.
**Causa:** não é bug — é o botão flutuante **"Open Next.js Dev Tools"** do próprio Next.js (modo dev), que fica fixado exatamente no canto inferior esquerdo da viewport e visualmente se sobrepõe ao avatar da sidebar nessa posição.
**Solução:** nenhuma — confira as iniciais reais inspecionando o elemento (ou clicando no botão de dev tools pra afastá-lo), o `getInitials()` está correto. Esse overlay não existe em produção.

### Armadilha 3 — Erro de login/cadastro aparece em inglês

Ver Armadilha 4 em `aula-1-parte-1/7_Verificacao-e-Armadilhas.md` — a causa e a solução (`translateAuthError`) já foram tratadas na Parte 1, mas é na tela de fato que o sintoma aparece, então vale reconferir aqui se acontecer: qualquer texto de erro em inglês na tela é sinal de que algum lugar está usando `err.message` em vez de passar pelo tradutor.

### Armadilha 4 — A tipografia parece "fina" ou errada, sem erro nenhum no console

**Sintoma:** o texto do site inteiro renderiza com um serif fino (tipo Times New Roman) em vez do Geist Sans esperado — sem nenhum warning, erro ou aviso visível.
**Causa:** `globals.css` define a classe utilitária `font-sans` lendo a variável `--font-sans`, mas o `next/font` (em `app/layout.tsx`) gera a variável com outro nome, `--font-geist-sans`. Se `--font-sans` nunca for explicitamente ligada a `--font-geist-sans` no bloco `@theme`, ela fica vazia — e o browser cai pro fallback serif do sistema **silenciosamente**, sem quebrar nada.
**Solução:** em `globals.css`, dentro de `@theme inline`, garanta `--font-sans: var(--font-geist-sans);`. Pra confirmar qual fonte está de fato sendo aplicada, rode no console do browser: `getComputedStyle(document.body).fontFamily`.

### Armadilha 5 — Grupo de rotas não aparece na URL, mas a pasta "some"

**Sintoma:** ao procurar a pasta `login/` dentro de `app/`, ela não é encontrada.
**Causa:** não sumiu — está dentro de `app/(auth)/login/`. Parênteses no nome da pasta criam um grupo de rotas (ver `0_Conceitos-e-Mapa-de-Arquivos.md`) que organiza arquivos sem aparecer na URL nem no caminho que se espera intuitivamente.
**Solução:** ao procurar uma rota específica, procure pelo nome da pasta final (`login`, `register`, `prospeccao`), não pelo caminho completo da URL.

---

## Commits sugeridos da parte (na branch `aula-1`)

Continuação direta dos commits da Parte 1, mesma branch:

```bash
# 1_UI-Paginas-Auth.md
git add . && git commit -m "feat: telas de login e cadastro"

# 2_Layout-Protegido-e-Sidebar.md
git add . && git commit -m "feat: layout protegido + sidebar + landing"
```

Ao final da Aula 1 (Partes 1 e 2), a branch `aula-1` é a **base** de tudo: a `aula-2` nasce dela (`git switch -c aula-2`), a `aula-3` da `aula-2`, e assim por diante — sempre numa direção, cada fase fazendo `merge` da anterior. Nunca o contrário.

---

## Próximos passos — Fase 2

Na próxima fase (`aula-2/`) construímos o módulo de prospecção completo:

- Dashboard com métricas (cards de nichos, campanhas, leads)
- CRUD de nichos com TagInput e geração por Cloudflare AI
- Lista de campanhas com execução real via Overpass API
- Detalhe de campanha com mapa Leaflet (carregamento lazy)
- Lista de leads com filtros, paginação, mapa e sheet de detalhes
- Diagnóstico e mensagem WhatsApp gerados por Cloudflare AI

Antes de começar a Fase 2, adicione as variáveis Cloudflare no `.env.local`:

```env
CLOUDFLARE_ACCOUNT_ID=seu_account_id
CLOUDFLARE_AI_TOKEN=seu_api_token
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-70b-instruct
```

**Onde pegar:**
- `CLOUDFLARE_ACCOUNT_ID` — [dash.cloudflare.com](https://dash.cloudflare.com) → barra lateral → Account ID
- `CLOUDFLARE_AI_TOKEN` — **My Profile → API Tokens → Create Token → template "Workers AI"**
