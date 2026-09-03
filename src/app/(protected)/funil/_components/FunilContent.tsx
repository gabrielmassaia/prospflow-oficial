"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MessageCircle, Phone, Plus, Search, Target, User } from "lucide-react";
import { toast } from "sonner";

import type { CrmLead } from "@/domain/repositories/ICrmLeadRepository";
import type { FunnelStage } from "@/domain/repositories/IFunnelStageRepository";
import type { LeadActivity } from "@/domain/repositories/ILeadActivityRepository";
import { createCrmLeadAction } from "@/app/actions/funil/create-crm-lead";
import { getLeadActivitiesAction } from "@/app/actions/funil/get-lead-activities";
import { moveLeadAction } from "@/app/actions/funil/move-lead";
import { updateCrmLeadAction } from "@/app/actions/funil/update-crm-lead";
import { formatBRL, STAGE_KIND_BORDER_CLASSES } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type LeadForm = {
  name: string;
  phone: string;
  email: string;
  niche: string;
  subniche: string;
  value: string;
  notes: string;
};

const emptyForm: LeadForm = {
  name: "",
  phone: "",
  email: "",
  niche: "",
  subniche: "",
  value: "",
  notes: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

function LeadCard({ lead }: { lead: CrmLead }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3.5 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        {lead.origin === "prospecting" ? (
          <Target className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
      </div>
      {lead.niche && (
        <Badge variant="secondary" className="mb-1.5 text-[11px]">
          {lead.niche}
        </Badge>
      )}
      {lead.phone && (
        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" /> {lead.phone}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        {lead.value != null ? (
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {formatBRL(lead.value)}
          </span>
        ) : (
          <span />
        )}
        {lead.phone && (
          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function DraggableLeadCard({ lead, onClick }: { lead: CrmLead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${isDragging ? "opacity-30" : ""}`}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
  onSelect,
}: {
  stage: FunnelStage;
  leads: CrmLead[];
  onSelect: (lead: CrmLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = leads.reduce((sum, l) => sum + (l.value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors ${STAGE_KIND_BORDER_CLASSES[stage.kind]} ${
        isOver ? "ring-2 ring-primary/40 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: stage.colorHex }}
          />
          <p className="text-sm font-semibold text-foreground">{stage.name}</p>
          <Badge variant="secondary" className="text-[11px]">
            {leads.length}
          </Badge>
        </div>
      </div>
      {total > 0 && (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          {formatBRL(total)}
        </p>
      )}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} onClick={() => onSelect(lead)} />
        ))}
      </div>
    </div>
  );
}

interface FunilContentProps {
  initialStages: FunnelStage[];
  initialLeads: CrmLead[];
}

export function FunilContent({ initialStages, initialLeads }: FunilContentProps) {
  const [stages] = useState<FunnelStage[]>(
    [...initialStages].sort((a, b) => a.position - b.position)
  );
  const [leads, setLeads] = useState<CrmLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<Record<string, LeadActivity[]>>({});
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.phone ?? "").includes(q)
    );
  }, [leads, search]);

  const leadsByStage = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    stages.forEach((s) => (map[s.id] = []));
    filteredLeads.forEach((l) => {
      if (map[l.stageId]) map[l.stageId].push(l);
    });
    return map;
  }, [stages, filteredLeads]);

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const draggingLead = leads.find((l) => l.id === activeId) ?? null;

  function updateLeadLocal(id: string, patch: Partial<CrmLead>) {
    setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function openDrawer(lead: CrmLead) {
    setSelectedId(lead.id);
    setNotes(lead.notes ?? "");
    setValue(lead.value != null ? String(lead.value) : "");
  }

  async function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const toStageId = String(over.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === toStageId) return;

    const fromStage = stages.find((s) => s.id === lead.stageId);
    const toStage = stages.find((s) => s.id === toStageId);
    if (!toStage) return;

    const previousStageId = lead.stageId;
    updateLeadLocal(leadId, { stageId: toStageId });

    const result = await moveLeadAction({
      leadId,
      toStageId,
      toStageName: toStage.name,
      fromStageName: fromStage?.name ?? "",
    });

    if (!result.ok) {
      updateLeadLocal(leadId, { stageId: previousStageId });
      toast.error(result.error);
      return;
    }

    toast.success(`Lead movido para ${toStage.name}`);
  }

  async function handleAdvance() {
    if (!selected) return;
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === selected.stageId);
    const next = ordered[idx + 1];
    if (!next) return;

    const fromStage = ordered[idx];
    const previousStageId = selected.stageId;
    updateLeadLocal(selected.id, { stageId: next.id });

    const result = await moveLeadAction({
      leadId: selected.id,
      toStageId: next.id,
      toStageName: next.name,
      fromStageName: fromStage?.name ?? "",
    });

    if (!result.ok) {
      updateLeadLocal(selected.id, { stageId: previousStageId });
      toast.error(result.error);
      return;
    }

    toast.success(`Lead avançou para ${next.name}`);
  }

  async function handleSaveDrawer() {
    if (!selected) return;
    const result = await updateCrmLeadAction({
      id: selected.id,
      notes: notes || null,
      value: value.trim() ? Number(value) : null,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    updateLeadLocal(selected.id, result.data);
    toast.success("Lead atualizado");
  }

  async function handleLoadActivities(leadId: string) {
    if (activities[leadId]) return;
    setActivitiesLoading(true);
    const result = await getLeadActivitiesAction(leadId);
    setActivitiesLoading(false);
    if (result.ok) setActivities((prev) => ({ ...prev, [leadId]: result.data }));
  }

  async function handleCreateLead() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const triageStage =
      stages.find((s) => s.kind === "triage") ??
      [...stages].sort((a, b) => a.position - b.position)[0];
    if (!triageStage) return;

    setSaving(true);
    const result = await createCrmLeadAction({
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      niche: form.niche || null,
      subniche: form.subniche || null,
      value: form.value.trim() ? Number(form.value) : null,
      notes: form.notes || null,
      stageId: triageStage.id,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLeads((prev) => [result.data, ...prev]);
    setForm(emptyForm);
    setNewOpen(false);
    toast.success("Lead criado");
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Funil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} no pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-64 pl-8"
            />
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] ?? []}
              onSelect={openDrawer}
            />
          ))}
        </div>
        <DragOverlay>{draggingLead ? <LeadCard lead={draggingLead} /> : null}</DragOverlay>
      </DndContext>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full max-w-md overflow-y-auto px-6">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selected.name}</SheetTitle>
              </SheetHeader>

              <Tabs
                defaultValue="dados"
                onValueChange={(v) => {
                  if (v === "historico") handleLoadActivities(selected.id);
                }}
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-5">
                  <Section title="Classificação">
                    <div className="space-y-1.5">
                      <Row label="Origem">
                        {selected.origin === "prospecting" ? "Prospecção" : "Manual"}
                      </Row>
                      {selected.niche && <Row label="Nicho">{selected.niche}</Row>}
                    </div>
                  </Section>

                  <Section title="Contato">
                    <div className="space-y-1.5">
                      {selected.phone && (
                        <p className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selected.phone}
                        </p>
                      )}
                      {selected.email && (
                        <p className="text-sm text-muted-foreground">{selected.email}</p>
                      )}
                    </div>
                  </Section>

                  <Section title="Valor">
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0,00"
                    />
                  </Section>

                  <Section title="Observações">
                    <Textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anotações sobre o lead..."
                    />
                  </Section>

                  <Button className="w-full" onClick={handleSaveDrawer}>
                    Salvar
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleAdvance}>
                      Avançar etapa
                    </Button>
                    {selected.phone && (
                      <Button
                        className="flex-1"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${selected.phone!.replace(/\D/g, "")}`,
                            "_blank"
                          )
                        }
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="historico">
                  {activitiesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (activities[selected.id]?.length ?? 0) === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma atividade registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...(activities[selected.id] ?? [])].reverse().map((activity) => (
                        <div
                          key={activity.id}
                          className="rounded-lg border border-border/60 bg-muted/40 p-3"
                        >
                          <p className="text-sm text-foreground">{activity.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(activity.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })} ·{" "}
                            {formatDistanceToNow(activity.createdAt, {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Nome *</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-phone">Telefone</Label>
                <Input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-niche">Nicho</Label>
                <Input
                  id="lead-niche"
                  value={form.niche}
                  onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="lead-subniche">Subnicho</Label>
                <Input
                  id="lead-subniche"
                  value={form.subniche}
                  onChange={(e) => setForm((f) => ({ ...f, subniche: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">Valor estimado</Label>
              <Input
                id="lead-value"
                type="number"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Observações</Label>
              <Textarea
                id="lead-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLead} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
