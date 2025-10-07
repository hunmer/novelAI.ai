import { NextRequest, NextResponse } from 'next/server';
import {
  ModelProviderService,
  type ProviderModelConfig,
  type ModelCapability,
  ALL_MODEL_CAPABILITIES,
} from '@/lib/ai/model-provider';
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
function normalizeCapabilities(input: unknown): ModelCapability[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is ModelCapability =>
    typeof value === 'string' && ALL_MODEL_CAPABILITIES.includes(value as ModelCapability)
  );
}

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

    if (!name || !type || !apiKey) {
      return NextResponse.json(
        { error: '缺少必需字段: name, type, apiKey' },
        { status: 400 }
      );
    }

    const normalizedModels: ProviderModelConfig[] = Array.isArray(models)
      ? models
          .map((item: unknown) => {
            if (typeof item === 'string') {
              return { name: item, capabilities: ['text'] } satisfies ProviderModelConfig;
            }
            if (!item || typeof item !== 'object') {
              return null;
            }

            const record = item as Record<string, unknown>;

            return {
              name: typeof record.name === 'string' ? record.name : '',
              label: typeof record.label === 'string' ? record.label : undefined,
              description:
                typeof record.description === 'string' ? record.description : undefined,
              capabilities: normalizeCapabilities(record.capabilities),
              defaultFor: normalizeCapabilities(record.defaultFor),
              metadata:
                record.metadata && typeof record.metadata === 'object'
                  ? (record.metadata as Record<string, unknown>)
                  : undefined,
            } satisfies ProviderModelConfig;
          })
          .filter((value): value is ProviderModelConfig => !!value && !!value.name)
      : [];

    if (!normalizedModels.length) {
      return NextResponse.json(
        { error: '至少需要配置一个模型' },
        { status: 400 }
      );
    }

    const provider = await ModelProviderService.addProvider({
      name,
      type,
      apiKey,
      baseUrl,
      models: normalizedModels,
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
