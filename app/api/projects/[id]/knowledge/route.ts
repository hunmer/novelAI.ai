import { NextRequest, NextResponse } from 'next/server';
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  listKnowledgeEntries,
  updateKnowledgeEntry,
} from '@/lib/actions/knowledge.actions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const entries = await listKnowledgeEntries(projectId);
    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取知识库失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { content, metadata } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content 字段不能为空' },
        { status: 400 }
      );
    }

    const entry = await createKnowledgeEntry(projectId, content, metadata);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存知识库失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { entryId, content, metadata } = await req.json();

    if (!entryId || typeof entryId !== 'string') {
      return NextResponse.json(
        { error: 'entryId 字段不能为空' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content 字段不能为空' },
        { status: 400 }
      );
    }

    const entry = await updateKnowledgeEntry(projectId, entryId, content, metadata);
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新知识库失败';
    const status = message.includes('不存在') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entryId');

    if (!entryId) {
      return NextResponse.json({ error: '缺少 entryId 参数' }, { status: 400 });
    }

    await deleteKnowledgeEntry(entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除知识库失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
