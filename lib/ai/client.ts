import { streamText, generateText } from 'ai';
import { DEFAULT_MODEL, AI_CONFIG } from './config';
import { PROMPT_TEMPLATES, type PromptType } from './prompts';
import type { IAIResponse } from './types';

export class AIClient {
  private static async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries = AI_CONFIG.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), AI_CONFIG.timeout)
          ),
        ]);
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Max retries exceeded');
  }

  static async generate(
    type: PromptType,
    userInput: string,
    context?: string
  ): Promise<IAIResponse> {
    const template = PROMPT_TEMPLATES[type];
    const prompt = template.user(userInput, context);

    return this.executeWithRetry(async () => {
      const result = await generateText({
        model: DEFAULT_MODEL,
        system: template.system,
        prompt,
        temperature: AI_CONFIG.defaultTemperature,
        maxTokens: AI_CONFIG.maxTokens,
      });

      return {
        text: result.text,
        tokens: result.usage?.totalTokens || 0,
        cost: this.calculateCost(result.usage?.totalTokens || 0),
      };
    });
  }

  static async generateStream(
    type: PromptType,
    userInput: string,
    context?: string
  ) {
    const template = PROMPT_TEMPLATES[type];
    const prompt = template.user(userInput, context);

    return streamText({
      model: DEFAULT_MODEL,
      system: template.system,
      prompt,
      temperature: AI_CONFIG.defaultTemperature,
      maxTokens: AI_CONFIG.maxTokens,
    });
  }

  private static calculateCost(tokens: number): number {
    const costPer1kTokens = 0.03;
    return (tokens / 1000) * costPer1kTokens;
  }
}
