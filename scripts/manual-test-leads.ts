// Script de validação manual — NÃO faz parte dos entregáveis documentados.
import { db } from "../src/infrastructure/db";
import { DrizzleLeadRepository } from "../src/infrastructure/repositories/DrizzleLeadRepository";
import { DrizzleNicheRepository } from "../src/infrastructure/repositories/DrizzleNicheRepository";
import { DrizzleCampaignRepository } from "../src/infrastructure/repositories/DrizzleCampaignRepository";
import { CloudflareAIService } from "../src/infrastructure/services/CloudflareAIService";
import { UpdateLeadStatus } from "../src/use-cases/leads/UpdateLeadStatus";
import { GenerateDiagnosis } from "../src/use-cases/leads/GenerateDiagnosis";
import { GenerateMessage } from "../src/use-cases/leads/GenerateMessage";

async function main() {
  const nicheRepo = new DrizzleNicheRepository(db);
  const campaignRepo = new DrizzleCampaignRepository(db);
  const leadRepo = new DrizzleLeadRepository(db);

  const companies = await db.query.companiesTable.findMany({ limit: 1 });
  const companyId = companies[0].id;

  const niches = await nicheRepo.findAllByCompany(companyId);
  const niche = niches[0];
  const campaigns = await campaignRepo.findAllByCompany(companyId);
  const campaign = campaigns[0];

  console.log(`[test] usando nicho ${niche.name}, campanha ${campaign.id}`);

  // Sem lead real disponível (campanhas de teste voltaram com 0 resultados) —
  // cria um lead de teste direto pra validar os use-cases
  const [lead] = await leadRepo.bulkCreate([
    {
      companyId,
      campaignId: campaign.id,
      nicheId: niche.id,
      source: "manual-test",
      name: "Restaurante Teste Ltda",
      phone: "11999999999",
      phoneNormalized: "5511999999999",
      email: null,
      websiteUrl: "https://example.com",
      address: "Rua Teste, 123",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5613,
      longitude: -46.6565,
      score: 85,
      status: "new",
      whatsappStatus: "probable",
      hasWebsite: true,
      hasInstagram: false,
      hasWhatsapp: true,
      rating: 4.5,
      reviewCount: 32,
      aiOverview: null,
      suggestedOffer: null,
    },
  ]);
  console.log(`[test] lead criado: ${lead.id}`);

  // 1. UpdateLeadStatus — não depende de IA, deve funcionar sempre
  const statusResult = await new UpdateLeadStatus(leadRepo).execute({
    leadId: lead.id,
    companyId,
    status: "qualified",
  });
  console.log("[test] UpdateLeadStatus:", statusResult.ok ? `ok, status=${statusResult.data.status}` : statusResult.error);

  // 2. GenerateDiagnosis — depende de IA real; sem credenciais, esperado falhar
  //    com mensagem legível (sem fallback, diferente de RunCampaign)
  const aiService = new CloudflareAIService();
  const diagnosisResult = await new GenerateDiagnosis(leadRepo, nicheRepo, aiService).execute({
    leadId: lead.id,
    companyId,
  });
  console.log("[test] GenerateDiagnosis:", diagnosisResult.ok ? "ok" : diagnosisResult.error);

  // 3. GenerateMessage — mesma dependência de IA
  const messageResult = await new GenerateMessage(leadRepo, nicheRepo, aiService).execute({
    leadId: lead.id,
    companyId,
  });
  console.log("[test] GenerateMessage:", messageResult.ok ? messageResult.message : messageResult.error);
}

main();
