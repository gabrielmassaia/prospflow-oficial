export type CampaignStatus = "draft" | "running" | "completed" | "failed";

export interface Campaign {
  id: string;
  companyId: string;
  nicheId: string;
  name: string;
  cep: string | null;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  maxResults: number;
  additionalKeywords: string[];
  status: CampaignStatus;
  totalFound: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateCampaignData = Omit<
  Campaign,
  "id" | "status" | "totalFound" | "lastRunAt" | "createdAt" | "updatedAt"
>;

export interface ICampaignRepository {
  findAllByCompany(companyId: string): Promise<Campaign[]>;
  findById(id: string, companyId: string): Promise<Campaign | null>;
  create(data: CreateCampaignData): Promise<Campaign>;
  updateStatus(id: string, companyId: string, status: CampaignStatus, totalFound?: number): Promise<void>;
}
