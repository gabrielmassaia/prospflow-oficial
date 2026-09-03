import type { CampaignStatus } from "@/domain/repositories/ICampaignRepository";
import type { LeadStatus } from "@/domain/repositories/ILeadRepository";

// ── Lead status ─────────────────────────────────────────────────────────────

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
