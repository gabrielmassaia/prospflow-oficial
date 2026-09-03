import type { Campaign, CreateCampaignData, ICampaignRepository } from "@/domain/repositories/ICampaignRepository";

type Result = { ok: true; data: Campaign } | { ok: false; error: string };

export class CreateCampaign {
  constructor(private campaignRepo: ICampaignRepository) {}

  async execute(input: CreateCampaignData): Promise<Result> {
    try {
      if (!input.name.trim()) return { ok: false, error: "Nome da campanha é obrigatório" };
      if (!input.nicheId) return { ok: false, error: "Nicho é obrigatório" };
      const campaign = await this.campaignRepo.create(input);
      return { ok: true, data: campaign };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar campanha" };
    }
  }
}
