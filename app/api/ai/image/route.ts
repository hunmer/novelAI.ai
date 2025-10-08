import { NextRequest, NextResponse } from 'next/server';
import {
  ModelProviderService,
  type ModelProviderConfig,
  type ProviderModelConfig,
} from '@/lib/ai/model-provider';
import { resolveRequestHeaders } from '@/lib/ai/dynamic-config';
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
          ...dispatcher,
        },
      });
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

const prisma = new PrismaClient();
const METACHAT_DEFAULT_BASE_URL = 'https://api.mmchat.xyz/open/v1';

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

    const where: Prisma.GeneratedImageWhereInput = {};
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
    case 'metachat-mj':
      return generateWithMetaChatMidjourney({
        provider,
        modelConfig,
        prompt,
        size,
        modelMetadata,
      });
    case 'metachat-flux':
      return generateWithMetaChatFlux({
        provider,
        modelConfig,
        prompt,
        size,
        modelMetadata,
      });
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
  const defaultHeaders = resolveRequestHeaders(provider, modelConfig);
  const openai = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    ...(Object.keys(defaultHeaders).length ? { defaultHeaders } : {}),
    ...(customFetch ? { fetch: customFetch } : {}),
  });

  const normalizedFormat = normalizeOutputFormat(modelMetadata);
  const preferredResponseFormat = computePreferredResponseFormat(modelMetadata, 'url');

  const requestPayload: Parameters<typeof openai.images.generate>[0] = {
    model: modelConfig.name,
    prompt,
    n: 1,
    ...(preferredResponseFormat === 'b64_json'
      ? { response_format: 'b64_json' as const }
      : {}),
  };

  if (typeof size === 'string' && size.trim()) {
    (requestPayload as Record<string, unknown>).size = size;
  }

  const response = await openai.images.generate(requestPayload);

  const imageData = response.data?.[0];
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

  const combinedHeaders = resolveRequestHeaders(provider, modelConfig);
  if (Object.keys(combinedHeaders).length) {
    init.headers = combinedHeaders;
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
  const aspectRatioForRequest = aspectRatio as `${number}:${number}` | undefined;
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
    baseURL,
    init,
    providerOptions,
    size,
    headers: combinedHeaders,
    modelMetadata: sanitizeMetadataRecord(modelMetadata),
  });

  try {
    const generation = await generateImage({
      model: imageModel,
      prompt,
      ...(aspectRatioForRequest ? { aspectRatio: aspectRatioForRequest } : {}),
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logger.warn('Google Generative AI 图片生成失败，尝试 generateContent 兼容模式', 'ai-image', {
      error: message,
      model: modelConfig.name,
    });

    return await generateGeminiImageViaGenerateContent({
      provider,
      modelConfig,
      modelMetadata,
      prompt,
      aspectRatio: aspectRatioForRequest,
      providerOptions,
      headers: combinedHeaders,
      baseURL,
      query,
    });
  }
}

async function generateWithMetaChatMidjourney(args: ImageGenerationArgs): Promise<ImageGenerationResult> {
  return generateWithMetaChatBase(args, {
    providerLabel: 'MetaChat Midjourney',
    creationPath: 'midjourney/imagine',
    resultPath: (taskId) => `midjourney/result/${taskId}`,
    metadataProvider: 'metachat-mj',
    extractImageUrl: (data) => {
      const direct = typeof data['image_url'] === 'string' && (data['image_url'] as string).trim()
        ? (data['image_url'] as string)
        : undefined;
      if (direct) return direct;
      const imageUrls = Array.isArray(data['image_urls']) ? (data['image_urls'] as unknown[]) : [];
      const candidate = imageUrls.find((item) => typeof item === 'string' && item.trim()) as string | undefined;
      if (typeof candidate === 'string') return candidate;
      return undefined;
    },
  });
}

type GeminiGenerateContentArgs = {
  provider: ModelProviderConfig;
  modelConfig: ProviderModelConfig;
  modelMetadata: Record<string, unknown>;
  prompt: string;
  aspectRatio?: `${number}:${number}`;
  providerOptions?: Record<string, unknown>;
  headers: Record<string, string>;
  baseURL?: string;
  query?: Record<string, unknown>;
};

async function generateGeminiImageViaGenerateContent(
  args: GeminiGenerateContentArgs
): Promise<ImageGenerationResult> {
  const {
    provider,
    modelConfig,
    modelMetadata,
    prompt,
    aspectRatio,
    providerOptions,
    headers,
    baseURL,
    query,
  } = args;

  const fetchImpl = customFetch ?? fetch;
  const format = normalizeOutputFormat(modelMetadata) ?? 'png';
  const effectiveBaseUrl = normalizeBaseUrl(
    baseURL || 'https://generativelanguage.googleapis.com/v1beta'
  );

  const endpoint = new URL(
    `models/${modelConfig.name}:generateContent`,
    `${effectiveBaseUrl}/`
  );

  const queryRecord = toStringRecord(query as Record<string, unknown> | undefined);
  for (const [key, value] of Object.entries(queryRecord)) {
    endpoint.searchParams.set(key, value);
  }

  const requestHeaders: Record<string, string> = {
    'content-type': 'application/json',
  };
  for (const [key, value] of Object.entries(headers)) {
    requestHeaders[key] = value;
  }

  const hasApiKeyHeader = Object.keys(requestHeaders).some(
    (key) => key.toLowerCase() === 'x-goog-api-key'
  );
  if (!hasApiKeyHeader && provider.apiKey) {
    requestHeaders['x-goog-api-key'] = provider.apiKey;
  }

  const config: Record<string, unknown> = {
    response_mime_type: `image/${format}`,
  };
  if (aspectRatio) {
    config.image_config = { aspect_ratio: aspectRatio };
  }

  if (providerOptions && Object.keys(providerOptions).length) {
    const { aspectRatio: overriddenAspectRatio, ...rest } = providerOptions;
    if (overriddenAspectRatio && typeof overriddenAspectRatio === 'string') {
      config.image_config = {
        aspect_ratio: overriddenAspectRatio as `${number}:${number}`,
      };
    }
    if (Object.keys(rest).length) {
      Object.assign(config, rest);
    }
  }

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: [
        "TEXT",
        "IMAGE"
      ]
    },
    ...(Object.keys(config).length ? { config } : {}),
  };

  const response = await fetchImpl(endpoint.toString(), {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Gemini generateContent 请求失败 (${response.status}): ${raw || response.statusText}`
    );
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Gemini generateContent 响应解析失败: ${(error as Error).message}`);
  }

  const inlinePayload = extractGeminiInlineImage(parsed);
  if (!inlinePayload) {
    throw new Error('Gemini generateContent 未返回图片数据');
  }

  const buffer = Buffer.from(inlinePayload.data, 'base64');
  const contentType = inlinePayload.mimeType || `image/${format}`;
  const metadata = sanitizeMetadataRecord({ providerMetadata: parsed });

  return {
    buffer,
    contentType,
    extension: format,
    metadata,
  };
}

