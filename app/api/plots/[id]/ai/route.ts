import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { embed } from 'ai';
import { AIClient } from '@/lib/ai/client';
import { getEmbeddingModel } from '@/lib/ai/dynamic-config';
import { searchKnowledgeEntries } from '@/lib/actions/knowledge.actions';
import {
  mergeMetadata,
  parsePlotMetadata,
  parsePlotWorkflow,
  serializePlotMetadata,
  serializePlotWorkflow,
  createPlotNode,
} from '@/lib/utils/plot';
import type {
  FlowgramChoicesSegment,
  FlowgramSegment,
  PlotMetadata,
  PlotRecord,
  PlotWorkflowState,
} from '@/lib/types/plot';

const prisma = new PrismaClient();

type Params = { params: Promise<{ id: string }> };

type GenerateBody = {
  prompt?: string;
  promptId?: string | null;
  wordBudget?: number;
  autoInsert?: boolean;
};

const WORD_BUDGET_MIN = 100;
const WORD_BUDGET_MAX = 100000;

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

function composeContext(metadata: PlotMetadata, workflow: PlotWorkflowState): string {
  const headerLines = [
    `当前剧情标题：${metadata.title}`,
  ];
  if (metadata.genre) headerLines.push(`类型：${metadata.genre}`);
  if (metadata.style) headerLines.push(`文风：${metadata.style}`);
  if (metadata.pov) headerLines.push(`视角：${metadata.pov}`);
  if (metadata.tags?.length) headerLines.push(`标签：${metadata.tags.join(', ')}`);

  const nodeLines = workflow.nodes.map((node, index) => {
    const order = index + 1;
    if (node.kind === 'dialogue') {
      const action = node.action ? `（${node.action}）` : '';
      return `${order}. 角色【${node.character ?? '未知角色'}】对话${action}：${node.text}`;
    }
    return `${order}. 旁白：${node.text}`;
  });

  return [
    headerLines.join('\n'),
    nodeLines.length ? ['已生成的剧情节点：', ...nodeLines].join('\n') : '当前无剧情节点。',
    '请基于现有剧情继续输出下一段发展。',
  ].join('\n\n');
}

function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    console.error('解析AI响应失败:', error, candidate);
    return [];
  }
}

function sanitizeSegments(value: unknown): FlowgramSegment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((segment): segment is FlowgramSegment => {
    return !!segment && typeof segment === 'object' && 'type' in segment;
  });
}

function nodesFromSegments(segments: FlowgramSegment[]) {
  return segments
    .map((segment) => {
      if (segment.type === 'narration') {
        return createPlotNode({
          kind: 'narration',
          text: segment.text,
        });
      }
      if (segment.type === 'dialogue') {
        return createPlotNode({
          kind: 'dialogue',
          text: segment.message,
          character: segment.character,
          action: segment.action,
        });
      }
      return null;
    })
    .filter((node): node is ReturnType<typeof createPlotNode> => node !== null);
}

function applySegments(
  metadata: PlotMetadata,
  workflow: PlotWorkflowState,
  segments: FlowgramSegment[],
  prompt: string,
  promptId?: string | null
) {
  const nodes = nodesFromSegments(segments);
  const choices = segments.filter(
    (segment): segment is FlowgramChoicesSegment => segment.type === 'choices'
  );
  const metaSegment = segments.find(
    (segment): segment is Extract<FlowgramSegment, { type: 'meta' }> => segment.type === 'meta'
  );

  const metadataPatch: Partial<PlotMetadata> = {
    lastPrompt: prompt,
    promptId: promptId ?? metadata.promptId ?? null,
    lastSegments: segments,
  };

  if (metaSegment) {
    metadataPatch.title = metaSegment.title || metadata.title;
    metadataPatch.genre = metaSegment.genre ?? metadata.genre;
    metadataPatch.style = metaSegment.style ?? metadata.style;
    metadataPatch.pov = metaSegment.pov ?? metadata.pov;
    metadataPatch.tags = metaSegment.tags ?? metadata.tags;
  }

  const nextMetadata = mergeMetadata(metadata, metadataPatch);
  const nextWorkflow: PlotWorkflowState = {
    nodes: [...workflow.nodes, ...nodes],
  };

  return {
    metadata: nextMetadata,
    workflow: nextWorkflow,
    appendedNodes: nodes,
    choices,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body: GenerateBody = await req.json();
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const autoInsert = body.autoInsert ?? true;
    const rawWordBudget = typeof body.wordBudget === 'number' ? body.wordBudget : 800;
    const wordBudget = Math.min(
      WORD_BUDGET_MAX,
      Math.max(WORD_BUDGET_MIN, Math.round(rawWordBudget))
    );

    const dialog = await prisma.dialog.findUnique({ where: { id } });
    if (!dialog) {
      return NextResponse.json({ error: '剧情不存在' }, { status: 404 });
    }

    const workflow = parsePlotWorkflow(dialog.content);
    const metadata = parsePlotMetadata(dialog.metadata);

    const embeddingInfo = await getEmbeddingModel();
    const { embedding } = await embed({
      model: embeddingInfo.model,
      value: prompt,
    });

    const embeddingVector = Array.from(embedding);

    const relatedEntries = embeddingVector.length
      ? await searchKnowledgeEntries(dialog.projectId, embeddingVector, 5)
      : [];

    const knowledgeContext = relatedEntries
      .map((entry, index) =>
        `知识库片段${index + 1} (相似度 ${entry.similarity.toFixed(3)}):\n${entry.content}`
      )
      .join('\n\n');

    const contextBlocks: string[] = [];
    if (knowledgeContext) {
      contextBlocks.push(`知识库检索结果：\n${knowledgeContext}`);
    }
    contextBlocks.push(composeContext(metadata, workflow));
    const context = contextBlocks.filter(Boolean).join('\n\n');

    const promptWithBudget = `目标字数：${wordBudget}\n${prompt}`;

    const aiResult = await AIClient.generate('plotFlow', promptWithBudget, context, {
      outputFormat: 'json',
    });

    const rawSegments = extractJsonArray(aiResult.text);
    const segments = sanitizeSegments(rawSegments);

    if (!segments.length) {
      return NextResponse.json(
        {
          error: 'AI 未返回有效剧情片段',
          aiText: aiResult.text,
        },
        { status: 502 }
      );
    }

    const { metadata: nextMetadata, workflow: nextWorkflow, appendedNodes, choices } = applySegments(
      metadata,
      workflow,
      segments,
      promptWithBudget,
      body.promptId
    );

    const workflowToPersist = autoInsert ? nextWorkflow : workflow;

    const updatedDialog = await prisma.dialog.update({
      where: { id },
      data: {
        content: serializePlotWorkflow(workflowToPersist),
        metadata: serializePlotMetadata(nextMetadata),
      },
    });

    return NextResponse.json({
      plot: mapDialogToPlot(updatedDialog),
      segments,
      appendedNodeIds: appendedNodes.map((node) => node.id),
      choices,
      usage: {
        tokens: aiResult.tokens,
        cost: aiResult.cost,
      },
    });
  } catch (error) {
    console.error('剧情生成失败:', error);
    return NextResponse.json({ error: '剧情生成失败' }, { status: 500 });
  }
}
