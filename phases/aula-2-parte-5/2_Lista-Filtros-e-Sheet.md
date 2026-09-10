# Aula 2 · Parte 5 — 2. Lista, Filtros e Sheet de Detalhe

> Parte de `aula-2-parte-5`. Pré-requisito: `1_Mapa-e-Pagina.md`. Próximo arquivo: `3_Verificacao-e-Armadilhas.md`.

---

### Passo 3 — `LeadsContent`

O componente mais longo do projeto — mas cada pedaço é simples isoladamente: estado de filtros, uma `useMemo` que filtra, uma tabela paginada, um mapa alternativo, e um `Sheet` (painel lateral) com as ações de IA e mudança de status. Nenhuma dessas partes depende de Server Action pra ler dado — só pra escrever (mudar status) ou gerar conteúdo (diagnóstico, mensagem).

**Duas correções em relação à documentação original**, pegas durante a validação desta parte — os dois `Select` de status (o filtro no topo e o "Alterar status" dentro do sheet) precisam de um `SelectValue` com children explícitos, senão mostram o valor bruto (`"all"`, `"qualified"`) em vez do label em português. O `Select` de campanha (Parte 3, `CampanhasContent.tsx`) já tinha esse cuidado — os dois de status abaixo já saem certos.

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Camera, Globe, List, Loader2, Map, MessageCircle, Phone, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Lead, LeadStatus } from "@/domain/repositories/ILeadRepository";
import { generateDiagnosisAction } from "@/app/actions/leads/generate-diagnosis";
import { generateMessageAction } from "@/app/actions/leads/generate-message";
import { updateLeadStatusAction } from "@/app/actions/leads/update-lead-status";
import { LEAD_STATUS_CLASSES, LEAD_STATUS_LABEL, scoreBg } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const LeadsMap = dynamic(() => import("@/components/LeadsMap"), { ssr: false });

const PER_PAGE = 15;

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "qualified",
  "not_qualified",
  "whatsapp_opened",
  "message_sent",
  "responded",
  "lost",
  "do_not_contact",
];

