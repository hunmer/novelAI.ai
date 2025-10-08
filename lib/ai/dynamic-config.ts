import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMistral } from '@ai-sdk/mistral';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createCerebras } from '@ai-sdk/cerebras';
import { createVercel } from '@ai-sdk/vercel';
import { createXai } from '@ai-sdk/xai';
type BasetenFactory = typeof import('@ai-sdk/baseten').createBaseten;
import { ProxyAgent } from 'undici';
import {
  ModelProviderService,
  type ModelProviderConfig,
  type ModelCapability,
  type ProviderModelConfig,
} from './model-provider';
import type { EmbeddingModel, LanguageModel } from 'ai';
import { logger } from '@/lib/logger/client';
import {
  isOpenAICompatibleProviderType,
} from './provider-types';

// 代理配置
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// 自定义fetch（支持代理）
const customFetch = proxyUrl
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      const dispatcher = new ProxyAgent(proxyUrl);
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

const fetchConfig = customFetch ? { fetch: customFetch } : {};

const providerInstanceCache = new Map<string, unknown>();

let basetenFactoryCache: BasetenFactory | null | undefined;

function loadBasetenFactory(): BasetenFactory | null {
  if (basetenFactoryCache !== undefined) {
    return basetenFactoryCache;
  }

  try {
    const req: NodeRequire =
      typeof __non_webpack_require__ === 'function'
        ? __non_webpack_require__
        : eval('require');
    basetenFactoryCache = req('@ai-sdk/baseten').createBaseten as BasetenFactory;
  } catch {
    basetenFactoryCache = null;
  }

  return basetenFactoryCache;
}

function cacheKey(provider: ModelProviderConfig, scope = 'default') {
  return `${provider.id ?? provider.name ?? provider.type}:${scope}`;
}

function getOrCreateProvider<T>(
  provider: ModelProviderConfig,
  scope: string,
  factory: () => T
): T {
  const key = cacheKey(provider, scope);
  const cached = providerInstanceCache.get(key);
  if (cached) {
    return cached as T;
  }
  const created = factory();
  providerInstanceCache.set(key, created as unknown);
  return created;
}

function firstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return undefined;
}

