export type LeadStatus =
  | "new"
  | "qualified"
  | "not_qualified"
  | "whatsapp_opened"
  | "message_sent"
  | "responded"
  | "lost"
  | "do_not_contact";

export type WhatsappStatus = "unknown" | "probable" | "confirmed" | "invalid";

export interface Lead {
  id: string;
  companyId: string;
  campaignId: string;
  nicheId: string;
  source: string;
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  websiteUrl: string | null;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  score: number;
  status: LeadStatus;
  whatsappStatus: WhatsappStatus;
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasWhatsapp: boolean;
  rating: number | null;
  reviewCount: number | null;
  aiOverview: string | null;
  suggestedOffer: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CreateLeadData = Omit<Lead, "id" | "createdAt" | "updatedAt">;

export interface LeadFilters {
  campaignId?: string;
  status?: LeadStatus;
  minScore?: number;
  onlyWhatsapp?: boolean;
}

export interface ILeadRepository {
  findByCampaign(campaignId: string, companyId: string): Promise<Lead[]>;
  findAllByCompany(companyId: string, filters?: LeadFilters): Promise<Lead[]>;
  findById(id: string, companyId: string): Promise<Lead | null>;
  bulkCreate(leads: CreateLeadData[]): Promise<Lead[]>;
  update(id: string, companyId: string, data: Partial<Lead>): Promise<Lead>;
  countByCompany(companyId: string): Promise<{ total: number; qualified: number }>;
}
