export interface IAIService {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
