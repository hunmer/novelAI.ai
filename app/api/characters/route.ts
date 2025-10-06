import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

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
