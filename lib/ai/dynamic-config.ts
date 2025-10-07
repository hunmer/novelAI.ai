import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProxyAgent } from 'undici';
import {
  ModelProviderService,
  type ModelProviderConfig,
  type ModelCapability,
  type ProviderModelConfig,
} from './model-provider';
import type { EmbeddingModel, LanguageModel } from 'ai';
import { logger } from '@/lib/logger/client';

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

export interface LanguageModelResult {
  provider: ModelProviderConfig;
  modelName: string;
  model: LanguageModel;
  modelConfig: ProviderModelConfig;
}

interface ProviderModelSelection {
  provider: ModelProviderConfig;
  model: ProviderModelConfig;
}

async function resolveDefaultModelFor(
  capability: ModelCapability
): Promise<ProviderModelSelection> {
  const activeProviders = await ModelProviderService.getActiveProviders();

  if (!activeProviders.length) {
    await logger.error('未配置任何模型提供商', 'ai-config', { capability });
    throw new Error('未配置默认模型提供商');
  }

  const candidates: ProviderModelSelection[] = [];

  for (const provider of activeProviders) {
    for (const model of provider.models) {
      if (model.capabilities.includes(capability)) {
        candidates.push({ provider, model });
      }
    }
  }

  if (!candidates.length) {
    await logger.error('未找到匹配能力的模型', 'ai-config', {
      capability,
      providerCount: activeProviders.length,
    });
    throw new Error(`未配置 ${capability} 能力的模型提供商`);
  }

  const explicitDefault = await ModelProviderService.getDefaultProvider();

  const defaultCandidate = candidates.find(({ model }) =>
    (model.defaultFor || []).includes(capability)
  );

  if (defaultCandidate) {
    return defaultCandidate;
  }

  if (explicitDefault) {
    const providerMatch = candidates.find(
      ({ provider }) => provider.id === explicitDefault.id
    );
    if (providerMatch) {
      return providerMatch;
    }
  }

  return candidates[0];
}

/**
 * 获取默认文本模型（包含提供商信息）
 */
export async function getDefaultLanguageModel(): Promise<LanguageModelResult> {
  const selection = await resolveDefaultModelFor('text');
  const model = createModelFromProvider(selection.provider, selection.model.name);

  await logger.debug('默认文本模型实例创建成功', 'ai-config', {
    providerId: selection.provider.id,
    providerName: selection.provider.name,
    modelName: selection.model.name,
  });

  return {
    provider: selection.provider,
    modelName: selection.model.name,
    model,
    modelConfig: selection.model,
  };
}

/**
 * 获取默认模型
 */
export async function getDefaultModel(): Promise<LanguageModel> {
  const { model } = await getDefaultLanguageModel();
  return model;
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

  const model = provider.models.find((item) => item.name === modelName);

  if (!model) {
    throw new Error(`提供商 ${provider.name} 不支持模型 ${modelName}`);
  }

  return createModelFromProvider(provider, model.name);
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
    modelLabel?: string;
    capabilities: ModelCapability[];
    defaultFor: ModelCapability[];
  }>
> {
  const providers = await ModelProviderService.getActiveProviders();
  const models: Array<{
    providerId: string;
    providerName: string;
    providerType: string;
    modelName: string;
    modelLabel?: string;
    capabilities: ModelCapability[];
    defaultFor: ModelCapability[];
  }> = [];

  for (const provider of providers) {
    for (const model of provider.models) {
      models.push({
        providerId: provider.id!,
        providerName: provider.name,
        providerType: provider.type,
        modelName: model.name,
        modelLabel: model.label,
        capabilities: [...model.capabilities],
        defaultFor: [...(model.defaultFor || [])],
      });
    }
  }

  return models;
}

/**
 * 根据提供商配置创建Embedding模型实例
 */
export function createEmbeddingModelFromProvider(
  provider: ModelProviderConfig,
  modelName: string
): EmbeddingModel<string> {
  const fetchConfig = customFetch ? { fetch: customFetch } : {};

  switch (provider.type) {
    case 'openai': {
      const openaiProvider = createOpenAI({
        ...fetchConfig,
        apiKey: provider.apiKey,
        ...(provider.baseUrl && { baseURL: provider.baseUrl }),
      });
      return openaiProvider.embedding(modelName);
    }

    case 'custom': {
      const customProvider = createOpenAI({
        ...fetchConfig,
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
      });
      return customProvider.embedding(modelName);
    }

    case 'anthropic':
      throw new Error('当前暂不支持使用 Anthropic 提供Embedding');

    default:
      throw new Error(`不支持的提供商类型: ${provider.type}`);
  }
}

interface EmbeddingModelResult {
  provider: ModelProviderConfig;
  modelName: string;
  model: EmbeddingModel<string>;
}

/**
 * 获取默认Embedding模型
 */
export async function getDefaultEmbeddingModel(): Promise<EmbeddingModelResult> {
  const selection = await resolveDefaultModelFor('embedding');

  return {
    provider: selection.provider,
    modelName: selection.model.name,
    model: createEmbeddingModelFromProvider(selection.provider, selection.model.name),
  };
}

/**
 * 根据提供商ID和模型名称获取Embedding模型
 */
export async function getEmbeddingModelByProviderAndName(
  providerId: string,
  modelName: string
): Promise<EmbeddingModelResult> {
  const providers = await ModelProviderService.getAllProviders();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    throw new Error(`未找到Embedding提供商: ${providerId}`);
  }

  const embeddingModels = provider.models.filter((model) =>
    model.capabilities.includes('embedding')
  );

  if (!embeddingModels.length) {
    throw new Error(`提供商 ${provider.name} 未配置 Embedding 模型`);
  }

  const normalizedName = modelName?.trim();

  const targetModel = normalizedName
    ? embeddingModels.find((model) => model.name === normalizedName)
    : embeddingModels.find((model) => (model.defaultFor || []).includes('embedding')) ||
      embeddingModels[0];

  if (!targetModel) {
    throw new Error(`提供商 ${provider.name} 不支持模型 ${modelName}`);
  }

  return {
    provider,
    modelName: targetModel.name,
    model: createEmbeddingModelFromProvider(provider, targetModel.name),
  };
}

/**
 * 获取Embedding模型
 */
export async function getEmbeddingModel(options?: {
  providerId?: string;
  modelName?: string;
}): Promise<EmbeddingModelResult> {
  if (options?.providerId) {
    return getEmbeddingModelByProviderAndName(
      options.providerId,
      options.modelName || ''
    );
  }

  if (options?.modelName) {
    const providers = await ModelProviderService.getActiveProviders();
    for (const provider of providers) {
      const candidate = provider.models.find(
        (model) =>
          model.name === options.modelName && model.capabilities.includes('embedding')
      );
      if (candidate) {
        return {
          provider,
          modelName: candidate.name,
          model: createEmbeddingModelFromProvider(provider, candidate.name),
        };
      }
    }
  }

  return getDefaultEmbeddingModel();
}
