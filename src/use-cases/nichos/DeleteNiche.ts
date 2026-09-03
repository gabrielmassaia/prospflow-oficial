import type { INicheRepository } from "@/domain/repositories/INicheRepository";

type Input = { id: string; companyId: string };
type Result = { ok: true } | { ok: false; error: string };

export class DeleteNiche {
  constructor(private nicheRepo: INicheRepository) {}

  async execute({ id, companyId }: Input): Promise<Result> {
    try {
      const existing = await this.nicheRepo.findById(id, companyId);
      if (!existing) return { ok: false, error: "Nicho não encontrado" };
      if (existing.isActive) return { ok: false, error: "Desative o nicho antes de excluir" };
      await this.nicheRepo.delete(id, companyId);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao excluir nicho" };
    }
  }
}
