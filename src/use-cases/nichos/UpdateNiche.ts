import type { CreateNicheData, INicheRepository, Niche } from "@/domain/repositories/INicheRepository";

type Input = { id: string; companyId: string; data: Partial<CreateNicheData> };
type Result = { ok: true; data: Niche } | { ok: false; error: string };

export class UpdateNiche {
  constructor(private nicheRepo: INicheRepository) {}

  async execute({ id, companyId, data }: Input): Promise<Result> {
    try {
      const existing = await this.nicheRepo.findById(id, companyId);
      if (!existing) return { ok: false, error: "Nicho não encontrado" };
      const niche = await this.nicheRepo.update(id, companyId, data);
      return { ok: true, data: niche };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar nicho" };
    }
  }
}
