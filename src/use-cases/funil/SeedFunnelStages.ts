import type {
  CreateFunnelStageData,
  FunnelStage,
  IFunnelStageRepository,
} from "@/domain/repositories/IFunnelStageRepository";

type Input = { companyId: string };
type Result = { ok: true; data: FunnelStage[] } | { ok: false; error: string };

const DEFAULT_STAGES: Omit<CreateFunnelStageData, "companyId">[] = [
  { name: "Triagem", position: 0, colorHex: "#94a3b8", kind: "triage", isActive: true },
  { name: "Novo", position: 1, colorHex: "#6366f1", kind: "normal", isActive: true },
  { name: "Contato Iniciado", position: 2, colorHex: "#8b5cf6", kind: "normal", isActive: true },
  { name: "Respondeu", position: 3, colorHex: "#f59e0b", kind: "normal", isActive: true },
  { name: "Reunião Marcada", position: 4, colorHex: "#f97316", kind: "normal", isActive: true },
  { name: "Proposta Enviada", position: 5, colorHex: "#06b6d4", kind: "normal", isActive: true },
  { name: "Fechado", position: 6, colorHex: "#22c55e", kind: "won", isActive: true },
  { name: "Perdido", position: 7, colorHex: "#ef4444", kind: "lost", isActive: true },
];

export class SeedFunnelStages {
  constructor(private stageRepo: IFunnelStageRepository) {}

  async execute(input: Input): Promise<Result> {
    try {
      const existing = await this.stageRepo.countByCompany(input.companyId);
      if (existing > 0) {
        const stages = await this.stageRepo.findAllByCompany(input.companyId);
        return { ok: true, data: stages };
      }

      const stages = await this.stageRepo.bulkCreate(
        DEFAULT_STAGES.map((stage) => ({ ...stage, companyId: input.companyId }))
      );
      return { ok: true, data: stages };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao criar etapas padrão" };
    }
  }
}