function tryParseObject(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function getMetadataObject(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
): Record<string, unknown> | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = tryParseObject(source[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function getMetadataString(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizePrivateKey(value?: string) {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

function extractHeadersFromMetadata(
  metadata?: Record<string, unknown>
): Record<string, string> {
  if (!metadata) return {};
  const record = getMetadataObject(metadata, 'headers', 'customHeaders');
  if (!record) return {};

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    let stringValue: string | undefined;
    if (typeof value === 'string') {
      stringValue = value.trim();
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = String(value);
    }
    if (!stringValue) continue;
    headers[trimmedKey] = stringValue;
  }
  return headers;
}

export function resolveRequestHeaders(
  provider: ModelProviderConfig,
  model?: ProviderModelConfig
): Record<string, string> {
  const providerHeaders = extractHeadersFromMetadata(
    (provider.metadata || undefined) as Record<string, unknown> | undefined
  );
  const modelHeaders = extractHeadersFromMetadata(
    (model?.metadata || undefined) as Record<string, unknown> | undefined
  );
  return { ...providerHeaders, ...modelHeaders };
}

function buildSimpleProvider<T extends (options?: Record<string, unknown>) => unknown>(
  factory: T,
  provider: ModelProviderConfig,
  extraOptions: Record<string, unknown> = {}
): ReturnType<T> {
  const init: Record<string, unknown> = {
    ...fetchConfig,
    ...extraOptions,
  };

  const apiKey = provider.apiKey || getMetadataString(provider.metadata, 'apiKey');
  if (apiKey) {
    init.apiKey = apiKey;
  }

  const baseURL = firstDefined(
    provider.baseUrl,
    getMetadataString(provider.metadata, 'baseURL', 'baseUrl', 'endpoint')
  );
  if (baseURL) {
    init.baseURL = baseURL;
  }

  const headers = getMetadataObject(provider.metadata, 'headers', 'customHeaders');
  if (headers) {
    init.headers = headers;
  }

  const query = getMetadataObject(provider.metadata, 'query', 'queryParams');
  if (query) {
    init.query = query;
  }

  const providerOptions = getMetadataObject(provider.metadata, 'providerOptions');
  if (providerOptions) {
    Object.assign(init, providerOptions);
  }

  return factory(init as Parameters<T>[0]);
}

function buildAzureProvider(provider: ModelProviderConfig) {
  const resourceName =
    getMetadataString(
      provider.metadata,
      'resourceName',
      'azureResourceName'
    ) ?? provider.baseUrl?.match(/https?:\/\/([^.]+)\.openai\.azure\.com/i)?.[1];

  const endpoint = firstDefined(
    getMetadataString(provider.metadata, 'endpoint', 'azureEndpoint'),
    provider.baseUrl
  );

  if (!resourceName && !endpoint) {
    throw new Error('Azure 提供商缺少 resourceName 或 endpoint 配置');
  }

  const apiVersion = getMetadataString(
    provider.metadata,
    'apiVersion',
    'azureApiVersion'
  );

  const init: Record<string, unknown> = {
    ...fetchConfig,
  };

  const apiKey = provider.apiKey || getMetadataString(provider.metadata, 'apiKey');
  if (apiKey) {
    init.apiKey = apiKey;
  }

  if (resourceName) {
    init.resourceName = resourceName;
  }

  if (endpoint) {
    init.endpoint = endpoint;
  }

  if (apiVersion) {
    init.apiVersion = apiVersion;
  }

  const headers = getMetadataObject(provider.metadata, 'headers', 'customHeaders');
  if (headers) {
    init.headers = headers;
  }

  return createAzure(init as Parameters<typeof createAzure>[0]);
}

function buildGroqProvider(provider: ModelProviderConfig) {
  return buildSimpleProvider(createGroq, provider);
}

function buildGoogleGenerativeAIProvider(provider: ModelProviderConfig) {
  return buildSimpleProvider(createGoogleGenerativeAI, provider);
}

function buildGoogleVertexProvider(provider: ModelProviderConfig) {
  const project = getMetadataString(
    provider.metadata,
    'project',
    'vertexProject',
    'gcpProject',
    'googleProject'
  );
  const location = getMetadataString(
    provider.metadata,
    'location',
    'vertexLocation',
    'gcpLocation',
    'googleLocation'
  );

  const credentials = getMetadataObject(
    provider.metadata,
    'credentials',
    'googleCredentials'
  );
  const googleAuthOptions =
    getMetadataObject(provider.metadata, 'googleAuthOptions', 'googleAuth') ||
    (credentials
      ? { credentials }
      : undefined);

  if (googleAuthOptions?.credentials) {
    const cred = googleAuthOptions.credentials as Record<string, unknown>;
    const clientEmail = getMetadataString(cred, 'clientEmail', 'client_email');
    const privateKey = normalizePrivateKey(
      getMetadataString(cred, 'privateKey', 'private_key')
    );
    if (clientEmail && privateKey) {
      googleAuthOptions.credentials = {
        client_email: clientEmail,
        private_key: privateKey,
      } as Record<string, string>;
    }
  }

  const init: Record<string, unknown> = {
    ...fetchConfig,
  };

  if (project) {
    init.project = project;
  }
  if (location) {
    init.location = location;
  }
  if (googleAuthOptions) {
    init.googleAuthOptions = googleAuthOptions;
  }

  const baseURL = firstDefined(
    provider.baseUrl,
    getMetadataString(provider.metadata, 'baseURL', 'baseUrl', 'endpoint')
  );
  if (baseURL) {
    init.baseURL = baseURL;
  }

  return createVertex(init as Parameters<typeof createVertex>[0]);
}

const buildMistralProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createMistral, provider);

const buildDeepSeekProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createDeepSeek, provider);

const buildDeepInfraProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createDeepInfra, provider);

const buildFireworksProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createFireworks, provider);

const buildCerebrasProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createCerebras, provider);

const buildBasetenProvider = (provider: ModelProviderConfig) => {
  const factory = loadBasetenFactory();
  if (!factory) {
    throw new Error('Baseten 提供商所需的运行时依赖未安装，无法创建实例');
  }
  const modelURL = getMetadataString(
    provider.metadata,
    'modelURL',
    'modelUrl',
    'basetenModelURL'
  );
  const workspaceId = getMetadataString(
    provider.metadata,
    'workspaceId',
    'basetenWorkspaceId'
  );
  const extra: Record<string, unknown> = {};
  if (modelURL) {
    extra.modelURL = modelURL;
  }
  if (workspaceId) {
    extra.workspaceId = workspaceId;
  }
  return buildSimpleProvider(factory, provider, extra);
};

const buildVercelProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createVercel, provider);

const buildXaiProvider = (provider: ModelProviderConfig) =>
  buildSimpleProvider(createXai, provider);

function resolveAzureDeploymentName(
  provider: ModelProviderConfig,
  modelName: string
): string {
  const modelConfig = provider.models.find((model) => model.name === modelName);

  return (
    getMetadataString(modelConfig?.metadata, 'deployment', 'deploymentName', 'azureDeployment', 'azureDeploymentName') ||
    getMetadataString(provider.metadata, 'defaultDeployment', 'deployment', 'deploymentName') ||
    modelName
  );
}

/**
 * 根据提供商配置创建AI模型实例
 */
export function createModelFromProvider(
  provider: ModelProviderConfig,
  modelName: string
): LanguageModel {
  console.log({provider, modelName})
  if (provider.type === 'azure') {
    const azureProvider = getOrCreateProvider(provider, 'azure', () =>
      buildAzureProvider(provider)
    );
    const deployment = resolveAzureDeploymentName(provider, modelName);
    return azureProvider.chat(deployment);
  }

  if (provider.type === 'google-generative-ai') {
    const googleProvider = getOrCreateProvider(provider, 'google-generative-ai', () =>
      buildGoogleGenerativeAIProvider(provider)
    );
    return googleProvider(modelName);
  }

  if (provider.type === 'google-vertex') {
    const vertexProvider = getOrCreateProvider(provider, 'google-vertex', () =>
      buildGoogleVertexProvider(provider)
    );
    return vertexProvider(modelName);
  }

  if (provider.type === 'groq') {
    const groqProvider = getOrCreateProvider(provider, 'groq', () =>
      buildGroqProvider(provider)
    );
    return groqProvider.chat(modelName);
  }

  if (provider.type === 'mistral') {
    const mistralProvider = getOrCreateProvider(provider, 'mistral', () =>
      buildMistralProvider(provider)
    );
    return mistralProvider(modelName);
  }

  if (provider.type === 'deepseek') {
    const deepseekProvider = getOrCreateProvider(provider, 'deepseek', () =>
      buildDeepSeekProvider(provider)
    );
    return deepseekProvider(modelName);
  }

  if (provider.type === 'deepinfra') {
    const deepinfraProvider = getOrCreateProvider(provider, 'deepinfra', () =>
      buildDeepInfraProvider(provider)
    );
    return deepinfraProvider(modelName);
  }

  if (provider.type === 'fireworks') {
    const fireworksProvider = getOrCreateProvider(provider, 'fireworks', () =>
      buildFireworksProvider(provider)
    );
    return fireworksProvider(modelName);
  }

  if (provider.type === 'cerebras') {
    const cerebrasProvider = getOrCreateProvider(provider, 'cerebras', () =>
      buildCerebrasProvider(provider)
    );
    return cerebrasProvider(modelName);
  }

  if (provider.type === 'baseten') {
    const basetenProvider = getOrCreateProvider(provider, 'baseten', () =>
      buildBasetenProvider(provider)
    );
    return basetenProvider(modelName);
  }

  if (provider.type === 'vercel') {
    const vercelProvider = getOrCreateProvider(provider, 'vercel', () =>
      buildVercelProvider(provider)
    );
    return vercelProvider(modelName);
  }

  if (provider.type === 'xai') {
    const xaiProvider = getOrCreateProvider(provider, 'xai', () =>
      buildXaiProvider(provider)
    );
    return xaiProvider(modelName);
  }

  if (isOpenAICompatibleProviderType(provider.type)) {
    const openaiProvider = createOpenAI({
      ...fetchConfig,
      apiKey: provider.apiKey,
      ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    });
    return openaiProvider.chat(modelName);
  }

  if (provider.type === 'anthropic') {
    const anthropicProvider = createAnthropic({
      ...fetchConfig,
      apiKey: provider.apiKey,
      ...(provider.baseUrl && { baseURL: provider.baseUrl }),
    });
    return anthropicProvider.chat(modelName);
  }

  throw new Error(`不支持的提供商类型: ${provider.type}`);
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
export async function getLanguageModelByProviderAndName(
  providerId: string,
  modelName: string
): Promise<LanguageModelResult> {
  const providers = await ModelProviderService.getAllProviders();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    throw new Error(`未找到提供商: ${providerId}`);
  }

  const model = provider.models.find((item) => item.name === modelName);

  if (!model) {
    throw new Error(`提供商 ${provider.name} 不支持模型 ${modelName}`);
  }

  const languageModel = createModelFromProvider(provider, model.name);

  return {
    provider,
    modelName: model.name,
    model: languageModel,
    modelConfig: model,
  };
}

