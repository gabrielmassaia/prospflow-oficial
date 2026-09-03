export type CrmLeadOrigin = "manual" | "prospecting";

export interface CrmLead {
  id: string;
  companyId: string;
  prospectingLeadId: string | null;
  stageId: string;
  name: string;
  phone: string | null;
  email: string | null;
  niche: string | null;
  subniche: string | null;
  origin: CrmLeadOrigin;
  value: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateCrmLeadData = Omit<CrmLead, "id" | "createdAt" | "updatedAt">;

export interface ICrmLeadRepository {
  findAllByCompany(companyId: string): Promise<CrmLead[]>;
  findById(id: string, companyId: string): Promise<CrmLead | null>;
  findByProspectingLeadId(prospectingLeadId: string, companyId: string): Promise<CrmLead | null>;
  findConvertedProspectingLeadIds(companyId: string): Promise<string[]>;
  create(data: CreateCrmLeadData): Promise<CrmLead>;
  update(id: string, companyId: string, data: Partial<Omit<CreateCrmLeadData, "stageId">>): Promise<CrmLead>;
  updateStage(id: string, companyId: string, stageId: string): Promise<CrmLead>;
}
