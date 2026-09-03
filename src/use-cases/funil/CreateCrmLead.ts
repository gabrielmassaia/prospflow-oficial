import type { CreateCrmLeadData, CrmLead, ICrmLeadRepository } from "@/domain/repositories/ICrmLeadRepository";
import type { ILeadActivityRepository } from "@/domain/repositories/ILeadActivityRepository";

type Input = CreateCrmLeadData & { createdBy: string };
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class CreateCrmLead {
  constructor(
    private crmLeadRepo: ICrmLeadRepository,
    private leadActivityRepo: ILeadActivityRepository
  ) {}

  async execute(input: Input): Promise<Result> {
    try {
      if (!input.name.trim()) return { ok: false, error: "Nome do lead é obrigatório" };

      const { createdBy, ...data } = input;
      const lead = await this.crmLeadRepo.create(data);

      await this.leadActivityRepo.create({
        companyId: lead.companyId,
        leadId: lead.id,
        fromStageId: null,
        toStageId: lead.stageId,
        description: "Lead criado manualmente",
        createdBy,
      });

      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar lead" };
    }
  }
}
