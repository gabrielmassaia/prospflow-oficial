// Script de validação manual — NÃO faz parte dos entregáveis documentados.
// Roda CreateCampaign + RunCampaign de ponta a ponta, direto (sem passar pela
// action/sessão), pra provar que a Parte 2 funciona antes de existir qualquer UI.
import { db } from "../src/infrastructure/db";
import { DrizzleCampaignRepository } from "../src/infrastructure/repositories/DrizzleCampaignRepository";
import { DrizzleNicheRepository } from "../src/infrastructure/repositories/DrizzleNicheRepository";
import { DrizzleLeadRepository } from "../src/infrastructure/repositories/DrizzleLeadRepository";
import { OverpassGeoService } from "../src/infrastructure/services/OverpassGeoService";
import { CloudflareAIService } from "../src/infrastructure/services/CloudflareAIService";
import { CreateCampaign } from "../src/use-cases/campanhas/CreateCampaign";
import { RunCampaign } from "../src/use-cases/campanhas/RunCampaign";
import type { IAIService } from "../src/domain/services/IAIService";

async function main() {
  const nicheRepo = new DrizzleNicheRepository(db);
  const campaignRepo = new DrizzleCampaignRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);

  // Reusa a empresa/nicho criados no teste da Parte 1 — pega a primeira empresa se nenhuma for passada
  let companyId = process.argv[2];
  if (!companyId) {
    const companies = await db.query.companiesTable.findMany({ limit: 1 });
    if (companies.length === 0) {
      console.error("[test] nenhuma empresa no banco — rode o cadastro (Aula 1) primeiro");
      process.exit(1);
    }
    companyId = companies[0].id;
  }
  console.log(`[test] usando companyId: ${companyId}`);

  let allNiches = await nicheRepo.findAllByCompany(companyId);
  if (allNiches.length === 0) {
    console.log("[test] nenhum nicho encontrado — criando um de teste");
    await nicheRepo.create({
      companyId,
      name: "Restaurantes (teste)",
      description: "Nicho de teste pra validar RunCampaign",
      keywords: ["restaurante", "pizzaria", "lanchonete"],
      targetServices: [],
      commonPains: [],
      baseMessageTemplate: "",
      isActive: true,
    });
    allNiches = await nicheRepo.findAllByCompany(companyId);
  }
  const niche = allNiches[0];
  console.log(`[test] usando nicho: ${niche.name} (${niche.id})`);

  const createResult = await new CreateCampaign(campaignRepo).execute({
    companyId: niche.companyId,
    nicheId: niche.id,
    name: "Campanha de teste — Av. Paulista",
    cep: null,
    city: "São Paulo",
    state: "SP",
    country: "Brazil",
    latitude: -23.5613,
    longitude: -46.6565,
    radiusKm: 5,
    maxResults: 20,
    additionalKeywords: [],
  });

  if (!createResult.ok) {
    console.error("[test] CreateCampaign falhou:", createResult.error);
    process.exit(1);
  }
  console.log(`[test] campanha criada: ${createResult.data.id}, status=${createResult.data.status}`);

  // sem credenciais Cloudflare reais neste ambiente — simula uma resposta de
  // IA válida (mesmo shape que o prompt real pede) pra exercitar o caminho
  // principal (tags OSM), mais barato pra Overpass que o fallback por nome
  const useRealAI = process.env.CLOUDFLARE_AI_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID;
  let aiService: IAIService;
  if (useRealAI) {
    aiService = new CloudflareAIService();
  } else {
    console.warn("[test] CLOUDFLARE_AI_TOKEN não configurado — usando stub com tags OSM fixas (simula IA respondendo certo)");
    aiService = {
      complete: async () =>
        JSON.stringify({ amenity: ["restaurant", "fast_food", "cafe"], shop: [], craft: [], tourism: [], office: [], leisure: [] }),
    };
  }

  const geoService = new OverpassGeoService();
  const runResult = await new RunCampaign(campaignRepo, nicheRepo, leadRepo, geoService, aiService).execute({
    campaignId: createResult.data.id,
    companyId: niche.companyId,
  });

  console.log("[test] resultado RunCampaign:", runResult);
  process.exit(runResult.ok ? 0 : 1);
}

main();
