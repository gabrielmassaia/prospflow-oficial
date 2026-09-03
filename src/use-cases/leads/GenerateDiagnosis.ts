import type { IAIService } from "@/domain/services/IAIService";
import type { ILeadRepository, Lead } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

type Input = { leadId: string; companyId: string };
type Result = { ok: true; data: Lead } | { ok: false; error: string };

const SYSTEM_PROMPT = `Você é um consultor de marketing digital especialista em prospecção ativa para agências.
Analise o lead e responda APENAS com JSON válido, sem texto extra:
{ "aiOverview": "parágrafo curto sobre o negócio e oportunidade", "suggestedOffer": "oferta em uma linha" }`;

export class GenerateDiagnosis {
  constructor(
    private leadRepo: ILeadRepository,
    private nicheRepo: INicheRepository,
    private aiService: IAIService
  ) {}

  async execute({ leadId, companyId }: Input): Promise<Result> {
    const lead = await this.leadRepo.findById(leadId, companyId);
    if (!lead) return { ok: false, error: "Lead não encontrado" };

    const niche = await this.nicheRepo.findById(lead.nicheId, companyId);

    const userPrompt = `Lead: ${lead.name} | Cidade: ${lead.city} | Nicho: ${niche?.name ?? ""}
Website: ${lead.hasWebsite} | Instagram: ${lead.hasInstagram} | Avaliação: ${lead.rating ?? "N/A"} (${lead.reviewCount ?? 0} avaliações)
Serviços da agência: ${niche?.targetServices.join(", ") ?? ""}
Dores do nicho: ${niche?.commonPains.join(", ") ?? ""}`;

    try {
      const raw = await this.aiService.complete(SYSTEM_PROMPT, userPrompt);
      const json = JSON.parse(raw.trim()) as { aiOverview: string; suggestedOffer: string };

      const updated = await this.leadRepo.update(leadId, companyId, {
        aiOverview: json.aiOverview,
        suggestedOffer: json.suggestedOffer,
      });

      return { ok: true, data: updated };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao gerar diagnóstico" };
    }
  }
}