export async function getModelByProviderAndName(
  providerId: string,
  modelName: string
): Promise<LanguageModel> {
  const { model } = await getLanguageModelByProviderAndName(providerId, modelName);
  return model;
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
  if (provider.type === 'azure') {
    const azureProvider = getOrCreateProvider(provider, 'azure', () =>
      buildAzureProvider(provider)
    );
    const deployment = resolveAzureDeploymentName(provider, modelName);
    return azureProvider.embedding(deployment);
  }

  if (provider.type === 'google-generative-ai') {
    const googleProvider = getOrCreateProvider(provider, 'google-generative-ai', () =>
      buildGoogleGenerativeAIProvider(provider)
    );
    if (typeof (googleProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (googleProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Google 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'google-vertex') {
    const vertexProvider = getOrCreateProvider(provider, 'google-vertex', () =>
      buildGoogleVertexProvider(provider)
    );
    if (typeof (vertexProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (vertexProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Google Vertex 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'mistral') {
    const mistralProvider = getOrCreateProvider(provider, 'mistral', () =>
      buildMistralProvider(provider)
    );
    if (typeof (mistralProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (mistralProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Mistral 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'deepinfra') {
    const deepinfraProvider = getOrCreateProvider(provider, 'deepinfra', () =>
      buildDeepInfraProvider(provider)
    );
    if (typeof (deepinfraProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (deepinfraProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 DeepInfra 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'baseten') {
    const basetenProvider = getOrCreateProvider(provider, 'baseten', () =>
      buildBasetenProvider(provider)
    );
    const factory = (basetenProvider as { textEmbeddingModel?: (model?: string) => unknown }).textEmbeddingModel;
    if (typeof factory === 'function') {
      return modelName ? factory(modelName) : factory();
    }
    throw new Error('当前 Baseten 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'vercel') {
    const vercelProvider = getOrCreateProvider(provider, 'vercel', () =>
      buildVercelProvider(provider)
    );
    if (typeof (vercelProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (vercelProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Vercel 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'fireworks') {
    const fireworksProvider = getOrCreateProvider(provider, 'fireworks', () =>
      buildFireworksProvider(provider)
    );
    if (typeof (fireworksProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (fireworksProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Fireworks 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'cerebras') {
    const cerebrasProvider = getOrCreateProvider(provider, 'cerebras', () =>
      buildCerebrasProvider(provider)
    );
    if (typeof (cerebrasProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (cerebrasProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 Cerebras 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'xai') {
    const xaiProvider = getOrCreateProvider(provider, 'xai', () =>
      buildXaiProvider(provider)
    );
    if (typeof (xaiProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (xaiProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 xAI 提供商未提供 Embedding 能力');
  }

  if (provider.type === 'deepseek') {
    const deepseekProvider = getOrCreateProvider(provider, 'deepseek', () =>
      buildDeepSeekProvider(provider)
    );
    if (typeof (deepseekProvider as { textEmbedding?: (model: string) => unknown }).textEmbedding === 'function') {
      return (deepseekProvider as { textEmbedding: (model: string) => unknown }).textEmbedding(modelName);
    }
    throw new Error('当前 DeepSeek 提供商未提供 Embedding 能力');
  }

  if (isOpenAICompatibleProviderType(provider.type)) {
    const openaiProvider = createOpenAI({
      ...fetchConfig,
      apiKey: provider.apiKey,
      ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    });
    return openaiProvider.embedding(modelName);
  }

  if (provider.type === 'anthropic') {
    throw new Error('当前暂不支持使用 Anthropic 提供Embedding');
  }

  throw new Error(`不支持的提供商类型: ${provider.type}`);
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
