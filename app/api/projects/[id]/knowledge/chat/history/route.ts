import { NextRequest, NextResponse } from 'next/server';
import {
  createKnowledgeChatSession,
  listKnowledgeChatSessions,
} from '@/lib/actions/knowledge.actions';
import { logger } from '@/lib/logger/client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const sessions = await listKnowledgeChatSessions(projectId);
    return NextResponse.json({ sessions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '获取知识库对话会话失败';
    await logger.error(message, 'knowledge-chat', { projectId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const { title }: { title?: string } = await req.json().catch(() => ({}));
    const session = await createKnowledgeChatSession(projectId, title);

    await logger.info('创建知识库对话会话', 'knowledge-chat', {
      projectId,
      sessionId: session.id,
      title: session.title,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '创建知识库对话会话失败';
    await logger.error(message, 'knowledge-chat', { projectId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
