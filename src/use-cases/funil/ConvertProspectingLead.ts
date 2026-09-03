import type { CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { IFunnelStageRepository } from "@/domain/repositories/IFunnelStageRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";
import { SeedFunnelStages } from "@/use-cases/funil/SeedFunnelStages";

type Input = {
  prospectingLeadId: string;
  companyId: string;
  userId: string;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class ConvertProspectingLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadRepo: ILeadRepository,
    private leadActivityRepo: ILeadActivityRepository,
    private stageRepo: IFunnelStageRepository,
    private nicheRepo: INicheRepository
  ) {}

  async execute({ prospectingLeadId, companyId, userId }: Input): Promise<Result> {
    try {
      const already = await this.crmLeadRepo.findByProspectingLeadId(prospectingLeadId, companyId);
      if (already) return { ok: false, error: "Lead já convertido" };

      const prospectingLead = await this.leadRepo.findById(prospectingLeadId, companyId);
      if (!prospectingLead) return { ok: false, error: "Lead de prospecção não encontrado" };

      const seed = await new SeedFunnelStages(this.stageRepo).execute({ companyId });
      const stages = seed.ok ? seed.data : await this.stageRepo.findAllByCompany(companyId);
      const targetStage =
        stages.filter((s) => s.kind === "normal").sort((a, b) => a.position - b.position)[0] ??
        stages.slice().sort((a, b) => a.position - b.position)[0];
      if (!targetStage) return { ok: false, error: "Nenhuma etapa de funil disponível" };

      const niche = await this.nicheRepo.findById(prospectingLead.nicheId, companyId);

      const crmLead = await this.crmLeadRepo.create({
        companyId,
        prospectingLeadId: prospectingLead.id,
        stageId: targetStage.id,
        name: prospectingLead.name,
        phone: prospectingLead.phone,
        email: prospectingLead.email,
        niche: niche?.name ?? null,
        subniche: null,
        origin: "prospecting",
        value: null,
        notes: null,
      });

      await this.leadActivityRepo.create({
        companyId,
        leadId: crmLead.id,
        fromStageId: null,
        toStageId: targetStage.id,
        description: "Lead convertido da prospecção",
        createdBy: userId,
      });

      return { ok: true, data: crmLead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao converter lead" };
    }
  }
}
