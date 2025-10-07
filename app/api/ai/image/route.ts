import { NextRequest, NextResponse } from 'next/server';
import { ModelProviderService } from '@/lib/ai/model-provider';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger/client';
import OpenAI from 'openai';
import { ProxyAgent } from 'undici';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const customFetch = proxyUrl
  ? async (url: RequestInfo | URL, init?: RequestInit) => {
      const dispatcher = new ProxyAgent(proxyUrl);
      return fetch(url, { ...init, dispatcher } as RequestInit);
    }
  : undefined;

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const snippetId = logger.startSnippet({
    snippet_id: `image-gen-${Date.now()}`,
    name: '图片生成',
  });

  try {
    const { prompt, providerId, model, projectId } = await req.json();

    if (snippetId) {
      await logger.logSnippet(
        `开始生成图片: ${prompt.substring(0, 50)}...`,
        snippetId,
        'ai-image'
      );
    }

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

    console.log({customFetch})
    // 使用 OpenAI SDK 生成图片
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      ...(customFetch ? { fetch: customFetch } : {}),
    });

    const response = await openai.images.generate({
      model: modelConfig.name,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('图片生成失败：未返回图片URL');
    }

    // 保存生成记录到数据库
    const generatedImage = await prisma.generatedImage.create({
      data: {
        projectId: projectId || null,
        prompt,
        modelProvider: provider.name,
        modelName: modelConfig.name,
        imageUrl,
        metadata: JSON.stringify({
          size: '1024x1024',
          providerId: provider.id,
        }),
      },
    });

    if (snippetId) {
      await logger.logSnippet('图片生成完成', snippetId, 'ai-image');
      await logger.endSnippet(snippetId);
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      id: generatedImage.id,
    });
  } catch (error) {
    if (snippetId) {
      await logger.logSnippet(
        `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        snippetId,
        'ai-image',
        { level: 'error' }
      );
      await logger.endSnippet(snippetId);
    }

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
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = projectId ? { projectId } : {};

    const images = await prisma.generatedImage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ images });
  } catch (_error) {
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

    await prisma.generatedImage.delete({ where: { id } });

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
