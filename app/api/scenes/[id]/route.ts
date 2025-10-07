import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 更新场景
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json();

    const scene = await prisma.scene.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.paintingPrompt !== undefined && {
          paintingPrompt: updates.paintingPrompt,
        }),
        ...(updates.backgroundImage !== undefined && {
          backgroundImage: updates.backgroundImage,
        }),
        ...(updates.backgroundThumbnail !== undefined && {
          backgroundThumbnail: updates.backgroundThumbnail,
        }),
      },
    });

    return NextResponse.json(scene);
  } catch {
    return NextResponse.json(
      { error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

// 删除场景
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.scene.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete scene' },
      { status: 500 }
    );
  }
}
