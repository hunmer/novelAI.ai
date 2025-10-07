import { NextRequest, NextResponse } from 'next/server';
import { ModelProviderService } from '@/lib/ai/model-provider';
import { getAllAvailableModels } from '@/lib/ai/dynamic-config';

/**
 * GET /api/models - 获取所有模型提供商
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const listAvailable = searchParams.get('listAvailable') === 'true';

    if (listAvailable) {
      // 返回所有可用模型列表
      const models = await getAllAvailableModels();
      return NextResponse.json({ models });
    }

    const providers = includeInactive
      ? await ModelProviderService.getAllProviders()
      : await ModelProviderService.getActiveProviders();

    return NextResponse.json({ providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取模型提供商失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/models - 添加新的模型提供商
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      type,
      apiKey,
      baseUrl,
      models,
      isDefault,
      capability,
      metadata,
    } = body;

    if (!name || !type || !apiKey || !models || !Array.isArray(models)) {
      return NextResponse.json(
        { error: '缺少必需字段: name, type, apiKey, models' },
        { status: 400 }
      );
    }

    const provider = await ModelProviderService.addProvider({
      name,
      type,
      apiKey,
      baseUrl,
      models,
      isDefault: isDefault || false,
      capability,
      metadata: metadata || {},
    });

    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '添加模型提供商失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
