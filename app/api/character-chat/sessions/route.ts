import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    const characterId = req.nextUrl.searchParams.get('characterId');

    if (!characterId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    const sessions = await prisma.characterChatSession.findMany({
      where: { characterId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('获取对话会话失败:', error);
    return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { characterId, title } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: '缺少角色ID' }, { status: 400 });
    }

    const existingCharacter = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });

    if (!existingCharacter) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    const sessionTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : '新对话';

    const session = await prisma.characterChatSession.create({
      data: {
        characterId,
        title: sessionTitle,
      },
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('创建对话会话失败:', error);
    return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
  }
}
