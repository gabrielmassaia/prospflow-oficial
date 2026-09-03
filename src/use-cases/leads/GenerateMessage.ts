import type { IAIService } from "@/domain/services/IAIService";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

type Input = { leadId: string; companyId: string };
type Result = { ok: true; message: string } | { ok: false; error: string };

const SYSTEM_PROMPT = `Você é especialista em copy para prospecção via WhatsApp.
Gere uma mensagem de abordagem com no máximo 300 caracteres.
Use o template como base, personalize com os dados do lead.
Responda APENAS com o texto da mensagem, sem aspas ou formatação.`;

export class GenerateMessage {
  constructor(
    private leadRepo: ILeadRepository,
    private nicheRepo: INicheRepository,
    private aiService: IAIService
  ) {}

  async execute({ leadId, companyId }: Input): Promise<Result> {
    const lead = await this.leadRepo.findById(leadId, companyId);
    if (!lead) return { ok: false, error: "Lead não encontrado" };

    const niche = await this.nicheRepo.findById(lead.nicheId, companyId);

    const userPrompt = `Template do nicho: ${niche?.baseMessageTemplate ?? "Olá, {nome}! Vi que vocês estão em {cidade}."}
Lead: ${lead.name} | Cidade: ${lead.city}
Diagnóstico: ${lead.aiOverview ?? "Sem diagnóstico"}`;

    try {
      const message = await this.aiService.complete(SYSTEM_PROMPT, userPrompt);
      return { ok: true, message: message.trim().slice(0, 300) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao gerar mensagem" };
    }
  }
}
