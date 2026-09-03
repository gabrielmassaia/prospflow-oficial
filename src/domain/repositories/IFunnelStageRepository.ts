export type StageKind = "normal" | "won" | "lost" | "triage";

export interface FunnelStage {
  id: string;
  companyId: string;
  name: string;
  position: number;
  colorHex: string;
  kind: StageKind;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateFunnelStageData = Omit<FunnelStage, "id" | "createdAt" | "updatedAt">;

export interface IFunnelStageRepository {
  findAllByCompany(companyId: string): Promise<FunnelStage[]>;
  findById(id: string, companyId: string): Promise<FunnelStage | null>;
  countByCompany(companyId: string): Promise<number>;
  bulkCreate(stages: CreateFunnelStageData[]): Promise<FunnelStage[]>;
  update(id: string, companyId: string, data: Partial<CreateFunnelStageData>): Promise<FunnelStage>;
}