interface GeminiInlineData {
  data: string;
  mimeType?: string;
  mime_type?: string;
}

function extractGeminiInlineImage(payload: unknown):
  | GeminiInlineData
  | undefined {
  const candidates = payload?.candidates;
  if (!Array.isArray(candidates)) return undefined;

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      const inline =
        part?.inlineData ||
        part?.inline_data ||
        part?.fileData ||
        part?.file_data ||
        part?.media;
      if (inline && typeof inline.data === 'string' && inline.data.trim()) {
        return {
          data: inline.data,
          mimeType: inline.mimeType || inline.mime_type,
        };
      }
    }
  }

  return undefined;
}

async function generateWithMetaChatFlux(args: ImageGenerationArgs): Promise<ImageGenerationResult> {
  return generateWithMetaChatBase(args, {
    providerLabel: 'MetaChat Flux',
    creationPath: 'flux/generate',
    resultPath: (taskId) => `flux/result/${taskId}`,
    metadataProvider: 'metachat-flux',
    extractImageUrl: (data) => {
      const imageUrls = Array.isArray(data['image_urls']) ? (data['image_urls'] as unknown[]) : [];
      const candidate = imageUrls.find((item) => typeof item === 'string' && item.trim()) as string | undefined;
      if (typeof candidate === 'string') return candidate;
      return undefined;
    },
  });
}

