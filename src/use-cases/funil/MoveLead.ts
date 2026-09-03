import type { CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";

type Input = {
  leadId: string;
  companyId: string;
  toStageId: string;
  toStageName: string;
  fromStageName: string;
  userId: string;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class MoveLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadActivityRepo: ILeadActivityRepository
  ) {}

  async execute(input: Input): Promise<Result> {
    try {
      const lead = await this.crmLeadRepo.findById(input.leadId, input.companyId);
      if (!lead) return { ok: false, error: "Lead não encontrado" };

      if (lead.stageId === input.toStageId) return { ok: true, data: lead };

      const updated = await this.crmLeadRepo.updateStage(
        input.leadId,
        input.companyId,
        input.toStageId
      );

      await this.leadActivityRepo.create({
        companyId: input.companyId,
        leadId: input.leadId,
        fromStageId: lead.stageId,
        toStageId: input.toStageId,
        description: `Lead movido de ${input.fromStageName} para ${input.toStageName}`,
        createdBy: input.userId,
      });

      return { ok: true, data: updated };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao mover lead" };
    }
  }
}