// selo pequeno pra cada sinal de presença digital (website/instagram/whatsapp) —
// mesmo componente reaproveitado 3x no sheet, só muda active/icon/label
function Signal({ active, icon: Icon, label }: { active: boolean; icon: React.ElementType; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
        active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

interface LeadsContentProps {
  initialLeads: Lead[];
  initialCampaigns: Campaign[];
}

export function LeadsContent({ initialLeads, initialCampaigns }: LeadsContentProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [campaigns] = useState<Campaign[]>(initialCampaigns);
  const [view, setView] = useState<"list" | "map">("list");
  const [campaignId, setCampaignId] = useState("all");
  const [status, setStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [onlyWa, setOnlyWa] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Lead | undefined>(undefined);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");

  // recalcula só quando algum filtro (ou a lista) muda — não a cada render
  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        if (campaignId !== "all" && l.campaignId !== campaignId) return false;
        if (status !== "all" && l.status !== status) return false;
        if (l.score < minScore) return false;
        if (onlyWa && !l.hasWhatsapp) return false;
        return true;
      }),
    [leads, campaignId, status, minScore, onlyWa]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageLeads = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // helper único pra atualizar um lead tanto na lista quanto no sheet aberto —
  // evita repetir a mesma lógica de merge nos 3 handlers abaixo
  function updateLead(id: string, patch: Partial<Lead>) {
    setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSelected((curr) => (curr?.id === id ? ({ ...curr, ...patch } as Lead) : curr));
  }

  async function handleDiagnosis() {
    if (!selected) return;
    setGeneratingAI(true);
    const result = await generateDiagnosisAction(selected.id);
    setGeneratingAI(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    updateLead(selected.id, { aiOverview: result.data.aiOverview, suggestedOffer: result.data.suggestedOffer });
    toast.success("Diagnóstico gerado");
  }

  async function handleMessage() {
    if (!selected) return;
    setGeneratingMsg(true);
    const result = await generateMessageAction(selected.id);
    setGeneratingMsg(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setGeneratedMessage(result.message);
  }

  function openWhatsApp() {
    if (!selected?.phoneNormalized || !generatedMessage) return;
    const url = `https://wa.me/${selected.phoneNormalized}?text=${encodeURIComponent(generatedMessage)}`;
    window.open(url, "_blank");
    // abrir o WhatsApp é, por si só, um sinal de que o lead foi abordado —
    // só promove o status se ele ainda estava "frio" (new/qualified); se já
    // passou disso (ex: responded), não regride o status sozinho
    if (selected.status === "new" || selected.status === "qualified") {
      updateLeadStatusAction(selected.id, "whatsapp_opened")
        .then((r) => {
          if (r.ok) updateLead(selected.id, { status: "whatsapp_opened" });
        })
        .catch(() => toast.error("Não foi possível atualizar o status do lead"));
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            <List className="mr-1.5 h-4 w-4" /> Lista
          </Button>
          <Button variant={view === "map" ? "default" : "outline"} size="sm" onClick={() => setView("map")}>
            <Map className="mr-1.5 h-4 w-4" /> Mapa
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-xs">Campanha</Label>
          <Select
            value={campaignId}
            onValueChange={(v) => {
              if (v) {
                setCampaignId(v);
                setPage(1); // qualquer mudança de filtro volta pra página 1 — evita "página 3 vazia" depois de filtrar
              }
            }}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue>{campaignId === "all" ? "Todas" : (campaigns.find((c) => c.id === campaignId)?.name ?? campaignId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              if (v) {
                setStatus(v);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="h-8 w-44">
              {/* children explícitos — sem isso, o trigger mostra "all" ou
                  "qualified" cru em vez de "Todos"/"Qualificado" (ver nota acima) */}
              <SelectValue>{status === "all" ? "Todos" : LEAD_STATUS_LABEL[status as LeadStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 space-y-1.5">
          <Label className="text-xs">Score mínimo: {minScore}</Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[minScore]}
            onValueChange={(vals: number | readonly number[]) => {
              const v = Array.isArray(vals) ? vals[0] : vals;
              setMinScore(v ?? 0);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="only-wa"
            checked={onlyWa}
            onCheckedChange={(v) => {
              setOnlyWa(!!v);
              setPage(1);
            }}
          />
          <Label htmlFor="only-wa" className="cursor-pointer text-xs">
            Só com WhatsApp
          </Label>
        </div>
      </div>

      {view === "map" ? (
        {/* flex-1 — o mapa estica pra preencher o espaço vertical restante da
            tela (até onde o layout permitir), em vez de uma altura fixa em px */}
        <div className="flex min-h-[560px] flex-1 overflow-hidden rounded-xl border border-border/60 shadow-sm">
          <LeadsMap leads={filtered} onSelect={(lead) => setSelected(lead)} height="100%" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Sinais</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum lead corresponde aos filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  pageLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelected(lead);
                        setGeneratedMessage(""); // sheet sempre abre sem mensagem "herdada" do lead anterior
                      }}
                    >
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.city}, {lead.state}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBg(lead.score)}`}>
                          {lead.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {lead.hasWebsite && <Globe className="h-3.5 w-3.5 text-blue-500" />}
                          {lead.hasInstagram && <Camera className="h-3.5 w-3.5 text-pink-500" />}
                          {lead.hasWhatsapp && <MessageCircle className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={LEAD_STATUS_CLASSES[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <SheetContent className="w-full max-w-md overflow-y-auto px-6">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selected.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selected.address}</p>
              </SheetHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${scoreBg(selected.score)}`}>
                    Score {selected.score}
                  </span>
                  <Badge className={LEAD_STATUS_CLASSES[selected.status]}>{LEAD_STATUS_LABEL[selected.status]}</Badge>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Presença digital</p>
                  <div className="flex flex-wrap gap-2">
                    <Signal active={selected.hasWebsite} icon={Globe} label="Website" />
                    {/* ícone Camera representando Instagram (lucide não tem um ícone
                        de marca próprio aqui) — o label é "Instagram", não "Camera" */}
                    <Signal active={selected.hasInstagram} icon={Camera} label="Instagram" />
                    <Signal active={selected.hasWhatsapp} icon={MessageCircle} label="WhatsApp" />
                  </div>
                </div>

                {selected.phone && (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Contato</p>
                    <p className="flex items-center gap-1.5 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {selected.phone}
                    </p>
                  </div>
                )}

                {selected.rating && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>{selected.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({selected.reviewCount} avaliações)</span>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Diagnóstico IA</p>
                    <Button size="sm" variant="outline" onClick={handleDiagnosis} disabled={generatingAI}>
                      {generatingAI ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      Gerar
                    </Button>
                  </div>
                  {selected.aiOverview ? (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">{selected.aiOverview}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum diagnóstico gerado ainda</p>
                  )}
                  {selected.suggestedOffer && <p className="mt-2 text-xs text-muted-foreground">💡 {selected.suggestedOffer}</p>}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mensagem WhatsApp</p>
                    <Button size="sm" variant="outline" onClick={handleMessage} disabled={generatingMsg}>
                      {generatingMsg ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      Gerar
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)} // editável — a IA gera um rascunho, não é obrigado a usar como veio
                    placeholder="Clique em 'Gerar' para criar uma mensagem personalizada..."
                    className="text-sm"
                  />
                  {selected.phoneNormalized && generatedMessage && (
                    <Button className="mt-3 w-full" onClick={openWhatsApp}>
                      <MessageCircle className="mr-1.5 h-4 w-4" /> Abrir WhatsApp
                    </Button>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Alterar status</p>
                  <Select
                    value={selected.status}
                    onValueChange={async (v) => {
                      if (!v) return;
                      const result = await updateLeadStatusAction(selected.id, v as LeadStatus);
                      if (result.ok) updateLead(selected.id, { status: v as LeadStatus });
                    }}
                  >
                    <SelectTrigger>
                      {/* mesmo cuidado do filtro de status acima — children
                          explícitos, senão mostra "qualified" cru */}
                      <SelectValue>{LEAD_STATUS_LABEL[selected.status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEAD_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

Salve como `src/app/(protected)/prospeccao/leads/_components/LeadsContent.tsx`.

---

### Passo 4 — Item "Leads" na sidebar

Último item de navegação do módulo de prospecção.

```tsx
import { Crosshair, LogOut, Map, Tag, Target, Users } from "lucide-react";

// ...

const navItems = [
  { href: "/prospeccao", label: "Prospecção", icon: Target, exact: true },
  { href: "/prospeccao/nichos", label: "Nichos", icon: Tag, exact: false },
  { href: "/prospeccao/campanhas", label: "Campanhas", icon: Map, exact: false },
  { href: "/prospeccao/leads", label: "Leads", icon: Users, exact: false },
];
```
