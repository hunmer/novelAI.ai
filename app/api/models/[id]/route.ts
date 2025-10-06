import { NextRequest, NextResponse } from 'next/server';
import { ModelProviderService } from '@/lib/ai/model-provider';

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

    const provider = await ModelProviderService.updateProvider(id, body);

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
