export interface Niche {
  id: string;
  companyId: string;
  name: string;
  description: string;
  keywords: string[];
  targetServices: string[];
  commonPains: string[];
  baseMessageTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateNicheData = Omit<Niche, "id" | "createdAt" | "updatedAt">;

export interface INicheRepository {
  findAllByCompany(companyId: string): Promise<Niche[]>;
  findById(id: string, companyId: string): Promise<Niche | null>;
  create(data: CreateNicheData): Promise<Niche>;
  update(id: string, companyId: string, data: Partial<CreateNicheData>): Promise<Niche>;
  delete(id: string, companyId: string): Promise<void>;
}
