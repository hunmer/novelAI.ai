import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ModelCapability = 'text' | 'image' | 'vision';

export interface ModelProviderConfig {
  id?: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  models: string[];
  isDefault?: boolean;
  isActive?: boolean;
  capability?: ModelCapability; // 模型能力：文本生成、图片生成、视觉理解
  metadata?: Record<string, any>;
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

    return providers.map((p) => {
      const metadata = JSON.parse(p.metadata);
      return {
        id: p.id,
        name: p.name,
        type: p.type as 'openai' | 'anthropic' | 'custom',
        apiKey: p.apiKey,
        baseUrl: p.baseUrl || undefined,
        models: JSON.parse(p.models),
        isDefault: p.isDefault,
        isActive: p.isActive,
        capability: metadata.capability as ModelCapability | undefined,
        metadata,
      };
    });
  }

  /**
   * 获取默认模型提供商
   */
  static async getDefaultProvider(): Promise<ModelProviderConfig | null> {
    const provider = await prisma.modelProvider.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!provider) return null;

    const metadata = JSON.parse(provider.metadata);
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type as 'openai' | 'anthropic' | 'custom',
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || undefined,
      models: JSON.parse(provider.models),
      isDefault: provider.isDefault,
      isActive: provider.isActive,
      capability: metadata.capability as ModelCapability | undefined,
      metadata,
    };
  }

  /**
   * 添加新的模型提供商
   */
  static async addProvider(config: ModelProviderConfig): Promise<ModelProviderConfig> {
    // 如果设置为默认，取消其他默认设置
    if (config.isDefault) {
      await prisma.modelProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.modelProvider.create({
      data: {
        name: config.name,
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        models: JSON.stringify(config.models),
        isDefault: config.isDefault || false,
        isActive: config.isActive !== false,
        metadata: JSON.stringify(config.metadata || {}),
      },
    });

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type as 'openai' | 'anthropic' | 'custom',
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || undefined,
      models: JSON.parse(provider.models),
      isDefault: provider.isDefault,
      isActive: provider.isActive,
      metadata: JSON.parse(provider.metadata),
    };
  }

  /**
   * 更新模型提供商
   */
  static async updateProvider(
    id: string,
    config: Partial<ModelProviderConfig>
  ): Promise<ModelProviderConfig> {
    // 如果设置为默认，取消其他默认设置
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
        ...(config.models && { models: JSON.stringify(config.models) }),
        ...(config.isDefault !== undefined && { isDefault: config.isDefault }),
        ...(config.isActive !== undefined && { isActive: config.isActive }),
        ...(config.metadata && { metadata: JSON.stringify(config.metadata) }),
      },
    });

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type as 'openai' | 'anthropic' | 'custom',
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || undefined,
      models: JSON.parse(provider.models),
      isDefault: provider.isDefault,
      isActive: provider.isActive,
      metadata: JSON.parse(provider.metadata),
    };
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

    return providers.map((p) => {
      const metadata = JSON.parse(p.metadata);
      return {
        id: p.id,
        name: p.name,
        type: p.type as 'openai' | 'anthropic' | 'custom',
        apiKey: p.apiKey,
        baseUrl: p.baseUrl || undefined,
        models: JSON.parse(p.models),
        isDefault: p.isDefault,
        isActive: p.isActive,
        capability: metadata.capability as ModelCapability | undefined,
        metadata,
      };
    });
  }

  /**
   * 获取图片生成模型提供商
   */
  static async getImageProviders(): Promise<ModelProviderConfig[]> {
    const providers = await this.getActiveProviders();
    return providers.filter(p => p.capability === 'image');
  }
}
