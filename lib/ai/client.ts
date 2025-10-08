import { streamText, generateText, type LanguageModel } from 'ai';
import { DEFAULT_MODEL, AI_CONFIG } from './config';
import { getDefaultModel, getModelByProviderAndName } from './dynamic-config';
import { PROMPT_TEMPLATES, type PromptType } from './prompts';
import type { IAIResponse } from './types';
import { logger } from '@/lib/logger/client';

export class AIClient {
  private static replacePlaceholders(
    template: string,
    values: Record<string, string | undefined>
  ): string {
    return template.replace(/%([A-Za-z0-9_]+)%/g, (match, key) => {
      const replacement = values[key];
      return typeof replacement === 'string' ? replacement : '';
    });
  }

  private static async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries = AI_CONFIG.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt > 1) {
          await logger.warn(`AI 请求重试 (第 ${attempt} 次)`, 'ai-client');
        }

        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), AI_CONFIG.timeout)
          ),
        ]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        await logger.error(`AI 请求失败 (第 ${attempt} 次): ${errorMessage}`, 'ai-client', {
          attempt,
          maxRetries: retries,
        });

        if (attempt === retries) throw error;

        const backoffDelay = Math.pow(2, attempt) * 1000;
        await logger.debug(`等待 ${backoffDelay}ms 后重试`, 'ai-client');
        await new Promise((r) => setTimeout(r, backoffDelay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  static async generate(
    type: PromptType,
    userInput: string,
    context?: string,
    options?: {
      providerId?: string;
      modelName?: string;
      outputFormat?: 'json' | 'markdown';
      useRawPrompt?: boolean;
      systemPrompt?: string;
    }
  ): Promise<IAIResponse> {
    const snippetId = logger.startSnippet({
      snippet_id: `ai-generate-${type}-${Date.now()}`,
      name: `AI生成-${type}`,
    });

    try {
      const template = PROMPT_TEMPLATES[type];
      const typePlaceholder = type === 'promptOptimize' ? context : type;
      const trimmedInput = userInput?.trim() ?? '';
      const containsPlaceholders = /%[A-Za-z0-9_]+%/.test(trimmedInput);
      const treatAsRaw = !!options?.useRawPrompt || containsPlaceholders;
      const baseReplacements: Record<string, string | undefined> = {
        worldContext: context,
        type: typePlaceholder,
        outputFormat: options?.outputFormat,
      };

      const systemSource = options?.systemPrompt ?? template.system;

      let finalPrompt: string;

      if (treatAsRaw) {
        const rawReplacements = { ...baseReplacements, input: undefined };
        const replaced = this.replacePlaceholders(userInput, rawReplacements);
        finalPrompt = replaced.trim().length ? replaced : userInput;
      } else {
        const templateUser = template.user;
        const replacementsWithInput = { ...baseReplacements, input: trimmedInput };
        const templateHasInput = templateUser.includes('%input%');

        let composedPrompt = this.replacePlaceholders(templateUser, replacementsWithInput);
        if (!templateHasInput && trimmedInput) {
          composedPrompt = [composedPrompt, trimmedInput].filter(Boolean).join('\n\n');
        }

        finalPrompt = composedPrompt.trim().length ? composedPrompt : trimmedInput;
      }

      const systemPrompt = this.replacePlaceholders(systemSource, {
        ...baseReplacements,
        input: trimmedInput,
      });

      // 获取模型
      let model: LanguageModel;
      if (options?.providerId && options?.modelName) {
        model = await getModelByProviderAndName(options.providerId, options.modelName);
      } else {
        try {
          model = await getDefaultModel();
        } catch {
          // 如果没有配置默认模型，回退到原始配置
          model = DEFAULT_MODEL;
        }
      }

      if (snippetId) {
        await logger.logSnippet(
          `开始生成: ${type}, 输入长度: ${finalPrompt.length}`,
          snippetId,
          'ai-client',
          { type, inputLength: finalPrompt.length, hasContext: !!context }
        );
      }

      await logger.debug(`AI 生成请求: ${type}`, 'ai-client', {
        type,
        model: model.modelId,
        provider: model.providerId,
        system: systemPrompt,
        input: finalPrompt,
        temperature: AI_CONFIG.defaultTemperature,
        maxTokens: AI_CONFIG.maxTokens,
      });

      const result = await this.executeWithRetry(async () => {
        const aiResult = await generateText({
          model,
          system: systemPrompt,
          prompt: finalPrompt,
          temperature: AI_CONFIG.defaultTemperature,
        });

        return aiResult;
      });

      const response: IAIResponse = {
        text: result.text,
        tokens: result.usage?.totalTokens || 0,
        cost: this.calculateCost(result.usage?.totalTokens || 0),
      };

      if (snippetId) {
        await logger.logSnippet(
          `生成完成: tokens=${response.tokens}, cost=$${response.cost.toFixed(4)}`,
          snippetId,
          'ai-client'
        );
        await logger.endSnippet(snippetId);
      }

      await logger.info(`AI 生成成功: ${type}`, 'ai-client', {
        type,
        tokens: response.tokens,
        cost: response.cost,
        textLength: response.text.length,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      if (snippetId) {
        await logger.logSnippet(`生成失败: ${errorMessage}`, snippetId, 'ai-client', {
          level: 'error',
        });
        await logger.endSnippet(snippetId);
      }

      await logger.error(`AI 生成失败: ${type} - ${errorMessage}`, 'ai-client', {
        type,
        error: errorMessage,
      });

      throw error;
    }
  }

  static async generateStream(
    type: PromptType,
    userInput: string,
    context?: string,
    options?: {
      providerId?: string;
      modelName?: string;
      outputFormat?: 'json' | 'markdown';
      useRawPrompt?: boolean;
      systemPrompt?: string;
    }
  ) {
    const snippetId = logger.startSnippet({
      snippet_id: `ai-stream-${type}-${Date.now()}`,
      name: `AI流式生成-${type}`,
    });

    try {
      const template = PROMPT_TEMPLATES[type];
      const typePlaceholder = type === 'promptOptimize' ? context : type;
      const trimmedInput = userInput?.trim() ?? '';
      const containsPlaceholders = /%[A-Za-z0-9_]+%/.test(trimmedInput);
      const treatAsRaw = !!options?.useRawPrompt || containsPlaceholders;
      const baseReplacements: Record<string, string | undefined> = {
        worldContext: context,
        type: typePlaceholder,
        outputFormat: options?.outputFormat,
      };

      const systemSource = options?.systemPrompt ?? template.system;

      let finalPrompt: string;

      if (treatAsRaw) {
        const rawReplacements = { ...baseReplacements, input: undefined };
        const replaced = this.replacePlaceholders(userInput, rawReplacements);
        finalPrompt = replaced.trim().length ? replaced : userInput;
      } else {
        const templateUser = template.user;
        const replacementsWithInput = { ...baseReplacements, input: trimmedInput };
        const templateHasInput = templateUser.includes('%input%');

        let composedPrompt = this.replacePlaceholders(templateUser, replacementsWithInput);
        if (!templateHasInput && trimmedInput) {
          composedPrompt = [composedPrompt, trimmedInput].filter(Boolean).join('\n\n');
        }

        finalPrompt = composedPrompt.trim().length ? composedPrompt : trimmedInput;
      }

      const systemPrompt = this.replacePlaceholders(systemSource, {
        ...baseReplacements,
        input: trimmedInput,
      });

      // 获取模型
      let model: LanguageModel;
      if (options?.providerId && options?.modelName) {
        model = await getModelByProviderAndName(options.providerId, options.modelName);
      } else {
        try {
          model = await getDefaultModel();
        } catch {
          // 如果没有配置默认模型，回退到原始配置
          model = DEFAULT_MODEL;
        }
      }

      if (snippetId) {
        await logger.logSnippet(
          `开始流式生成: ${type}, 输入长度: ${finalPrompt.length}`,
          snippetId,
          'ai-client',
          { type, inputLength: finalPrompt.length, hasContext: !!context }
        );
      }

      await logger.debug(`AI 流式生成请求: ${type}`, 'ai-client', {
        type,
        model: model.modelId,
        system: systemPrompt,
        prompt: finalPrompt,
        temperature: AI_CONFIG.defaultTemperature,
        maxTokens: AI_CONFIG.maxTokens,
      });

      const stream = streamText({
        model,
        system: systemPrompt,
        prompt: finalPrompt,
        temperature: AI_CONFIG.defaultTemperature,
      });

      if (snippetId) {
        await logger.logSnippet('流式生成已启动', snippetId as string, 'ai-client');
        await logger.endSnippet(snippetId as string);
      }

      await logger.info(`AI 流式生成已启动: ${type}`, 'ai-client', { type });

      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      if (snippetId) {
        await logger.logSnippet(`流式生成失败: ${errorMessage}`, snippetId as string, 'ai-client', {
          level: 'error',
        });
        await logger.endSnippet(snippetId as string);
      }

      await logger.error(`AI 流式生成失败: ${type} - ${errorMessage}`, 'ai-client', {
        type,
        error: errorMessage,
      });

      throw error;
    }
  }

  private static calculateCost(tokens: number): number {
    const costPer1kTokens = 0.03;
    return (tokens / 1000) * costPer1kTokens;
  }
}
