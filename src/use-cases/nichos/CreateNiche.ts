import type { CreateNicheData, INicheRepository, Niche } from "@/domain/repositories/INicheRepository";

type Input = Omit<CreateNicheData, "companyId"> & { companyId: string };
type Result = { ok: true; data: Niche } | { ok: false; error: string };

export class CreateNiche {
  constructor(private nicheRepo: INicheRepository) {}

  async execute(input: Input): Promise<Result> {
    try {
      if (!input.name.trim()) return { ok: false, error: "Nome do nicho é obrigatório" };
      const niche = await this.nicheRepo.create(input);
      return { ok: true, data: niche };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar nicho" };
    }
  }
}
