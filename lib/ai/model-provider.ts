import { PrismaClient } from '@prisma/client';
import {
  ProviderType,
  normalizeProviderType,
} from './provider-types';

const prisma = new PrismaClient();

export type ModelCapability =
  | 'text'
  | 'image'
  | 'vision'
  | 'embedding'
  | 'web'
  | 'tools'
  | 'reasoning';

export const ALL_MODEL_CAPABILITIES: readonly ModelCapability[] = [
  'text',
  'image',
  'vision',
  'embedding',
  'web',
  'tools',
  'reasoning',
];

export interface ProviderModelConfig {
  name: string;
  label?: string;
  description?: string;
  capabilities: ModelCapability[];
  defaultFor?: ModelCapability[];
  metadata?: Record<string, any>;
}

export interface ModelProviderConfig {
  id?: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  models: ProviderModelConfig[];
  isDefault?: boolean;
  isActive?: boolean;
  capability?: ModelCapability; // 兼容旧版本的提供商能力
  metadata?: Record<string, any>;
}

function isModelCapability(value: unknown): value is ModelCapability {
  return typeof value === 'string' && ALL_MODEL_CAPABILITIES.includes(value as ModelCapability);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sanitizeModelConfig(
  model: ProviderModelConfig,
  fallbackCapability?: ModelCapability
): ProviderModelConfig {
  const name = model.name?.trim();
  if (!name) {
    throw new Error('模型名称不能为空');
  }

  const capabilities = (model.capabilities || [])
    .filter(isModelCapability)
    .filter(Boolean);

  const resolvedCapabilities = capabilities.length
    ? unique(capabilities)
    : fallbackCapability
      ? [fallbackCapability]
      : ['text'];

  const defaultFor = (model.defaultFor || [])
    .filter(isModelCapability)
    .filter((capability) => resolvedCapabilities.includes(capability));

  return {
    name,
    label: model.label?.trim() || undefined,
    description: model.description?.trim() || undefined,
    capabilities: resolvedCapabilities,
    defaultFor: defaultFor.length ? unique(defaultFor) : undefined,
    metadata:
      model.metadata && typeof model.metadata === 'object'
        ? JSON.parse(JSON.stringify(model.metadata))
        : undefined,
  };
}

function parseProviderModels(
  raw: unknown,
  fallbackCapability?: ModelCapability,
  defaultsFromMetadata: ModelCapability[] = []
): ProviderModelConfig[] {
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const normalized: ProviderModelConfig[] = [];

  for (const item of candidates) {
    try {
      if (typeof item === 'string') {
        normalized.push(
          sanitizeModelConfig(
            {
              name: item,
              capabilities: fallbackCapability ? [fallbackCapability] : [],
            },
            fallbackCapability
          )
        );
      } else if (item && typeof item === 'object') {
        const config = sanitizeModelConfig(
          {
            name: typeof (item as any).name === 'string' ? (item as any).name : '',
            label: typeof (item as any).label === 'string' ? (item as any).label : undefined,
            description:
              typeof (item as any).description === 'string'
                ? (item as any).description
                : undefined,
            capabilities: Array.isArray((item as any).capabilities)
              ? (item as any).capabilities
              : [],
            defaultFor: Array.isArray((item as any).defaultFor)
              ? (item as any).defaultFor
              : [],
            metadata:
              (item as any).metadata && typeof (item as any).metadata === 'object'
                ? (item as any).metadata
                : undefined,
          },
          fallbackCapability
        );
        normalized.push(config);
      }
    } catch {
      // 忽略无效模型配置
    }
  }

  // 如果没有任何模型，返回空数组
  if (!normalized.length) {
    return [];
  }

  // 兼容旧版默认能力：仅在未显式设置默认模型时生效
  for (const capability of defaultsFromMetadata) {
    if (!isModelCapability(capability)) continue;
    const alreadyDefined = normalized.some((model) =>
      (model.defaultFor || []).includes(capability)
    );
    if (alreadyDefined) continue;
    const candidate = normalized.find((model) => model.capabilities.includes(capability));
    if (candidate) {
      const defaults = new Set(candidate.defaultFor || []);
      defaults.add(capability);
      candidate.defaultFor = Array.from(defaults);
    }
  }

  return normalized;
}

function serializeProviderModels(
  models: ProviderModelConfig[],
  fallbackCapability?: ModelCapability
): string {
  const sanitized = models
    .filter((model) => model.name?.trim())
    .map((model) => sanitizeModelConfig(model, fallbackCapability))
    .map((model) => ({
      name: model.name,
      ...(model.label ? { label: model.label } : {}),
      ...(model.description ? { description: model.description } : {}),
      capabilities: model.capabilities,
      ...(model.defaultFor?.length ? { defaultFor: model.defaultFor } : {}),
      ...(model.metadata ? { metadata: model.metadata } : {}),
    }));
  return JSON.stringify(sanitized);
}

function extractDefaultCapabilities(metadata: Record<string, any>): ModelCapability[] {
  const defaults = metadata?.defaultCapabilities;
  if (!Array.isArray(defaults)) return [];
  return defaults.filter(isModelCapability);
}

function mapPrismaProvider(provider: any): ModelProviderConfig {
  const metadata = JSON.parse(provider.metadata);
  const fallbackCapability = metadata.capability as ModelCapability | undefined;
  const defaultsFromMetadata = extractDefaultCapabilities(metadata);

  let rawModels: unknown = [];
  try {
    rawModels = provider.models ? JSON.parse(provider.models) : [];
  } catch {
    rawModels = [];
  }

  const parsedModels = parseProviderModels(
    rawModels,
    fallbackCapability,
    defaultsFromMetadata
  );

  return {
    id: provider.id,
    name: provider.name,
    type: normalizeProviderType(provider.type),
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl || undefined,
    models: parsedModels,
    isDefault: provider.isDefault,
    isActive: provider.isActive,
    capability: fallbackCapability,
    metadata,
  };
}

export class ModelProviderService {
  /**
   * 获取所有激活的模型提供商
   */
  static async getActiveProviders(): Promise<ModelProviderConfig[]> {
    const providers = await prisma.modelProvider.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return providers.map(mapPrismaProvider);
  }

  /**
   * 获取默认模型提供商
   */
  static async getDefaultProvider(): Promise<ModelProviderConfig | null> {
    const provider = await prisma.modelProvider.findFirst({
      where: { isDefault: true, isActive: true },
    });

    return provider ? mapPrismaProvider(provider) : null;
  }

  /**
   * 添加新的模型提供商
   */
  static async addProvider(config: ModelProviderConfig): Promise<ModelProviderConfig> {
    if (config.isDefault) {
      await prisma.modelProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const metadataPayload = {
      ...(config.metadata || {}),
      ...(config.capability ? { capability: config.capability } : {}),
    };

    const provider = await prisma.modelProvider.create({
      data: {
        name: config.name,
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        models: serializeProviderModels(config.models || [], config.capability),
        isDefault: config.isDefault || false,
        isActive: config.isActive !== false,
        metadata: JSON.stringify(metadataPayload),
      },
    });

    return mapPrismaProvider(provider);
  }

  /**
   * 更新模型提供商
   */
  static async updateProvider(
    id: string,
    config: Partial<ModelProviderConfig>
  ): Promise<ModelProviderConfig> {
    const existing = await prisma.modelProvider.findUnique({ where: { id } });

    if (!existing) {
      throw new Error('模型提供商不存在');
    }

    const existingMetadata = JSON.parse(existing.metadata);
    const metadataPayload = {
      ...existingMetadata,
      ...(config.metadata || {}),
      ...(config.capability ? { capability: config.capability } : {}),
    };

    if (config.isDefault) {
      await prisma.modelProvider.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.modelProvider.update({
      where: { id },
      data: {
        ...(config.name && { name: config.name }),
        ...(config.type && { type: config.type }),
        ...(config.apiKey && { apiKey: config.apiKey }),
        ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
        ...(config.models
          ? {
              models: serializeProviderModels(
                config.models,
                (metadataPayload.capability as ModelCapability | undefined) ||
                  (existingMetadata.capability as ModelCapability | undefined)
              ),
            }
          : {}),
        ...(config.isDefault !== undefined && { isDefault: config.isDefault }),
        ...(config.isActive !== undefined && { isActive: config.isActive }),
        metadata: JSON.stringify(metadataPayload),
      },
    });

    return mapPrismaProvider(provider);
  }

  /**
   * 删除模型提供商
   */
  static async deleteProvider(id: string): Promise<void> {
    await prisma.modelProvider.delete({ where: { id } });
  }

  /**
   * 获取所有提供商（包括未激活的）
   */
  static async getAllProviders(): Promise<ModelProviderConfig[]> {
    const providers = await prisma.modelProvider.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return providers.map(mapPrismaProvider);
  }

  /**
   * 获取具有指定能力的模型提供商
   */
  static async getProvidersByCapability(
    capability: ModelCapability
  ): Promise<ModelProviderConfig[]> {
    const providers = await this.getActiveProviders();

    return providers
      .map((provider) => ({
        ...provider,
        models: provider.models
          .filter((model) => model.capabilities.includes(capability))
          .map((model) => ({ ...model })),
      }))
      .filter((provider) => provider.models.length > 0);
  }

  /**
   * 获取图片生成模型提供商
   */
  static async getImageProviders(): Promise<ModelProviderConfig[]> {
    return this.getProvidersByCapability('image');
  }

  /**
   * 获取Embedding模型提供商
   */
  static async getEmbeddingProviders(): Promise<ModelProviderConfig[]> {
    return this.getProvidersByCapability('embedding');
  }

  /**
   * 将某个模型设置为指定能力的默认模型
   */
  static async setDefaultCapability(
    providerId: string,
    modelName: string,
    capability: ModelCapability
  ): Promise<ModelProviderConfig> {
    const providers = await prisma.modelProvider.findMany();
    let foundModel = false;
    const updates: Parameters<typeof prisma.$transaction>[0] = [];

    for (const provider of providers) {
      const metadata = JSON.parse(provider.metadata);
      const fallbackCapability = metadata.capability as ModelCapability | undefined;
      const defaultsFromMetadata = extractDefaultCapabilities(metadata);
      const normalizedModels = parseProviderModels(
        provider.models ? JSON.parse(provider.models) : [],
        fallbackCapability,
        defaultsFromMetadata
      );

      let changed = false;

      for (const model of normalizedModels) {
        if (provider.id === providerId && model.name === modelName) {
          foundModel = true;
          if (!model.capabilities.includes(capability)) {
            model.capabilities = [...model.capabilities, capability];
            changed = true;
          }
          const defaults = new Set(model.defaultFor || []);
          if (!defaults.has(capability)) {
            defaults.add(capability);
            model.defaultFor = Array.from(defaults);
            changed = true;
          }
        } else if (model.defaultFor?.includes(capability)) {
          model.defaultFor = model.defaultFor.filter((cap) => cap !== capability);
          changed = true;
        }
      }

      if (changed) {
        updates.push(
          prisma.modelProvider.update({
            where: { id: provider.id },
            data: {
              models: serializeProviderModels(normalizedModels, fallbackCapability),
            },
          })
        );
      }
    }

    if (!foundModel) {
      throw new Error('未找到指定模型或模型未配置对应能力');
    }

    if (updates.length) {
      await prisma.$transaction(updates);
    }

    const updated = await prisma.modelProvider.findUnique({ where: { id: providerId } });
    if (!updated) {
      throw new Error('模型提供商不存在');
    }

    return mapPrismaProvider(updated);
  }

  /**
   * 取消模型在指定能力上的默认状态
   */
  static async unsetDefaultCapability(
    providerId: string,
    modelName: string,
    capability: ModelCapability
  ): Promise<ModelProviderConfig> {
    const provider = await prisma.modelProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new Error('模型提供商不存在');
    }

    const metadata = JSON.parse(provider.metadata);
    const fallbackCapability = metadata.capability as ModelCapability | undefined;
    const defaultsFromMetadata = extractDefaultCapabilities(metadata);
    const models = parseProviderModels(
      provider.models ? JSON.parse(provider.models) : [],
      fallbackCapability,
      defaultsFromMetadata
    );

    const target = models.find((model) => model.name === modelName);
    if (!target) {
      throw new Error('未找到指定模型');
    }

    if (!target.defaultFor?.includes(capability)) {
      return mapPrismaProvider(provider);
    }

    target.defaultFor = target.defaultFor.filter((cap) => cap !== capability);
    if (!target.defaultFor.length) {
      delete target.defaultFor;
    }

    const updated = await prisma.modelProvider.update({
      where: { id: providerId },
      data: {
        models: serializeProviderModels(models, fallbackCapability),
      },
    });

    return mapPrismaProvider(updated);
  }
}
