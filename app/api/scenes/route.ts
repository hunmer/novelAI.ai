import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取场景列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const scenes = await prisma.scene.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ scenes });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch scenes' },
      { status: 500 }
    );
  }
}

// 创建场景
export async function POST(req: NextRequest) {
  try {
    const {
      projectId,
      name,
      description,
      paintingPrompt,
      backgroundImage,
      backgroundThumbnail,
    } =
      await req.json();

    if (!projectId || !name) {
      return NextResponse.json(
        { error: 'projectId and name are required' },
        { status: 400 }
      );
    }

    const scene = await prisma.scene.create({
      data: {
        projectId,
        name,
        description: description || null,
        paintingPrompt: paintingPrompt || null,
        backgroundImage: backgroundImage || null,
        backgroundThumbnail: backgroundThumbnail || null,
      },
    });

    return NextResponse.json(scene);
  } catch {
    return NextResponse.json(
      { error: 'Failed to create scene' },
      { status: 500 }
    );
  }
}
