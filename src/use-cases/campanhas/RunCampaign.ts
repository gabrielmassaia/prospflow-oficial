import type { ICampaignRepository } from "@/domain/repositories/ICampaignRepository";
import type { IAIService } from "@/domain/services/IAIService";
import type { IGeoService, OsmTags } from "@/domain/services/IGeoService";
import type { ILeadRepository } from "@/domain/repositories/ILeadRepository";
import type { INicheRepository } from "@/domain/repositories/INicheRepository";

const OSM_TAG_SYSTEM_PROMPT = `You are an OpenStreetMap (OSM) expert. Given a business niche name and description in Portuguese, return ONLY a valid JSON object with OSM tag values that best represent that type of business. Keys must be exactly: "amenity", "shop", "craft", "tourism", "office", "leisure". Values are arrays of OSM tag values in English. Return ONLY the JSON object, no explanation, no markdown.

Example input: "Niche: Restaurantes e Lanchonetes"
Example output: {"amenity":["restaurant","fast_food","cafe","bar"],"shop":[],"craft":[],"tourism":[],"office":[],"leisure":[]}

Example input: "Niche: Mecânicas e Auto Centers"
Example output: {"amenity":[],"shop":["car_repair","car_parts","tyres"],"craft":["car_repair","panel_beater"],"tourism":[],"office":[],"leisure":[]}

Example input: "Niche: Academias e Crossfit"
Example output: {"amenity":[],"shop":[],"craft":[],"tourism":[],"office":[],"leisure":["fitness_centre","sports_centre","gym"]}

Example input: "Niche: Escritórios de Advocacia"
Example output: {"amenity":[],"shop":[],"craft":[],"tourism":[],"office":["lawyer","legal"],"leisure":[]}

Example input: "Niche: Salões de Beleza e Barbearias"
Example output: {"amenity":["hairdresser","beauty"],"shop":["hairdresser","beauty"],"craft":["hairdresser"],"tourism":[],"office":[],"leisure":[]}`;

type Input = { campaignId: string; companyId: string };
type Result = { ok: true; totalFound: number } | { ok: false; error: string };

function calculateScore(tags: Record<string, string>, phone?: string, website?: string): number {
  let score = 20;
  if (website) score += 20;
  if (phone) score += 15;

  const rating = parseFloat(tags["rating"] ?? "0");
  if (rating >= 4.0) score += 20;
  else if (rating >= 3.0) score += 10;

  const reviews = parseInt(tags["review_count"] ?? "0", 10);
  if (reviews >= 50) score += 15;
  else if (reviews >= 10) score += 5;

  if (tags["contact:instagram"] || tags["instagram"]) score += 10;

  return Math.min(100, score);
}

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\D/g, "");
}

export class RunCampaign {
  constructor(
    private campaignRepo: ICampaignRepository,
    private nicheRepo: INicheRepository,
    private leadRepo: ILeadRepository,
    private geoService: IGeoService,
    private aiService: IAIService
  ) {}

  async execute({ campaignId, companyId }: Input): Promise<Result> {
    const campaign = await this.campaignRepo.findById(campaignId, companyId);
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };

    const niche = await this.nicheRepo.findById(campaign.nicheId, companyId);
    if (!niche) return { ok: false, error: "Nicho não encontrado" };

    try {
      let osmTags: OsmTags | undefined;
      try {
        const nicheContext = niche.description
          ? `Niche: ${niche.name}\nDescription: ${niche.description}`
          : `Niche: ${niche.name}`;
        const raw = await this.aiService.complete(OSM_TAG_SYSTEM_PROMPT, nicheContext);
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as OsmTags;
          const hasAnyTag = Object.values(parsed).some((v) => Array.isArray(v) && v.length > 0);
          if (hasAnyTag) osmTags = parsed;
        }
      } catch (e) {
        console.warn("[RunCampaign] AI tag generation failed, falling back to name-only search", e);
      }

      const nameKeywords = [...niche.keywords, ...campaign.additionalKeywords];

      const results = await this.geoService.search({
        latitude: campaign.latitude,
        longitude: campaign.longitude,
        radiusKm: campaign.radiusKm,
        keywords: nameKeywords,
        osmTags,
        maxResults: campaign.maxResults,
      });

      const leads = results.map((r) => {
        const score = calculateScore(r.tags, r.phone, r.website);
        const hasWebsite = !!r.website;
        const hasInstagram = !!(r.tags["contact:instagram"] || r.tags["instagram"]);
        const hasWhatsapp = !!(r.tags["contact:whatsapp"] || r.tags["phone:whatsapp"]);

        return {
          companyId,
          campaignId,
          nicheId: niche.id,
          source: "overpass" as const,
          name: r.name,
          phone: r.phone ?? null,
          phoneNormalized: normalizePhone(r.phone) ?? null,
          email: null,
          websiteUrl: r.website ?? null,
          address: r.address,
          city: r.city || campaign.city,
          state: r.state || campaign.state,
          latitude: r.latitude,
          longitude: r.longitude,
          score,
          status: "new" as const,
          whatsappStatus: (hasWhatsapp ? "probable" : "unknown") as "probable" | "unknown",
          hasWebsite,
          hasInstagram,
          hasWhatsapp,
          rating: r.tags["rating"] ? parseFloat(r.tags["rating"]) : null,
          reviewCount: r.tags["review_count"] ? parseInt(r.tags["review_count"], 10) : null,
          aiOverview: null,
          suggestedOffer: null,
        };
      });

      await this.leadRepo.bulkCreate(leads);
      await this.campaignRepo.updateStatus(campaignId, companyId, "completed", leads.length);

      return { ok: true, totalFound: leads.length };
    } catch (e) {
      await this.campaignRepo.updateStatus(campaignId, companyId, "failed");
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao executar campanha" };
    }
  }
}
