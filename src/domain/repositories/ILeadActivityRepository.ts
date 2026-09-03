export interface LeadActivity {
  id: string;
  companyId: string;
  leadId: string;
  fromStageId: string | null;
  toStageId: string | null;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export type CreateLeadActivityData = Omit<LeadActivity, "id" | "createdAt">;

export interface ILeadActivityRepository {
  findByLead(leadId: string, companyId: string): Promise<LeadActivity[]>;
  create(data: CreateLeadActivityData): Promise<LeadActivity>;
}
