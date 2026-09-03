import type { IAIService } from "@/domain/services/IAIService";

interface CloudflareResponse {
  result?: { response?: string };
  success: boolean;
  errors?: { message: string }[];
}

export class CloudflareAIService implements IAIService {
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const model = process.env.CLOUDFLARE_AI_MODEL ?? "@cf/meta/llama-3.1-70b-instruct";
    const token = process.env.CLOUDFLARE_AI_TOKEN;

    if (!accountId || !token) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_AI_TOKEN são obrigatórios");
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Cloudflare AI error: ${res.status}`);

    const data: CloudflareResponse = await res.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message ?? "Cloudflare AI retornou erro");
    }

    return data.result?.response ?? "";
  }
}
