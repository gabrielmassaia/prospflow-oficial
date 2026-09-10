# Aula 2 · Parte 3 — 1. Lista e Formulário de Campanhas

> Parte de `aula-2-parte-3`. Pré-requisito: `0_Conceitos-e-Mapa-de-Arquivos.md`. Próximo arquivo: `2_Detalhe-e-Mapa.md`.

---

### Passo 1 — `format.ts`

```typescript
import type { CampaignStatus } from "@/domain/repositories/ICampaignRepository";
import type { LeadStatus } from "@/domain/repositories/ILeadRepository";

// ── Lead status ─────────────────────────────────────────────────────────────
// Sem consumidor ainda (chega em aula-2-parte-5/) — nasce aqui porque é o
// mesmo arquivo pequeno e estável que os status de campanha, abaixo

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  not_qualified: "Não qualificado",
  whatsapp_opened: "WhatsApp aberto",
  message_sent: "Mensagem enviada",
  responded: "Respondeu",
  lost: "Perdido",
  do_not_contact: "Não contatar",
};

export const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  qualified: "bg-emerald-100 text-emerald-700",
  not_qualified: "bg-red-100 text-red-700",
  whatsapp_opened: "bg-blue-100 text-blue-700",
  message_sent: "bg-violet-100 text-violet-700",
  responded: "bg-amber-100 text-amber-700",
  lost: "bg-slate-100 text-slate-500",
  do_not_contact: "bg-red-50 text-red-400",
};

// ── Campaign status ──────────────────────────────────────────────────────────
// Consumido nesta parte — ver CampanhasContent.tsx e CampanhaDetailContent.tsx

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  running: "Executando",
  completed: "Concluída",
  failed: "Falha",
};

export const CAMPAIGN_STATUS_CLASSES: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

// ── Score ────────────────────────────────────────────────────────────────────
// Consumido em aula-2-parte-5/ (cards de lead) — nasce aqui pelo mesmo motivo

export function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-slate-500";
}

export function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-slate-50 text-slate-600";
}
```

Salve como `src/lib/format.ts`.

---

### Passo 2 — Página de listagem

Mesmo padrão thin-page + Suspense + Data Loader das outras listagens — a única diferença é que o Data Loader busca **dois** recursos em paralelo (campanhas e nichos, este último pra resolver o nome do nicho de cada campanha na tabela).

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { requireCompany, requireUser } from "@/lib/tenant";
import { db } from "@/infrastructure/db";
import { DrizzleCampaignRepository } from "@/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleNicheRepository } from "@/infrastructure/repositories/DrizzleNicheRepository";
import { BasePageLayout } from "@/components/BasePageLayout/BasePageLayout";
import { LoadingContent } from "@/components/shared/loading-content";

import { CampanhasContent } from "./_components/CampanhasContent";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Campanhas" };
}

export default function CampanhasPage() {
  return (
    <BasePageLayout title="Campanhas" description="Buscas georreferenciadas por nicho">
      <Suspense fallback={<LoadingContent title="Carregando campanhas..." withHeader={false} rows={5} />}>
        <CampanhasDataLoader />
      </Suspense>
    </BasePageLayout>
  );
}

