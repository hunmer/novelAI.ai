import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { FlowgramSegment, PlotMetadata, PlotNodeKind, PlotRecord, PlotWorkflowState } from '@/lib/types/plot';
import {
  createPlotNode,
  createEmptyPlotWorkflow,
  mergeMetadata,
  parsePlotMetadata,
  parsePlotWorkflow,
  serializePlotMetadata,
  serializePlotWorkflow,
} from '@/lib/utils/plot';

const prisma = new PrismaClient();

type PatchAction =
  | 'reset'
  | 'append-nodes'
  | 'update-metadata'
  | 'overwrite-workflow';

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

function normalizePatchAction(value: unknown): PatchAction | null {
  if (value === 'reset' || value === 'append-nodes' || value === 'update-metadata' || value === 'overwrite-workflow') {
    return value;
  }
  return null;
}

function buildNodes(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const candidate = raw as Record<string, unknown>;
      const kind: PlotNodeKind =
        candidate.kind === 'dialogue'
          ? 'dialogue'
          : candidate.kind === 'branch'
          ? 'branch'
          : 'narration';
      const rawText = candidate.text;
      const text = typeof rawText === 'string' ? rawText.trim() : '';
      if (kind !== 'branch' && !text) return null;
      const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
      const character = typeof candidate.character === 'string' ? candidate.character : undefined;
      const action = typeof candidate.action === 'string' ? candidate.action : undefined;
      const fromOptionId =
        typeof candidate.fromOptionId === 'string' || candidate.fromOptionId === null
          ? (candidate.fromOptionId as string | null)
          : undefined;
      const prompt =
        typeof candidate.prompt === 'string'
          ? candidate.prompt
          : candidate.prompt === null
          ? null
          : undefined;
      const createdAt =
        typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
          ? candidate.createdAt
          : undefined;
      return createPlotNode({
        id,
        kind,
        text,
        character,
        action,
        fromOptionId,
        prompt,
        createdAt,
      });
    })
    .filter((node): node is ReturnType<typeof createPlotNode> => node !== null);
}

function buildWorkflow(input: unknown): PlotWorkflowState | null {
  if (!input || typeof input !== 'object') return null;
  const workflowCandidate = input as { nodes?: unknown };
  const nodes = buildNodes(workflowCandidate.nodes ?? []);
  return { nodes } satisfies PlotWorkflowState;
}

function sanitizeMetadataPatch(input: unknown): Partial<PlotMetadata> {
  if (!input || typeof input !== 'object') return {};
  const candidate = input as Record<string, unknown>;
  const result: Partial<PlotMetadata> = {};
  if (typeof candidate.title === 'string') {
    result.title = candidate.title.trim() || '未命名剧情';
  }
  if (typeof candidate.genre === 'string') {
    result.genre = candidate.genre;
  }
  if (typeof candidate.style === 'string') {
    result.style = candidate.style;
  }
  if (typeof candidate.pov === 'string') {
    result.pov = candidate.pov;
  }
  if (Array.isArray(candidate.tags)) {
    result.tags = candidate.tags.filter(
      (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
    );
  }
  if (typeof candidate.promptId === 'string' || candidate.promptId === null) {
    result.promptId = candidate.promptId ?? null;
  }
  if (typeof candidate.lastPrompt === 'string' || candidate.lastPrompt === null) {
    result.lastPrompt = candidate.lastPrompt ?? null;
  }
  if (Array.isArray(candidate.lastSegments)) {
    result.lastSegments = candidate.lastSegments.filter(
      (segment): segment is FlowgramSegment =>
        !!segment && typeof segment === 'object' && 'type' in segment
    );
  }
  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dialog = await prisma.dialog.findUnique({ where: { id } });
    if (!dialog) {
      return NextResponse.json({ error: '剧情不存在' }, { status: 404 });
    }
    return NextResponse.json({ plot: mapDialogToPlot(dialog) });
  } catch (error) {
    console.error('获取剧情失败:', error);
    return NextResponse.json({ error: '获取剧情失败' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = normalizePatchAction(body?.action);

    if (!action) {
      return NextResponse.json({ error: '未知的操作类型' }, { status: 400 });
    }

    const dialog = await prisma.dialog.findUnique({ where: { id } });
    if (!dialog) {
      return NextResponse.json({ error: '剧情不存在' }, { status: 404 });
    }

    let workflow = parsePlotWorkflow(dialog.content);
    let metadata = parsePlotMetadata(dialog.metadata);
    let workflowChanged = false;
    let metadataChanged = false;

    if (action === 'reset') {
      workflow = createEmptyPlotWorkflow();
      metadata = mergeMetadata(metadata, { lastSegments: [] });
      workflowChanged = true;
      metadataChanged = true;
    }

    if (action === 'append-nodes') {
      const nodes = buildNodes(body?.nodes);
      if (!nodes.length) {
        return NextResponse.json({ error: '缺少有效的节点信息' }, { status: 400 });
      }
      workflow = {
        nodes: [...workflow.nodes, ...nodes],
      } satisfies PlotWorkflowState;
      workflowChanged = true;

      if (Array.isArray(body?.lastSegments)) {
        metadata = mergeMetadata(metadata, {
          lastSegments: body.lastSegments.filter(
            (segment: unknown): segment is FlowgramSegment =>
              !!segment && typeof segment === 'object' && 'type' in segment
          ),
        });
        metadataChanged = true;
      }
    }

    if (action === 'update-metadata') {
      const metadataPatch = sanitizeMetadataPatch(body?.metadata);
      metadata = mergeMetadata(metadata, metadataPatch);
      metadataChanged = true;
    }

    if (action === 'overwrite-workflow') {
      const newWorkflow = buildWorkflow(body?.workflow);
      if (!newWorkflow) {
        return NextResponse.json({ error: '无效的工作流数据' }, { status: 400 });
      }
      workflow = newWorkflow;
      workflowChanged = true;

      if (Array.isArray(body?.lastSegments)) {
        metadata = mergeMetadata(metadata, {
          lastSegments: body.lastSegments.filter(
            (segment: unknown): segment is FlowgramSegment =>
              !!segment && typeof segment === 'object' && 'type' in segment
          ),
        });
        metadataChanged = true;
      }
    }

    const updateData: { content?: string; metadata?: string } = {};
    if (workflowChanged) {
      updateData.content = serializePlotWorkflow(workflow);
    }
    if (metadataChanged) {
      updateData.metadata = serializePlotMetadata(metadata);
    }

    if (!updateData.content && !updateData.metadata) {
      return NextResponse.json({ plot: mapDialogToPlot(dialog) });
    }

    const updatedDialog = await prisma.dialog.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ plot: mapDialogToPlot(updatedDialog) });
  } catch (error) {
    console.error('更新剧情失败:', error);
    return NextResponse.json({ error: '更新剧情失败' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dialog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除剧情失败:', error);
    return NextResponse.json({ error: '删除剧情失败' }, { status: 500 });
  }
}
