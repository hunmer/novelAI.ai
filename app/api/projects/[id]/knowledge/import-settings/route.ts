import { NextRequest, NextResponse } from 'next/server';
import { importProjectSettings } from '@/lib/actions/knowledge.actions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const options = await req.json();

    const { worldview, characters, scenes } = options;

    if (!worldview && !characters && !scenes) {
      return NextResponse.json(
        { error: '请至少选择一项内容进行导入' },
        { status: 400 }
      );
    }

    const result = await importProjectSettings(projectId, {
      worldview: Boolean(worldview),
      characters: Boolean(characters),
      scenes: Boolean(scenes),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入设定失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
