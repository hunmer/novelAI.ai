import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProxyAgent } from 'undici';
import { ModelProviderService, type ModelProviderConfig } from './model-provider';
import type { LanguageModel } from 'ai';

// 代理配置
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// 自定义fetch（支持代理）
const customFetch = proxyUrl
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      const dispatcher = new ProxyAgent(proxyUrl);
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

/**
 * 根据提供商配置创建AI模型实例
 */
export function createModelFromProvider(
  provider: ModelProviderConfig,
  modelName: string
): LanguageModel {
  const fetchConfig = customFetch ? { fetch: customFetch } : {};

  switch (provider.type) {
    case 'openai': {
      const openaiProvider = createOpenAI({
        ...fetchConfig,
        apiKey: provider.apiKey,
        ...(provider.baseUrl && { baseURL: provider.baseUrl }),
      });
      return openaiProvider(modelName);
    }

    case 'anthropic': {
      const anthropicProvider = createAnthropic({
        ...fetchConfig,
        apiKey: provider.apiKey,
        ...(provider.baseUrl && { baseURL: provider.baseUrl }),
      });
      return anthropicProvider(modelName);
    }

    case 'custom': {
      // 自定义提供商，假设使用OpenAI兼容API
      const customProvider = createOpenAI({
        ...fetchConfig,
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
      });
      return customProvider(modelName);
    }

    default:
      throw new Error(`不支持的提供商类型: ${provider.type}`);
  }
}

/**
 * 获取默认模型
 */
export async function getDefaultModel(): Promise<LanguageModel> {
  const provider = await ModelProviderService.getDefaultProvider();

  if (!provider) {
    throw new Error('未配置默认模型提供商');
  }

  const defaultModelName = provider.models[0];
  if (!defaultModelName) {
    throw new Error('提供商未配置可用模型');
  }

  return createModelFromProvider(provider, defaultModelName);
}

/**
 * 根据提供商ID和模型名称获取模型
 */
export async function getModelByProviderAndName(
  providerId: string,
  modelName: string
): Promise<LanguageModel> {
  const providers = await ModelProviderService.getAllProviders();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    throw new Error(`未找到提供商: ${providerId}`);
  }

  if (!provider.models.includes(modelName)) {
    throw new Error(`提供商 ${provider.name} 不支持模型 ${modelName}`);
  }

  return createModelFromProvider(provider, modelName);
}

/**
 * 获取所有可用模型
 */
export async function getAllAvailableModels(): Promise<
  Array<{
    providerId: string;
    providerName: string;
    providerType: string;
    modelName: string;
    isDefault: boolean;
  }>
> {
  const providers = await ModelProviderService.getActiveProviders();
  const models: Array<{
    providerId: string;
    providerName: string;
    providerType: string;
    modelName: string;
    isDefault: boolean;
  }> = [];

  for (const provider of providers) {
    for (const modelName of provider.models) {
      models.push({
        providerId: provider.id!,
        providerName: provider.name,
        providerType: provider.type,
        modelName,
        isDefault: provider.isDefault || false,
      });
    }
  }

  return models;
}
