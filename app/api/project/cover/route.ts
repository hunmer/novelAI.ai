import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  persistImage,
  resolveImageExtension,
} from '@/lib/server/image-storage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '缺少封面文件' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = resolveImageExtension(file.type || undefined);
    const fileName = `${randomUUID()}.${extension}`;

    const stored = await persistImage(buffer, fileName, 'project-cover');

    return NextResponse.json({
      success: true,
      coverImage: stored.publicPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传封面失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
