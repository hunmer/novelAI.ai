import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const characters = await prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, attributes } = await req.json();

    const character = await prisma.character.create({
      data: {
        projectId,
        name,
        attributes,
      },
    });

    return NextResponse.json(character);
  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}