type MetaChatProfile = {
  providerLabel: string;
  creationPath: string;
  resultPath: (taskId: string) => string;
  metadataProvider: string;
  extractImageUrl: (data: Record<string, unknown>) => string | undefined;
};

type MetaChatCreationData = {
  id: string;
  prompt?: string;
  model?: string;
  mode?: string;
  [key: string]: unknown;
};

async function generateWithMetaChatBase(
  { provider, modelConfig, prompt, size, modelMetadata }: ImageGenerationArgs,
  profile: MetaChatProfile
): Promise<ImageGenerationResult> {
  // 统一处理 MetaChat 任务的创建、轮询和结果下载，避免 MJ 与 FLUX 逻辑重复。
  const metaConfig = resolveMetaChatConfig(provider, modelConfig, modelMetadata, profile.providerLabel);
  const aspectRatio = toAspectRatio(size);
  const params = buildMetaChatParams(modelMetadata, provider.metadata, aspectRatio);

  const payload: {
    prompt: string;
    model?: string;
    params?: Record<string, unknown>;
    images?: Array<Record<string, unknown>>;
  } = {
    prompt,
    model:
      typeof modelMetadata.model === 'string' && modelMetadata.model.trim()
        ? (modelMetadata.model as string)
        : modelConfig.name,
  };

  if (params) {
    payload.params = params;
  }

  const referenceImages = buildMetaChatImages(modelMetadata);
  if (referenceImages.length) {
    payload.images = referenceImages;
  }

  await logger.info(`${profile.providerLabel} 创建任务`, 'ai-image', {
    providerId: provider.id,
    model: payload.model,
    params,
    hasReferenceImages: referenceImages.length > 0,
  });

  const creation = await metaChatJsonRequest<MetaChatCreationData>(metaConfig, profile.creationPath, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (creation.envelope.status !== 'Success' || !creation.envelope.data) {
    throw new Error(creation.envelope.message || `${profile.providerLabel} 任务创建失败`);
  }

  const taskId = creation.envelope.data.id;
  const encodedTaskId = encodeURIComponent(taskId);
  const result = await pollMetaChatTask(metaConfig, profile.resultPath(encodedTaskId), {
    providerLabel: profile.providerLabel,
  });

  const taskData = result.envelope.data;
  if (!taskData || typeof taskData !== 'object') {
    throw new Error(`${profile.providerLabel} 返回数据为空`);
  }

  const normalizedTask = taskData;
  const taskStatus = typeof normalizedTask.status === 'string' ? normalizedTask.status.toLowerCase() : '';

  if (taskStatus !== 'success') {
    throw new Error(`${profile.providerLabel} 任务未成功结束，当前状态: ${normalizedTask.status}`);
  }

  const imageUrl = profile.extractImageUrl(normalizedTask);
  if (!imageUrl) {
    throw new Error(`${profile.providerLabel} 任务未返回图片 URL`);
  }

  const asset = await downloadMetaChatAsset(metaConfig, imageUrl);
  const metadata = sanitizeMetadataRecord({
    task: taskData,
    response: creation.envelope,
    provider: profile.metadataProvider,
  });

  return {
    buffer: asset.buffer,
    contentType: asset.contentType,
    extension: resolveImageExtension(asset.contentType),
    metadata,
  };
}

type MetaChatEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
};

type MetaChatConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  pollIntervalMs: number;
  maxAttempts: number;
  fetchImpl: typeof fetch;
};

