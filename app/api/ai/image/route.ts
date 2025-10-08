import { NextRequest, NextResponse } from 'next/server';
import {
  ModelProviderService,
  type ModelProviderConfig,
  type ProviderModelConfig,
} from '@/lib/ai/model-provider';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger/client';
import OpenAI from 'openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { experimental_generateImage as generateImage } from 'ai';
import { ProxyAgent } from 'undici';
import { randomUUID } from 'crypto';
import {
  persistImage,
  removeImageIfExists,
  resolveImageExtension,
} from '@/lib/server/image-storage';
import type { StoredImageInfo } from '@/lib/server/image-storage';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const customFetch = proxyUrl
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      const dispatcher = new ProxyAgent(proxyUrl);
      await logger.info(`使用代理: ${proxyUrl}`, 'network', {
        url,
        init: { ...init },
        dispatcher: {
          ...(dispatcher as any),
        },
      });
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { prompt, providerId, model, projectId, sceneId, characterId } = await req.json();

    // 获取指定的模型提供商，如果未指定则获取第一个图片生成模型
    let provider;
    if (providerId) {
      const allProviders = await ModelProviderService.getAllProviders();
      provider = allProviders.find(p => p.id === providerId);
    } else {
      const imageProviders = await ModelProviderService.getImageProviders();
      provider = imageProviders[0];
    }

    if (!provider) {
      throw new Error('未找到可用的图片生成模型提供商');
    }

    const imageModels = provider.models.filter((item) =>
      item.capabilities.includes('image')
    );

    if (!imageModels.length) {
      throw new Error('所选提供商未配置图片生成模型');
    }

    let modelConfig = model
      ? imageModels.find((item) => item.name === model)
      : imageModels.find((item) => (item.defaultFor || []).includes('image'));

    if (!modelConfig) {
      modelConfig = imageModels[0];
    }

    if (!modelConfig) {
      throw new Error('未找到可用的图片生成模型');
    }

    await logger.info('开始图片生成', 'ai-image', {
      providerId: provider.id,
      providerType: provider.type,
      modelName: modelConfig.name,
    });
    const modelMetadata = (modelConfig.metadata || {}) as Record<string, unknown>;
    const size =
      typeof modelMetadata.imageSize === 'string' && modelMetadata.imageSize.trim()
        ? modelMetadata.imageSize.trim()
        : '1024x1024';

    const {
      buffer: imageBuffer,
      contentType,
      extension,
      metadata: providerMetadata,
    } = await generateImageFromProvider({
      provider,
      modelConfig,
      prompt,
      size,
      modelMetadata,
    });

    if (!contentType) {
      throw new Error('图片生成失败：无法确定内容类型');
    }

    const imageId = randomUUID();
    const fileName = `${imageId}.${extension}`;

    let storedOriginal: StoredImageInfo | undefined;
    try {
      storedOriginal = await persistImage(imageBuffer, fileName, 'original');
    } catch {
      throw new Error('图片生成失败：保存原图到本地时出错');
    }

    let generatedImage;
    try {
      generatedImage = await prisma.generatedImage.create({
        data: {
          id: imageId,
          projectId: projectId || null,
          sceneId: sceneId || null,
          characterId: characterId || null,
          prompt,
          modelProvider: provider.name,
          modelName: modelConfig.name,
          imageUrl: storedOriginal.publicPath,
          thumbnailUrl: null,
          metadata: JSON.stringify({
            size,
            providerId: provider.id,
            contentType,
            fileSize: imageBuffer.byteLength,
            ...(providerMetadata || {}),
          }),
        },
      });
    } catch (error) {
      await removeImageIfExists(storedOriginal?.publicPath);
      throw error;
    }

    await logger.info('图片生成完成', 'ai-image', { imageId });
    return NextResponse.json({
      success: true,
      imageUrl: generatedImage.imageUrl,
      thumbnailUrl: generatedImage.thumbnailUrl,
      id: generatedImage.id,
    });
  } catch (error) {

    await logger.error(
      `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'ai-image'
    );

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}

// 获取图片生成历史
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const sceneId = searchParams.get('sceneId');
    const characterId = searchParams.get('characterId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    if (characterId) {
      where.characterId = characterId;
    } else if (sceneId) {
      where.sceneId = sceneId;
    } else if (projectId) {
      where.projectId = projectId;
    }

    const images = await prisma.generatedImage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch image history' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少图片记录ID' }, { status: 400 });
    }

    const deleted = await prisma.generatedImage.delete({ where: { id } });

    try {
      await removeImageIfExists(deleted.imageUrl);
      await removeImageIfExists(deleted.thumbnailUrl);
    } catch (fileError) {
      await logger.warn(
        `删除图片文件失败: ${fileError instanceof Error ? fileError.message : '未知错误'}`,
        'ai-image'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    }
    const message =
      error instanceof Error ? error.message : 'Failed to delete image record';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ImageGenerationArgs = {
  provider: ModelProviderConfig;
  modelConfig: ProviderModelConfig;
  prompt: string;
  size: string;
  modelMetadata: Record<string, unknown>;
};

type ImageGenerationResult = {
  buffer: Buffer;
  contentType?: string;
  extension: string;
  metadata?: Record<string, unknown>;
};

async function generateImageFromProvider({
  provider,
  modelConfig,
  prompt,
  size,
  modelMetadata,
}: ImageGenerationArgs): Promise<ImageGenerationResult> {
  switch (provider.type) {
    case 'openai':
    case 'custom':
      return generateWithOpenAI({ provider, modelConfig, prompt, size, modelMetadata });
    case 'google-generative-ai':
      return generateWithGoogle({ provider, modelConfig, prompt, size, modelMetadata });
    case 'google-vertex':
      return generateWithVertex({ provider, modelConfig, prompt, size, modelMetadata });
    default:
      throw new Error(`当前图片生成暂不支持提供商类型: ${provider.type}`);
  }
}

async function generateWithOpenAI({
  provider,
  modelConfig,
  prompt,
  size,
  modelMetadata,
}: ImageGenerationArgs): Promise<ImageGenerationResult> {
  const openai = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    ...(customFetch ? { fetch: customFetch } : {}),
  });

  const normalizedFormat = normalizeOutputFormat(modelMetadata);
  const preferredResponseFormat = computePreferredResponseFormat(modelMetadata, 'url');

  const response = await openai.images.generate({
    model: modelConfig.name,
    prompt,
    n: 1,
    size,
    ...(preferredResponseFormat === 'b64_json'
      ? { response_format: 'b64_json' as const }
      : {}),
  });

  const imageData = response.data[0];
  if (!imageData) {
    throw new Error('图片生成失败：未返回图片数据');
  }

  let imageBuffer: Buffer;
  let contentType: string | undefined;
  let remoteImageUrl: string | null = null;

  if (preferredResponseFormat === 'b64_json') {
    const base64Payload = imageData.b64_json;
    if (!base64Payload) {
      throw new Error('图片生成失败：未返回 Base64 数据');
    }
    const format = normalizedFormat ?? 'png';
    imageBuffer = Buffer.from(base64Payload, 'base64');
    contentType = `image/${format}`;
  } else {
    remoteImageUrl = imageData.url ?? null;
    if (!remoteImageUrl) {
      throw new Error('图片生成失败：未返回图片URL');
    }

    const downloadResponse = await fetch(remoteImageUrl);
    if (!downloadResponse.ok) {
      throw new Error('图片生成失败：下载远程图片失败');
    }

    contentType = downloadResponse.headers.get('content-type') || undefined;
    imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  }

  const extension = preferredResponseFormat === 'b64_json'
    ? normalizedFormat ?? 'png'
    : resolveImageExtension(contentType);

  const metadata = sanitizeMetadataRecord({
    responseFormat: preferredResponseFormat,
    remoteUrl: remoteImageUrl ?? undefined,
  });

  return {
    buffer: imageBuffer,
    contentType,
    extension,
    metadata,
  };
}

async function generateWithGoogle({
  provider,
  modelConfig,
  prompt,
  size,
  modelMetadata,
}: ImageGenerationArgs): Promise<ImageGenerationResult> {
  const init: Record<string, unknown> = {
    ...(customFetch ? { fetch: customFetch } : {}),
  };

  if (provider.apiKey) {
    init.apiKey = provider.apiKey;
  }

  const baseURL = getMetadataString(provider.metadata, 'baseURL', 'baseUrl', 'endpoint') || provider.baseUrl;
  if (baseURL) {
    init.baseURL = baseURL;
  }

  const headers = sanitizeMetadataRecord(
    getMetadataObject(provider.metadata, 'headers', 'customHeaders')
  );
  if (headers && Object.keys(headers).length) {
    init.headers = headers;
  }

  const query = sanitizeMetadataRecord(
    getMetadataObject(provider.metadata, 'query', 'queryParams')
  );
  if (query && Object.keys(query).length) {
    init.query = query;
  }

  const googleProvider = createGoogleGenerativeAI(init as Parameters<typeof createGoogleGenerativeAI>[0]);
  const imageModel = googleProvider.image(modelConfig.name);

  const aspectRatio = toAspectRatio(size);
  const providerOptions =
    modelMetadata.providerOptions &&
    typeof modelMetadata.providerOptions === 'object' &&
    !Array.isArray(modelMetadata.providerOptions)
      ? sanitizeMetadataRecord(modelMetadata.providerOptions as Record<string, unknown>)
      : undefined;

  await logger.info('Generating image with Google Generative AI', 'info', {
    prompt,
    model: modelConfig.name,
    aspectRatio,
    baseURL, init,
    providerOptions,
    size,
    headers,
    modelMetadata: sanitizeMetadataRecord(modelMetadata),
  })

  const generation = await generateImage({
    model: imageModel,
    prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(providerOptions && Object.keys(providerOptions).length
      ? { providerOptions }
      : {}),
  });

  const primary = generation.image ?? generation.images?.[0];
  if (!primary) {
    throw new Error('图片生成失败：未返回图片数据');
  }

  const buffer = Buffer.from(primary);
  const format = normalizeOutputFormat(modelMetadata) ?? 'png';
  const contentType = `image/${format}`;
  const metadata = sanitizeMetadataRecord({
    providerMetadata: generation.providerMetadata,
  });

  return {
    buffer,
    contentType,
    extension: format,
    metadata,
  };
}

async function generateWithVertex({
  provider,
  modelConfig,
  prompt,
  size,
  modelMetadata,
}: ImageGenerationArgs): Promise<ImageGenerationResult> {
  const init = buildVertexInit(provider);
  const vertexProvider = createVertex(init as Parameters<typeof createVertex>[0]);
  const imageModel = vertexProvider.image(modelConfig.name);

  const aspectRatio = toAspectRatio(size);
  const providerOptions =
    modelMetadata.providerOptions &&
    typeof modelMetadata.providerOptions === 'object' &&
    !Array.isArray(modelMetadata.providerOptions)
      ? sanitizeMetadataRecord(modelMetadata.providerOptions as Record<string, unknown>)
      : undefined;

  const generation = await generateImage({
    model: imageModel,
    prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(providerOptions && Object.keys(providerOptions).length
      ? { providerOptions }
      : {}),
  });

  const primary = generation.image ?? generation.images?.[0];
  if (!primary) {
    throw new Error('图片生成失败：未返回图片数据');
  }

  const buffer = Buffer.from(primary);
  const format = normalizeOutputFormat(modelMetadata) ?? 'png';
  const contentType = `image/${format}`;
  const metadata = sanitizeMetadataRecord({
    providerMetadata: generation.providerMetadata,
  });

  return {
    buffer,
    contentType,
    extension: format,
    metadata,
  };
}

function normalizeOutputFormat(modelMetadata: Record<string, unknown>): string | undefined {
  const raw =
    typeof modelMetadata.outputFormat === 'string' && modelMetadata.outputFormat.trim()
      ? modelMetadata.outputFormat.trim().toLowerCase()
      : undefined;
  if (!raw) return undefined;
  return raw.startsWith('image/') ? raw.substring('image/'.length) : raw;
}

function computePreferredResponseFormat(
  modelMetadata: Record<string, unknown>,
  fallback: 'b64_json' | 'url'
): 'b64_json' | 'url' {
  const declared =
    typeof modelMetadata.responseFormat === 'string'
      ? modelMetadata.responseFormat.trim().toLowerCase()
      : undefined;
  if (declared === 'b64_json' || declared === 'url') {
    return declared;
  }
  return fallback;
}

function toAspectRatio(size: string | undefined): string | undefined {
  if (!size) return undefined;
  const [w, h] = size.split('x').map((value) => parseInt(value, 10));
  if (!w || !h) return undefined;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

function sanitizeMetadataRecord(
  record?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!record) return undefined;
  try {
    const serialized = JSON.stringify(record);
    if (!serialized) return undefined;
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
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

function getMetadataObject(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
): Record<string, unknown> | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return undefined;
}

function normalizePrivateKeyString(value?: string) {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

function buildVertexInit(provider: ModelProviderConfig): Record<string, unknown> {
  const metadata = (provider.metadata || {}) as Record<string, unknown>;
  const init: Record<string, unknown> = {
    ...(customFetch ? { fetch: customFetch } : {}),
  };

  const project = getMetadataString(
    metadata,
    'project',
    'vertexProject',
    'gcpProject',
    'googleProject'
  );
  if (project) {
    init.project = project;
  }

  const location = getMetadataString(
    metadata,
    'location',
    'vertexLocation',
    'gcpLocation',
    'googleLocation'
  );
  if (location) {
    init.location = location;
  }

  const baseURL = getMetadataString(metadata, 'baseURL', 'baseUrl', 'endpoint') || provider.baseUrl;
  if (baseURL) {
    init.baseURL = baseURL;
  }

  const headers = sanitizeMetadataRecord(getMetadataObject(metadata, 'headers', 'customHeaders'));
  if (headers && Object.keys(headers).length) {
    init.headers = headers;
  }

  const query = sanitizeMetadataRecord(getMetadataObject(metadata, 'query', 'queryParams'));
  if (query && Object.keys(query).length) {
    init.query = query;
  }

  const authOptions = getMetadataObject(metadata, 'googleAuthOptions', 'googleAuth');
  const credentials = getMetadataObject(metadata, 'credentials', 'googleCredentials');

  if (authOptions || credentials) {
    const options: Record<string, unknown> = authOptions ? { ...authOptions } : {};
    if (credentials && !options.credentials) {
      const clientEmail = getMetadataString(credentials, 'clientEmail', 'client_email');
      const privateKey = normalizePrivateKeyString(
        getMetadataString(credentials, 'privateKey', 'private_key')
      );
      if (clientEmail && privateKey) {
        options.credentials = {
          client_email: clientEmail,
          private_key: privateKey,
        } as Record<string, string>;
      }
    }

    const sanitized = sanitizeMetadataRecord(options);
    if (sanitized && Object.keys(sanitized).length) {
      init.googleAuthOptions = sanitized;
    }
  }

  return init;
}
