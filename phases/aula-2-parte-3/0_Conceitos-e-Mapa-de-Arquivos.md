# Aula 2 · Parte 3 — Campanhas: Lista, Formulário e Mapa

> **Para a live:** Índice de leitura da Parte 3. Pré-requisito: `aula-2-parte-2/` completa e testada.
> Tempo estimado: ~2 horas ao vivo.
> Ao final: criar uma campanha (com CEP resolvido automaticamente), executá-la e ver os leads encontrados num mapa Leaflet — a primeira tela com mapa do projeto.

---

## Roteiro desta pasta

| Arquivo | O que constrói |
|---|---|
| `1_Lista-e-Formulario.md` | `format.ts`, lista de campanhas com polling, formulário de criação com resolução de CEP |
| `2_Detalhe-e-Mapa.md` | Página de detalhe (métricas + parâmetros), `CampaignMap.tsx` |
| `3_Verificacao-e-Armadilhas.md` | Teste completo no navegador, checklist, armadilhas |

---

## Conceito que você precisa entender antes de codar

### Por que Leaflet precisa de `dynamic(..., { ssr: false })`

Leaflet manipula o DOM diretamente (`document.createElement`, cria um mapa dentro de uma `<div>`) — ele espera um `window` e um `document` reais. No Server Component, o React renderiza no servidor primeiro (SSR), onde não existe nada disso. Importar `CampaignMap` normalmente quebraria a build com `ReferenceError: window is not defined`.

```tsx
import dynamic from "next/dynamic";

// ssr: false — o Next.js nunca tenta renderizar este componente no servidor,
// só no navegador, depois que a página já carregou
const CampaignMap = dynamic(() => import("@/components/CampaignMap"), { ssr: false });
```

**Por que `require("leaflet")` dentro do `useEffect`, em vez de `import` no topo do arquivo?** Mesmo com `ssr: false` no `dynamic()`, um `import` estático no topo do arquivo ainda é avaliado assim que o *módulo* carrega — o `require()` dentro do `useEffect` garante que o Leaflet só é lido quando o componente já está montado no navegador, nunca antes. O CSS (`import "leaflet/dist/leaflet.css"`) é a exceção: esse import fica estático no topo porque o Turbopack precisa dele ali para processar o CSS corretamente — CSS não tem o mesmo problema de `window`/`document` que o JavaScript do Leaflet tem.

### Popup do mapa: DOM em vez de HTML string

```tsx
// ERRADO — se lead.name viesse de um formulário livre (não é o caso aqui,
// vem do Overpass, mas é o hábito que importa), isso seria uma porta pra XSS
L.marker(...).bindPopup(`<strong>${lead.name}</strong><br>Score: ${lead.score}`);

// CORRETO — cria os nós via DOM, define o texto via textContent (nunca
// interpretado como HTML) — sem depender de que lead.name esteja "limpo"
const popup = document.createElement("div");
const nameEl = document.createElement("strong");
nameEl.textContent = lead.name;
popup.append(nameEl, document.createElement("br"), document.createTextNode(`Score: ${lead.score}`));
L.marker(...).bindPopup(popup);
```

---

## Mapa de arquivos desta parte

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/format.ts` | Criar | Labels/cores de status (campanha e lead) + helpers de score |
| `src/app/(protected)/prospeccao/campanhas/page.tsx` | Criar | Server Component thin + Data Loader |
| `src/app/(protected)/prospeccao/campanhas/_components/CampanhasContent.tsx` | Criar | Lista, criação, execução, polling |
| `src/app/(protected)/prospeccao/campanhas/[id]/page.tsx` | Criar | Server Component thin do detalhe |
| `src/app/(protected)/prospeccao/campanhas/[id]/_components/CampanhaDetailContent.tsx` | Criar | Métricas, parâmetros, mapa, polling |
| `src/components/CampaignMap.tsx` | Criar | Mapa Leaflet client-only |
| `src/components/layout/Sidebar.tsx` | Modificar | Adiciona item "Campanhas" na nav |

`format.ts` estava documentado desde a Aula 2 original junto com o schema, mas só entra agora: é a primeira vez que `CampaignStatus` é de fato consumido por uma tela (as entradas de `LeadStatus` ficam sem uso até `aula-2-parte-5/`, mas nascem no mesmo arquivo — a mesma exceção ao YAGNI já usada outras vezes: é um arquivo pequeno e estável, não vale a pena fatiar sua criação em duas partes diferentes).
