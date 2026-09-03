import type {
  CreateCrmLeadData,
  CrmLead,
  ICrmLeadRepository,
} from "@/domain/repositories/ICrmLeadRepository";

type Input = {
  id: string;
  companyId: string;
  data: Partial<Omit<CreateCrmLeadData, "stageId" | "companyId" | "origin" | "prospectingLeadId">>;
};
type Result = { ok: true; data: CrmLead } | { ok: false; error: string };

export class UpdateCrmLead {
  constructor(private crmLeadRepo: ICrmLeadRepository) {}

  async execute(input: Input): Promise<Result> {
    try {
      const lead = await this.crmLeadRepo.update(input.id, input.companyId, input.data);
      return { ok: true, data: lead };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar lead" };
    }
  }
}
