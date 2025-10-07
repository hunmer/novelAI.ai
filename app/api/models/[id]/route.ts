import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_MODEL_CAPABILITIES,
  ModelCapability,
  ModelProviderService,
  type ModelProviderConfig,
  type ProviderModelConfig,
} from '@/lib/ai/model-provider';

function isModelCapability(value: unknown): value is ModelCapability {
  return (
    typeof value === 'string' && ALL_MODEL_CAPABILITIES.includes(value as ModelCapability)
  );
}

function normalizeCapabilities(input: unknown): ModelCapability[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isModelCapability);
}

function normalizeModelsPayload(models: unknown): ProviderModelConfig[] {
  if (!Array.isArray(models)) return [];

  return models
    .map((item) => {
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
    .filter((value): value is ProviderModelConfig => !!value && !!value.name);
}

interface DefaultCapabilityPayload {
  model: string;
  capability: ModelCapability;
}

function isDefaultCapabilityPayload(value: unknown): value is DefaultCapabilityPayload {
  return (
    value !== null &&
    typeof value === 'object' &&
    'model' in value &&
    'capability' in value &&
    typeof (value as { model: unknown }).model === 'string' &&
    isModelCapability((value as { capability: unknown }).capability)
  );
}

/**
 * PATCH /api/models/[id] - 更新模型提供商
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { setDefaultCapability, unsetDefaultCapability, models, ...rest } = body;

    if (setDefaultCapability) {
      if (!isDefaultCapabilityPayload(setDefaultCapability)) {
        return NextResponse.json({ error: '无效的默认模型配置' }, { status: 400 });
      }
      const provider = await ModelProviderService.setDefaultCapability(
        id,
        setDefaultCapability.model,
        setDefaultCapability.capability
      );
      return NextResponse.json({ provider });
    }

    if (unsetDefaultCapability) {
      if (!isDefaultCapabilityPayload(unsetDefaultCapability)) {
        return NextResponse.json({ error: '无效的默认模型配置' }, { status: 400 });
      }
      const provider = await ModelProviderService.unsetDefaultCapability(
        id,
        unsetDefaultCapability.model,
        unsetDefaultCapability.capability
      );
      return NextResponse.json({ provider });
    }

    const updatePayload: Partial<ModelProviderConfig> = {
      ...(rest as Partial<ModelProviderConfig>),
    };

    if (models !== undefined) {
      updatePayload.models = normalizeModelsPayload(models);
    }

    const provider = await ModelProviderService.updateProvider(id, updatePayload);

    return NextResponse.json({ provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新模型提供商失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/models/[id] - 删除模型提供商
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await ModelProviderService.deleteProvider(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除模型提供商失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