function resolveMetaChatConfig(
  provider: ModelProviderConfig,
  modelConfig: ProviderModelConfig,
  modelMetadata: Record<string, unknown>,
  providerLabel: string
): MetaChatConfig {
  const providerMetadata = (provider.metadata || {}) as Record<string, unknown>;
  const apiKey = provider.apiKey || getMetadataString(providerMetadata, 'apiKey', 'token');
  if (!apiKey) {
    throw new Error(`${providerLabel} 提供商缺少 API Key`);
  }

  const appId =
    getMetadataString(modelMetadata, 'appId', 'appID', 'appid', 'app-id') ??
    getMetadataString(providerMetadata, 'appId', 'appID', 'appid', 'app-id');
  if (!appId) {
    throw new Error(`${providerLabel} 提供商缺少 App ID`);
  }

  const baseUrl = normalizeBaseUrl(
    getMetadataString(modelMetadata, 'baseURL', 'baseUrl', 'endpoint') ??
      getMetadataString(providerMetadata, 'baseURL', 'baseUrl', 'endpoint') ??
      provider.baseUrl ??
      METACHAT_DEFAULT_BASE_URL
  );

  const headers: Record<string, string> = {
    ...resolveRequestHeaders(provider, modelConfig),
  };

  const hasContentType = Object.keys(headers).some(
    (key) => key.toLowerCase() === 'content-type'
  );
  if (!hasContentType) {
    headers['Content-Type'] = 'application/json';
  }

  headers.Authorization = `Bearer ${apiKey}`;
  headers['X-App-ID'] = appId;

  const providerQuery = toStringRecord(
    sanitizeMetadataRecord(getMetadataObject(providerMetadata, 'query', 'queryParams'))
  );
  const modelQuery = toStringRecord(
    sanitizeMetadataRecord(getMetadataObject(modelMetadata, 'query', 'queryParams'))
  );

  const pollIntervalMs =
    toPositiveInteger(
      getMetadataNumber(modelMetadata, 'pollIntervalMs', 'pollInterval') ??
        getMetadataNumber(providerMetadata, 'pollIntervalMs', 'pollInterval')
    ) ?? 5_000;

  const maxAttempts =
    toPositiveInteger(
      getMetadataNumber(modelMetadata, 'pollMaxAttempts', 'pollAttempts', 'maxPollAttempts') ??
        getMetadataNumber(providerMetadata, 'pollMaxAttempts', 'pollAttempts', 'maxPollAttempts')
    ) ?? 60;

  return {
    baseUrl,
    headers,
    query: { ...providerQuery, ...modelQuery },
    pollIntervalMs,
    maxAttempts,
    fetchImpl: customFetch ?? fetch,
  };
}

async function metaChatJsonRequest<T>(
  config: MetaChatConfig,
  path: string,
  init: RequestInit
): Promise<{ envelope: MetaChatEnvelope<T> }> {
  const url = buildMetaChatUrl(config.baseUrl, path, config.query);
  const response = await config.fetchImpl(url.toString(), {
    headers: config.headers,
    ...init,
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `MetaChat 请求失败 (${response.status}): ${raw || response.statusText}`
    );
  }

  let envelope: MetaChatEnvelope<T>;
  try {
    envelope = raw ? (JSON.parse(raw) as MetaChatEnvelope<T>) : {};
  } catch (error) {
    throw new Error(`MetaChat 响应解析失败: ${(error as Error).message}`);
  }

  return { envelope };
}

async function pollMetaChatTask<T extends { status?: string }>(
  config: MetaChatConfig,
  path: string,
  options: { providerLabel: string }
): Promise<{ envelope: MetaChatEnvelope<T> }> {
  let attempt = 0;
  let lastStatus: string | undefined;

  while (attempt < config.maxAttempts) {
    attempt += 1;
    const result = await metaChatJsonRequest<T>(config, path, { method: 'GET' });
    const envelope = result.envelope;

    if (envelope.status !== 'Success') {
      throw new Error(envelope.message || `${options.providerLabel} 返回失败`);
    }

    const data = envelope.data;
    if (!data) {
      throw new Error(`${options.providerLabel} 返回数据为空`);
    }

    const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
    if (status && status !== lastStatus) {
      lastStatus = status;
      await logger.debug(`${options.providerLabel} 任务状态更新`, 'ai-image', {
        status,
        attempt,
        taskId: data.id,
      });
    }

    if (status === 'success') {
      return result;
    }
    if (status === 'failure') {
      const reason = (data as Record<string, unknown>).fail_reason;
      throw new Error(
        typeof reason === 'string' && reason.trim()
          ? reason
          : `${options.providerLabel} 任务执行失败`
      );
    }

    await sleep(config.pollIntervalMs);
  }

  throw new Error(`${options.providerLabel} 任务轮询超时`);
}

