import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  createEmptyPlotWorkflow,
  parsePlotMetadata,
  parsePlotWorkflow,
  serializePlotMetadata,
  serializePlotWorkflow,
} from '@/lib/utils/plot';
import type { PlotRecord } from '@/lib/types/plot';

const prisma = new PrismaClient();

function mapDialogToPlot(dialog: {
  id: string;
  projectId: string;
  content: string;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}): PlotRecord {
  return {
    id: dialog.id,
    projectId: dialog.projectId,
    workflow: parsePlotWorkflow(dialog.content),
    metadata: parsePlotMetadata(dialog.metadata),
    createdAt: dialog.createdAt.toISOString(),
    updatedAt: dialog.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const dialogs = await prisma.dialog.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });

    const plots = dialogs.map(mapDialogToPlot);

    return NextResponse.json({ plots });
  } catch (error) {
    console.error('加载剧情流程失败:', error);
    return NextResponse.json({ error: '加载剧情流程失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '未命名剧情';

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const workflow = createEmptyPlotWorkflow();
    const metadata = {
      title,
    };

    const dialog = await prisma.dialog.create({
      data: {
        projectId,
        content: serializePlotWorkflow(workflow),
        metadata: serializePlotMetadata(metadata),
      },
    });

    return NextResponse.json({ plot: mapDialogToPlot(dialog) });
  } catch (error) {
    console.error('创建剧情流程失败:', error);
    return NextResponse.json({ error: '创建剧情流程失败' }, { status: 500 });
  }
}