async function CampanhasDataLoader() {
  const user = await requireUser();
  const { companyId } = await requireCompany(user.id);

  const campaignRepo = new DrizzleCampaignRepository(db);
  const nicheRepo = new DrizzleNicheRepository(db);

  // Promise.all — as duas queries não dependem uma da outra, rodam em paralelo
  const [campaigns, niches] = await Promise.all([
    campaignRepo.findAllByCompany(companyId),
    nicheRepo.findAllByCompany(companyId),
  ]);

  return <CampanhasContent initialCampaigns={campaigns} initialNiches={niches} />;
}
```

Salve como `src/app/(protected)/prospeccao/campanhas/page.tsx`.

---

### Passo 3 — `CampanhasContent`: tabela, polling e formulário

O componente mais longo do projeto até aqui — tabela de campanhas com polling automático enquanto alguma está `running` (ver `0_Conceitos-e-Mapa-de-Arquivos.md` da Parte 2), e um modal de criação com resolução de CEP em tempo real.

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, MapPin, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Campaign } from "@/domain/repositories/ICampaignRepository";
import type { Niche } from "@/domain/repositories/INicheRepository";
import { createCampaignAction } from "@/app/actions/campanhas/create-campaign";
import { listCampaignsAction } from "@/app/actions/campanhas/list-campaigns";
import { resolveCepAction } from "@/app/actions/campanhas/resolve-cep";
import { runCampaignAction } from "@/app/actions/campanhas/run-campaign";
import { CAMPAIGN_STATUS_CLASSES, CAMPAIGN_STATUS_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CampaignForm = {
  cep: string;
  nicheId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  maxResults: number;
};

const DEFAULT_FORM: CampaignForm = {
  cep: "",
  nicheId: "",
  name: "",
  city: "",
  state: "",
  country: "Brazil",
  latitude: 0,
  longitude: 0,
  radiusKm: 5,
  maxResults: 50,
};

interface CampanhasContentProps {
  initialCampaigns: Campaign[];
  initialNiches: Niche[];
}

export function CampanhasContent({ initialCampaigns, initialNiches }: CampanhasContentProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [niches] = useState<Niche[]>(initialNiches);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // Polling: só ativa enquanto existir campanha "running" — para sozinho
  // quando não há mais nenhuma, sem precisar de um botão pra ligar/desligar
  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === "running");
    if (!hasRunning) return;

    const timer = setInterval(async () => {
      const fresh = await listCampaignsAction();
      setCampaigns((prev) => {
        // compara o estado anterior com o novo pra disparar toast só na
        // transição running → completed/failed, não em todo poll
        for (const c of fresh) {
          const old = prev.find((p) => p.id === c.id);
          if (old?.status === "running" && c.status === "completed") {
            setTimeout(() => toast.success(`${c.totalFound} leads encontrados`), 0);
          } else if (old?.status === "running" && c.status === "failed") {
            setTimeout(() => toast.error("Campanha falhou ao buscar leads"), 0);
          }
        }
        return fresh;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [campaigns]);

  async function fetchCep(digits: string) {
    setCepLoading(true);
    setCepError("");
    const result = await resolveCepAction(digits);
    setCepLoading(false);
    if (!result.ok) {
      setCepError(result.error);
      return;
    }
    const { city, state, latitude, longitude } = result.data;
    setForm((f) => ({ ...f, city, state, latitude, longitude }));
  }

  async function handleCreate() {
    // latitude === 0 como proxy de "CEP ainda não foi resolvido" — 0,0 nunca
    // é uma coordenada real pra uma campanha no Brasil
    if (!form.nicheId || !form.name || !form.cep || !form.city || !form.state || form.latitude === 0) {
      toast.error("Preencha o CEP e aguarde o preenchimento automático");
      return;
    }
    setSaving(true);
    const result = await createCampaignAction({ ...form, additionalKeywords: [] });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCampaigns((prev) => [...prev, result.data]);
    setOpen(false);
    setForm(DEFAULT_FORM);
    toast.success("Campanha criada");
  }

  async function handleRun(campaign: Campaign) {
    setRunning(campaign.id);
    // atualização otimista: marca "running" no estado local antes mesmo da
    // action responder — o polling (acima) assume o resto a partir daqui
    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status: "running" } : c)));
    await runCampaignAction(campaign.id);
    setRunning(null);
  }

  const activeNiches = niches.filter((n) => n.isActive);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)} size="sm" disabled={activeNiches.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <MapPin className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda</p>
          {activeNiches.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Crie um nicho ativo primeiro</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Segmentação</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const niche = niches.find((n) => n.id === c.nicheId);
                const isRunning = running === c.id || c.status === "running";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{niche?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.city}, {c.state} · {c.radiusKm}km
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{c.totalFound}</TableCell>
                    <TableCell>
                      <Badge className={CAMPAIGN_STATUS_CLASSES[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleRun(c)} disabled={isRunning} title="Executar busca">
                          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Link
                          href={`/prospeccao/campanhas/${c.id}`}
                          title="Ver detalhes"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nicho *</Label>
              <Select
                value={form.nicheId}
                onValueChange={(v) => {
                  if (v) setForm((f) => ({ ...f, nicheId: v }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um nicho">
                    {activeNiches.find((n) => n.id === form.nicheId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeNiches.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome da campanha *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Restaurantes - SP Centro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CEP *</Label>
              <div className="flex gap-2">
                <Input
                  value={form.cep.length > 5 ? `${form.cep.slice(0, 5)}-${form.cep.slice(5)}` : form.cep}
                  onChange={(e) => {
                    // só dígitos, no máximo 8 — a máscara "00000-000" é
                    // aplicada só na exibição (linha acima), nunca no estado
                    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setForm((f) => ({ ...f, cep: v }));
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchCep(form.cep)}
                  disabled={form.cep.length !== 8 || cepLoading}
                  className="shrink-0"
                >
                  {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {cepError && <p className="text-xs text-destructive">{cepError}</p>}
              {form.latitude !== 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.city}, {form.state} · {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade *</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="São Paulo" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado *</Label>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                  placeholder="SP"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Raio: {form.radiusKm} km</Label>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[form.radiusKm]}
                onValueChange={(vals: number | readonly number[]) => {
                  const v = Array.isArray(vals) ? vals[0] : vals;
                  setForm((f) => ({ ...f, radiusKm: v ?? f.radiusKm }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máximo de resultados</Label>
              <Select
                value={String(form.maxResults)}
                onValueChange={(v) => {
                  if (v) setForm((f) => ({ ...f, maxResults: parseInt(v, 10) }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Criar campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Salve como `src/app/(protected)/prospeccao/campanhas/_components/CampanhasContent.tsx`.

---

### Passo 4 — Item "Campanhas" na sidebar

```tsx
import { Crosshair, LogOut, Map, Tag, Target } from "lucide-react";

// ...

const navItems = [
  { href: "/prospeccao", label: "Prospecção", icon: Target, exact: true },
  { href: "/prospeccao/nichos", label: "Nichos", icon: Tag, exact: false },
  { href: "/prospeccao/campanhas", label: "Campanhas", icon: Map, exact: false },
];
```