function buildMetaChatParams(
  modelMetadata: Record<string, unknown>,
  providerMetadata: Record<string, unknown> | undefined,
  aspectRatio?: string
): Record<string, unknown> | undefined {
  const providerParams = sanitizeMetadataRecord(
    getMetadataObject(providerMetadata, 'params', 'defaultParams')
  );
  const modelParams = sanitizeMetadataRecord(
    getMetadataObject(modelMetadata, 'params', 'defaultParams')
  );

  const merged: Record<string, unknown> = {
    ...(providerParams || {}),
    ...(modelParams || {}),
  };

  if (aspectRatio && !merged.aspect) {
    merged.aspect = aspectRatio;
  }

  const cleanedEntries = Object.entries(merged).filter(([, value]) => value !== undefined && value !== null);
  return cleanedEntries.length ? Object.fromEntries(cleanedEntries) : undefined;
}

function buildMetaChatImages(modelMetadata: Record<string, unknown>): Array<Record<string, unknown>> {
  const source = modelMetadata.images ?? modelMetadata.referenceImages;
  let normalized: unknown;

  if (typeof source === 'string' && source.trim()) {
    try {
      normalized = JSON.parse(source.trim());
    } catch {
      normalized = undefined;
    }
  } else {
    normalized = source;
  }

  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => sanitizeMetadataRecord(item as Record<string, unknown>))
    .filter((item): item is Record<string, unknown> => !!item);
}

async function downloadMetaChatAsset(config: MetaChatConfig, url: string) {
  const response = await config.fetchImpl(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type') ?? guessContentTypeFromUrl(url);
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

function buildMetaChatUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string>
): URL {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function toStringRecord(record?: Record<string, unknown> | null): Record<string, string> {
  if (!record) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      if (value.trim()) result[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    }
  }
  return result;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function toPositiveInteger(value?: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : undefined;
}

function guessContentTypeFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    const idx = lastSegment.lastIndexOf('.');
    if (idx === -1) return undefined;
    const ext = lastSegment.substring(idx + 1).toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

async function generateWithVertex({
  provider,
  modelConfig,
  prompt,
  size,
  modelMetadata,
}: ImageGenerationArgs): Promise<ImageGenerationResult> {
  const init = buildVertexInit(provider, modelConfig);
  const vertexProvider = createVertex(init as Parameters<typeof createVertex>[0]);
  const imageModel = vertexProvider.image(modelConfig.name);

  const aspectRatio = toAspectRatio(size);
  const aspectRatioForRequest = aspectRatio as `${number}:${number}` | undefined;
  const providerOptions =
    modelMetadata.providerOptions &&
    typeof modelMetadata.providerOptions === 'object' &&
    !Array.isArray(modelMetadata.providerOptions)
      ? sanitizeMetadataRecord(modelMetadata.providerOptions as Record<string, unknown>)
      : undefined;

  const generation = await generateImage({
    model: imageModel,
    prompt,
    ...(aspectRatioForRequest ? { aspectRatio: aspectRatioForRequest } : {}),
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

function getMetadataNumber(
  source: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
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

function buildVertexInit(
  provider: ModelProviderConfig,
  modelConfig: ProviderModelConfig
): Record<string, unknown> {
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

  const combinedHeaders = resolveRequestHeaders(provider, modelConfig);
  if (Object.keys(combinedHeaders).length) {
    init.headers = combinedHeaders;
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

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs));
}
