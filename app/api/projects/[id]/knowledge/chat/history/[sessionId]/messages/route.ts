import { NextRequest, NextResponse } from 'next/server';
import {
  appendKnowledgeChatMessages,
  getKnowledgeChatMessages,
} from '@/lib/actions/knowledge.actions';
import { logger } from '@/lib/logger/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: projectId, sessionId } = await params;

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) || undefined : undefined;

  try {
    const messages = await getKnowledgeChatMessages(projectId, sessionId, limit);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '获取知识库对话消息失败';
    await logger.error(message, 'knowledge-chat', { projectId, sessionId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: projectId, sessionId } = await params;

  try {
    const {
      messages,
    }: {
      messages?: Array<{ id?: string; role: 'user' | 'assistant'; content: string }>;
    } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    await appendKnowledgeChatMessages(projectId, sessionId, messages);

    await logger.info('追加知识库对话消息', 'knowledge-chat', {
      projectId,
      sessionId,
      messageCount: messages.length,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '写入知识库对话消息失败';
    await logger.error(message, 'knowledge-chat', { projectId, sessionId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
