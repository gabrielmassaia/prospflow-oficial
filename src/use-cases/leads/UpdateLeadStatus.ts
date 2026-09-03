import type { ILeadRepository, Lead, LeadStatus } from "@/domain/repositories/ILeadRepository";

type Input = { leadId: string; companyId: string; status: LeadStatus };
type Result = { ok: true; data: Lead } | { ok: false; error: string };

export class UpdateLeadStatus {
  constructor(private leadRepo: ILeadRepository) {}

  async execute({ leadId, companyId, status }: Input): Promise<Result> {
    try {
      const existing = await this.leadRepo.findById(leadId, companyId);
      if (!existing) return { ok: false, error: "Lead não encontrado" };
      const lead = await this.leadRepo.update(leadId, companyId, { status });
      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar lead" };
    }
  }
}
