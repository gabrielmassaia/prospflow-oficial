# Aula 3 · Parte 4 — 1. Botão de Conversão e Sidebar

> Parte de `aula-3-parte-4`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Verificacao-Consolidada.md`.

---

### Passo 1 — `leads/page.tsx`: carregar os ids já convertidos

Adicione `DrizzleCrmLeadRepository` ao Data Loader existente e inclua `findConvertedProspectingLeadIds` no mesmo `Promise.all` que já busca `leads` e `campaigns`:

```diff
 import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
+import { DrizzleCrmLeadRepository } from "@/infrastructure/repositories/DrizzleCrmLeadRepository";
 import { DrizzleLeadRepository } from "@/infrastructure/repositories/DrizzleLeadRepository";
@@
   const leadRepo = new DrizzleLeadRepository(db);
   const campaignRepo = new DrizzleCampaignRepository(db);
+  const crmLeadRepo = new DrizzleCrmLeadRepository(db);

-  const [leads, campaigns] = await Promise.all([
+  const [leads, campaigns, convertedProspectingLeadIds] = await Promise.all([
     leadRepo.findAllByCompany(companyId),
     campaignRepo.findAllByCompany(companyId),
+    crmLeadRepo.findConvertedProspectingLeadIds(companyId),
   ]);

-  return <LeadsContent initialLeads={leads} initialCampaigns={campaigns} />;
+  return (
+    <LeadsContent
+      initialLeads={leads}
+      initialCampaigns={campaigns}
+      initialConvertedProspectingLeadIds={convertedProspectingLeadIds}
+    />
+  );
```

---

### Passo 2 — `LeadsContent.tsx`: estado, handler e botão

Adicione o import da action e o ícone `Kanban`:

```diff
-import { Camera, Globe, List, Loader2, Map, MessageCircle, Phone, Sparkles, Star } from "lucide-react";
+import { Camera, Globe, Kanban, List, Loader2, Map, MessageCircle, Phone, Sparkles, Star } from "lucide-react";
 import { toast } from "sonner";

 import type { Campaign } from "@/domain/repositories/ICampaignRepository";
 import type { Lead, LeadStatus } from "@/domain/repositories/ILeadRepository";
+import { convertProspectingLeadAction } from "@/app/actions/leads/convert-prospecting-lead";
 import { generateDiagnosisAction } from "@/app/actions/leads/generate-diagnosis";
```

Nova prop opcional (com default `[]`, pra não quebrar nenhum outro lugar que eventualmente renderize `LeadsContent` sem ela) e o estado derivado — um `Set`, não um array, porque a checagem `convertedIds.has(selected.id)` roda a cada render do drawer:

```diff
 interface LeadsContentProps {
   initialLeads: Lead[];
   initialCampaigns: Campaign[];
+  initialConvertedProspectingLeadIds?: string[];
 }

-export function LeadsContent({ initialLeads, initialCampaigns }: LeadsContentProps) {
+export function LeadsContent({
+  initialLeads,
+  initialCampaigns,
+  initialConvertedProspectingLeadIds = [],
+}: LeadsContentProps) {
   const [leads, setLeads] = useState<Lead[]>(initialLeads);
   const [campaigns] = useState<Campaign[]>(initialCampaigns);
+  const [convertedIds, setConvertedIds] = useState<Set<string>>(
+    new Set(initialConvertedProspectingLeadIds)
+  );
   const [view, setView] = useState<"list" | "map">("list");
@@
   const [generatedMessage, setGeneratedMessage] = useState("");
+  const [converting, setConverting] = useState(false);
```

O handler segue o mesmo formato de `handleDiagnosis`/`handleMessage`: liga o loading, chama a action, desliga o loading, trata erro com `toast.error`. A diferença é o `toast.success` com **ação** — o segundo argumento de `toast.success` do `sonner` aceita um botão embutido no próprio toast:

```tsx
async function handleConvert() {
  if (!selected) return;
  setConverting(true);
  const result = await convertProspectingLeadAction(selected.id);
  setConverting(false);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  setConvertedIds((prev) => new Set(prev).add(selected.id));
  toast.success("Lead convertido para o CRM", {
    action: { label: "Ver no funil", onClick: () => window.location.assign("/funil") },
  });
}
```

`window.location.assign("/funil")` — não `router.push` — porque o toast é renderizado fora da árvore de componentes da página (num portal do `sonner`), sem acesso direto ao `router` do Next.js sem passar ele como prop adicional; uma navegação de página cheia aqui é uma escolha aceitável, já que o usuário está saindo da tela de Leads mesmo.

No JSX do drawer, logo antes do bloco "Alterar status":

```tsx
<div>
  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Funil comercial
  </p>
  <Button
    variant="outline"
    className="w-full"
    disabled={converting || convertedIds.has(selected.id)}
    onClick={handleConvert}
  >
    {converting ? (
      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
    ) : (
      <Kanban className="mr-1.5 h-4 w-4" />
    )}
    {convertedIds.has(selected.id) ? "Já convertido" : "Converter para CRM"}
  </Button>
</div>
```

O botão fica desabilitado em dois casos ao mesmo tempo — `converting` (uma conversão já em andamento) e `convertedIds.has(selected.id)` (já foi convertido antes, nesta sessão ou em qualquer visita anterior, já que `convertedIds` nasce do banco via `initialConvertedProspectingLeadIds`). Sem essa segunda checagem, nada impediria clicar duas vezes e disparar duas chamadas de `convertProspectingLeadAction` — a segunda falharia com `"Lead já convertido"` (`ConvertProspectingLead`, Parte 2), mas seria uma chamada de rede desperdiçada e um `toast.error` confuso pro usuário, que não fez nada de errado.

---

### Passo 3 — Sidebar: item "Funil"

```diff
-import { BarChart2, Crosshair, LogOut, Map, Tag, Users } from "lucide-react";
+import { BarChart2, Crosshair, Kanban, LogOut, Map, Tag, Users } from "lucide-react";
@@
   { href: "/prospeccao/leads", label: "Leads", icon: Users, exact: false },
+  { href: "/funil", label: "Funil", icon: Kanban, exact: false },
 ];
```

O item vem **depois** de "Leads", não antes — reflete o fluxo conceitual da agência: primeiro prospecta e qualifica (Dashboard → Nichos → Campanhas → Leads), depois trabalha o funil comercial (Funil). A ordem da sidebar não é alfabética nem arbitrária, é a ordem do processo.
