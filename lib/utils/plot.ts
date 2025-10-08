import type {
  FlowgramSegment,
  PlotMetadata,
  PlotNode,
  PlotWorkflowState,
} from '@/lib/types/plot';

function generateNodeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function sanitizeNodes(nodes: unknown): PlotNode[] {
  if (!Array.isArray(nodes)) return [];

  return nodes
    .filter((node): node is Record<string, unknown> => typeof node === 'object' && node !== null)
    .map((node) => {
      const kind = node.kind === 'dialogue' ? 'dialogue' : 'narration';
      const text = typeof node.text === 'string' ? node.text : '';
      const character = typeof node.character === 'string' ? node.character : undefined;
      const action = typeof node.action === 'string' ? node.action : undefined;
      const fromOptionId =
        typeof node.fromOptionId === 'string' || node.fromOptionId === null
          ? node.fromOptionId
          : undefined;
      const createdAt = typeof node.createdAt === 'string' ? node.createdAt : new Date().toISOString();

      return {
        id: typeof node.id === 'string' && node.id.trim() ? node.id : generateNodeId(),
        kind,
        text,
        character,
        action,
        fromOptionId: fromOptionId ?? null,
        createdAt,
      } satisfies PlotNode;
    });
}

export function parsePlotWorkflow(content: string | null | undefined): PlotWorkflowState {
  const parsed = safeParseJson<{ nodes?: unknown }>(content, { nodes: [] });
  return {
    nodes: sanitizeNodes(parsed.nodes ?? []),
  } satisfies PlotWorkflowState;
}

export function parsePlotMetadata(metadata: string | null | undefined): PlotMetadata {
  const parsed = safeParseJson<Partial<PlotMetadata>>(metadata, {});
  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : '未命名剧情',
    genre: typeof parsed.genre === 'string' ? parsed.genre : undefined,
    style: typeof parsed.style === 'string' ? parsed.style : undefined,
    pov: typeof parsed.pov === 'string' ? parsed.pov : undefined,
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : undefined,
    promptId: typeof parsed.promptId === 'string' ? parsed.promptId : null,
    lastPrompt: typeof parsed.lastPrompt === 'string' ? parsed.lastPrompt : null,
    lastSegments: Array.isArray(parsed.lastSegments)
      ? (parsed.lastSegments.filter(
          (segment): segment is FlowgramSegment =>
            !!segment && typeof segment === 'object' && 'type' in segment
        ) as FlowgramSegment[])
      : undefined,
  } satisfies PlotMetadata;
}

export function serializePlotWorkflow(workflow: PlotWorkflowState): string {
  return JSON.stringify({ nodes: workflow.nodes }, null, 2);
}

export function serializePlotMetadata(metadata: PlotMetadata): string {
  return JSON.stringify(metadata, null, 2);
}

export function createEmptyPlotWorkflow(): PlotWorkflowState {
  return { nodes: [] } satisfies PlotWorkflowState;
}

export function createPlotNode(partial: Pick<PlotNode, 'kind' | 'text'> & Partial<PlotNode>): PlotNode {
  const nowIso = new Date().toISOString();
  return {
    id: partial.id ?? generateNodeId(),
    kind: partial.kind,
    text: partial.text,
    character: partial.character,
    action: partial.action,
    fromOptionId: partial.fromOptionId ?? null,
    createdAt: partial.createdAt ?? nowIso,
  } satisfies PlotNode;
}

export function mergeMetadata(base: PlotMetadata, patch: Partial<PlotMetadata>): PlotMetadata {
  return {
    ...base,
    ...patch,
    tags: patch.tags?.filter((tag) => tag.trim().length > 0) ?? base.tags,
  } satisfies PlotMetadata;
}
