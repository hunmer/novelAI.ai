import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  persistImage,
  removeImageIfExists,
  resolveImageExtension,
} from '@/lib/server/image-storage';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageId = formData.get('imageId');
    const thumbnailFile = formData.get('thumbnail');

    if (typeof imageId !== 'string') {
      return NextResponse.json({ error: '缺少图片ID' }, { status: 400 });
    }

    if (!(thumbnailFile instanceof File)) {
      return NextResponse.json({ error: '缺少缩略图文件' }, { status: 400 });
    }

    const existing = await prisma.generatedImage.findUnique({
      where: { id: imageId },
      select: { thumbnailUrl: true },
    });

    if (!existing) {
      return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    }

    const arrayBuffer = await thumbnailFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = resolveImageExtension(thumbnailFile.type || undefined);
    const fileName = `${imageId}.${extension}`;

    if (existing.thumbnailUrl) {
      await removeImageIfExists(existing.thumbnailUrl);
    }

    const storedThumbnail = await persistImage(buffer, fileName, 'thumbnail');

    const updated = await prisma.generatedImage.update({
      where: { id: imageId },
      data: { thumbnailUrl: storedThumbnail.publicPath },
      select: { id: true, thumbnailUrl: true },
    });

    return NextResponse.json({
      success: true,
      thumbnailUrl: updated.thumbnailUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '保存缩略图失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
