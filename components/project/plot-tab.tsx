'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, RefreshCcw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FlowgramChoicesSegment, FlowgramSegment, PlotNode, PlotNodeKind, PlotRecord } from '@/lib/types/plot';
import { cn } from '@/lib/utils';
import { FlowTimeline, type FlowTimelineController } from '@/components/project/plot/flow-timeline';
import { NodeEditorDialog, type NodeEditorFormValues } from '@/components/project/plot/node-editor-dialog';
import { AiResponsePanel } from '@/components/project/plot/ai-response-panel';
import { FLOW_BRANCH_OFFSET_X, FLOW_NODE_DRAG_TYPE, FLOW_NODE_VERTICAL_GAP } from '@/components/project/plot/constants';
import type { XYPosition } from 'reactflow';

function positionNodesByOrder(
  controller: FlowTimelineController | null,
  plot: PlotRecord,
  nodeIds: string[],
  dropPosition?: XYPosition
) {
  if (!controller || !nodeIds.length) return;
  const nodesList = plot.workflow.nodes;
  nodeIds.forEach((nodeId, index) => {
    const nodeIndex = nodesList.findIndex((node) => node.id === nodeId);
    if (nodeIndex < 0) return;
    const node = nodesList[nodeIndex];
    const hasParent =
      typeof node.fromOptionId === 'string' &&
      nodesList.some((candidate) => candidate.id === node.fromOptionId);
    const isLastWithDrop = !!dropPosition && index === nodeIds.length - 1;
    const isBranchNode = node.kind === 'branch';
    const baseX = hasParent ? FLOW_BRANCH_OFFSET_X : 0;
    const targetX = isBranchNode
      ? isLastWithDrop
        ? dropPosition!.x
        : 0
      : isLastWithDrop
      ? dropPosition!.x
      : baseX;
    const targetY = nodeIndex * FLOW_NODE_VERTICAL_GAP;
    controller.setNodePosition(nodeId, { x: targetX, y: targetY });
  });
}


function composePlotContext(plot: PlotRecord | null | undefined): string {
  if (!plot) {
    return '当前无剧情节点。';
  }

  const { metadata, workflow } = plot;
  const headerLines: string[] = [`当前剧情标题：${metadata.title}`];
  if (metadata.genre) headerLines.push(`类型：${metadata.genre}`);
  if (metadata.style) headerLines.push(`文风：${metadata.style}`);
  if (metadata.pov) headerLines.push(`视角：${metadata.pov}`);
  if (metadata.tags?.length) headerLines.push(`标签：${metadata.tags.join(', ')}`);

  const nodes = workflow?.nodes ?? [];
  const nodeLines = nodes.map((node, index) => {
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
  ]
    .filter(Boolean)
    .join('\n\n');
}

function applyPromptPlaceholders(template: string, context: string): string {
  if (!template) return template;
  let result = template;
  if (result.includes('%worldContext%')) {
    result = result.replace(/%worldContext%/g, context);
  }
  if (result.includes('%input%')) {
    result = result.replace(/%input%/g, '');
  }
  return result;
}

const WORD_BUDGET_MIN = 100;
const WORD_BUDGET_MAX = 100000;

function clampWordBudget(value: number): number {
  if (Number.isNaN(value)) return WORD_BUDGET_MIN;
  return Math.min(WORD_BUDGET_MAX, Math.max(WORD_BUDGET_MIN, Math.round(value)));
}

function sanitizeSegments(value: unknown): FlowgramSegment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((segment): segment is FlowgramSegment => {
    return !!segment && typeof segment === 'object' && 'type' in segment;
  });
}

interface PromptOption {
  id: string;
  name: string;
  content: string;
  system?: string;
}

interface PlotTabProps {
  projectId: string;
}

interface FlowTimelineController {
  focusNode: (nodeId: string) => void;
  arrangeVertical: () => void;
  arrangeHorizontal: () => void;
  setNodePosition: (nodeId: string, position: XYPosition) => void;
}

interface NodeEditorState {
  mode: 'create' | 'edit';
  kind: PlotNodeKind;
  node?: PlotNode;
  dropPosition?: XYPosition;
}

interface NodeEditorFormValues {
  character: string;
  action: string;
  text: string;
}

const FLOW_NODE_DRAG_TYPE = 'application/reactflow';
function buildWorkflowPayload(nodes: PlotNode[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      text: node.text,
      character: node.character,
      action: node.action,
      fromOptionId: node.fromOptionId ?? null,
      prompt: node.prompt ?? null,
      createdAt: node.createdAt,
    })),
  };
}

export function PlotTab({ projectId }: PlotTabProps) {
  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [promptList, setPromptList] = useState<PromptOption[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [mutatingNodes, setMutatingNodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const [aiSegments, setAiSegments] = useState<FlowgramSegment[]>([]);
  const [wordBudget, setWordBudget] = useState<number>(800);
  const [branchGenerating, setBranchGenerating] = useState<Record<string, boolean>>({});
  const [showPlotList, setShowPlotList] = useState(true);
  const [autoInsertNodes, setAutoInsertNodes] = useState(true);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const flowControllerRef = useRef<FlowTimelineController | null>(null);
  const [nodeSearchKeyword, setNodeSearchKeyword] = useState('');
  const [nodeCharacterFilter, setNodeCharacterFilter] = useState<string>('all');
  const [nodeKindFilter, setNodeKindFilter] = useState<'all' | PlotNodeKind>('all');
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [nodeEditorState, setNodeEditorState] = useState<NodeEditorState | null>(null);
  const [nodeEditorError, setNodeEditorError] = useState<string | null>(null);

  const focusNodeById = useCallback(
    (nodeId: string) => {
      setActiveNodeId(nodeId);
      requestAnimationFrame(() => {
        flowControllerRef.current?.focusNode(nodeId);
      });
    },
    [flowControllerRef]
  );

  const handleRegisterFlowController = useCallback(
    (controller: FlowTimelineController) => {
      flowControllerRef.current = controller;
      if (activeNodeId) {
        controller.focusNode(activeNodeId);
      }
    },
    [activeNodeId]
  );

  const handleCharacterFilterChange = useCallback((value: string) => {
    setNodeCharacterFilter(value);
  }, []);

  const handleKindFilterChange = useCallback((value: string) => {
    setNodeKindFilter(value as 'all' | PlotNodeKind);
  }, []);

  const selectedPlot = useMemo(() => {
    if (!selectedPlotId) return plots[0] ?? null;
    return plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null;
  }, [plots, selectedPlotId]);

  const plotNodes = useMemo(() => selectedPlot?.workflow.nodes ?? [], [selectedPlot]);

  const orderedPlotNodes = useMemo(
    () =>
      [...plotNodes].sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      }),
    [plotNodes]
  );

  const nodeOrderMap = useMemo(
    () =>
      new Map<string, number>(orderedPlotNodes.map((node, index) => [node.id, index + 1])),
    [orderedPlotNodes]
  );

  const characterOptions = useMemo(() => {
    const names = new Set<string>();
    orderedPlotNodes.forEach((node) => {
      if (node.kind === 'dialogue') {
        const name = node.character?.trim();
        if (name) names.add(name);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [orderedPlotNodes]);

  const filteredPlotNodes = useMemo(() => {
    const keyword = nodeSearchKeyword.trim().toLowerCase();
    return orderedPlotNodes.filter((node) => {
      const matchesKind = nodeKindFilter === 'all' || node.kind === nodeKindFilter;
      const matchesCharacter =
        nodeCharacterFilter === 'all'
          ? true
          : node.kind === 'dialogue' && (node.character ?? '') === nodeCharacterFilter;
      const matchesKeyword = keyword
        ? [node.text, node.character ?? '', node.action ?? '', node.prompt ?? '']
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchesKind && matchesCharacter && matchesKeyword;
    });
  }, [orderedPlotNodes, nodeCharacterFilter, nodeKindFilter, nodeSearchKeyword]);

  const nodeTemplates = useMemo(
    () => [
      {
        kind: 'dialogue' as PlotNodeKind,
        title: '角色消息',
        description: '包含角色名称、语气/动作与对话文本。',
      },
      {
        kind: 'narration' as PlotNodeKind,
        title: '旁白',
        description: '用于环境描写或剧情过渡。',
      },
      {
        kind: 'branch' as PlotNodeKind,
        title: '故事分支',
        description: '填写提示词并生成新的分支剧情。',
      },
    ],
    []
  );

  const sanitizedWordBudget = useMemo(() => clampWordBudget(wordBudget), [wordBudget]);

  useEffect(() => {
    setTitleDraft(selectedPlot?.metadata.title ?? '');
  }, [selectedPlot]);

  useEffect(() => {
    setActiveNodeId(null);
    setNodeSearchKeyword('');
    setNodeCharacterFilter('all');
    setNodeKindFilter('all');
  }, [selectedPlot?.id]);

  useEffect(() => {
    setAiSegments([]);
    setBranchGenerating({});
  }, [selectedPlot?.id]);

  useEffect(() => {
    if (activeNodeId && !plotNodes.some((node) => node.id === activeNodeId)) {
      setActiveNodeId(null);
    }
  }, [activeNodeId, plotNodes]);

  const contextPreview = useMemo(() => composePlotContext(selectedPlot), [selectedPlot]);
  const resolvePromptTemplate = useCallback(
    (template: string) => applyPromptPlaceholders(template, contextPreview),
    [contextPreview]
  );

  useEffect(() => {
    setPromptText((current) =>
      current && (current.includes('%worldContext%') || current.includes('%input%'))
        ? resolvePromptTemplate(current)
        : current
    );
  }, [resolvePromptTemplate]);

  const loadPlots = useCallback(async () => {
    try {
      setLoadingPlots(true);
      const response = await fetch(`/api/plots?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('加载剧情流程失败');
      }
      const data = await response.json();
      const list: PlotRecord[] = data.plots ?? [];
      setPlots(list);
      setSelectedPlotId((prev) => prev ?? (list[0]?.id ?? null));
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : '加载剧情流程失败');
    } finally {
      setLoadingPlots(false);
    }
  }, [projectId]);

  const loadPrompts = useCallback(async () => {
    try {
      const response = await fetch(`/api/prompts?projectId=${projectId}&type=dialog`);
      if (!response.ok) {
        throw new Error('加载提示词失败');
      }
      const data = await response.json();
      const prompts: PromptOption[] = (data.prompts ?? []).map(
        (item: {
          id: string;
          name: string;
          content?: string;
          system?: string;
        }) => ({
          id: item.id,
          name: item.name,
          content: item.content ?? '',
          system: item.system ?? '',
        })
      );
      setPromptList(prompts);
    } catch (error) {
      console.error(error);
    }
  }, [projectId]);

  useEffect(() => {
    void loadPlots();
    void loadPrompts();
  }, [loadPlots, loadPrompts]);

  async function handleCreatePlot() {
    try {
      setErrorMessage(null);
      const response = await fetch('/api/plots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        throw new Error('创建剧情失败');
      }
      const data = await response.json();
      const plot: PlotRecord = data.plot;
      setPlots((prev) => [plot, ...prev]);
      setSelectedPlotId(plot.id);
      setAiSegments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建剧情失败');
    }
  }

  async function handleSaveTitle() {
    if (!selectedPlot) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === selectedPlot.metadata.title) return;
    try {
      setSavingTitle(true);
      setErrorMessage(null);
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-metadata',
          metadata: { title: trimmed },
        }),
      });
      if (!response.ok) throw new Error('更新标题失败');
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '更新标题失败');
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleResetPlot() {
    if (!selectedPlot) return;
    const confirmed = window.confirm('确定要重置当前剧情吗？此操作会清空已有节点');
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (!response.ok) throw new Error('重置剧情失败');
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      setAiSegments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '重置剧情失败');
    }
  }

  async function handleDeletePlot() {
    if (!selectedPlot) return;
    const confirmed = window.confirm('确定要删除当前剧情吗？');
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('删除剧情失败');
      setPlots((prev) => prev.filter((plot) => plot.id !== selectedPlot.id));
      setSelectedPlotId((prev) => (prev === selectedPlot.id ? null : prev));
      setAiSegments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除剧情失败');
    }
  }

  async function handleGenerate() {
    if (!selectedPlot) return;
    const trimmed = promptText.trim();
    if (!trimmed) {
      setErrorMessage('请输入提示词');
      return;
    }
    try {
      setGenerating(true);
      setErrorMessage(null);
      const resolvedPrompt = resolvePromptTemplate(trimmed);
      const response = await fetch(`/api/plots/${selectedPlot.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: resolvedPrompt,
          promptId: selectedPromptId,
          wordBudget: sanitizedWordBudget,
          autoInsert: autoInsertNodes,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? '生成剧情失败');
      }
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      const appendedNodeIds: string[] = Array.isArray(data.appendedNodeIds) ? data.appendedNodeIds : [];
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      setAiUsage(data.usage ?? null);
      setAiSegments(sanitizeSegments((data as { segments?: unknown }).segments));
      if (!selectedPlotId) {
        setSelectedPlotId(updated.id);
      }
      setPromptText(resolvedPrompt);
      if (autoInsertNodes && appendedNodeIds.length) {
        focusNodeById(appendedNodeIds[appendedNodeIds.length - 1]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成剧情失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleUseChoice(option: FlowgramChoicesSegment['options'][0]) {
    if (!selectedPlot) return;
    const summary = option.summary ?? '';
    const hint = option.hint ?? '';
    const combined = [summary, hint].filter(Boolean).join(' - ');
    const text = `【分支 ${option.id}】${combined}`;
    try {
      setMutatingNodes(true);
      setErrorMessage(null);
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'append-nodes',
          nodes: [
            {
              kind: 'narration',
              text,
              fromOptionId: option.id,
            },
          ],
        }),
      });
      if (!response.ok) throw new Error('插入分支失败');
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      const latestNode = updated.workflow.nodes[updated.workflow.nodes.length - 1];
      if (latestNode) {
        focusNodeById(latestNode.id);
        positionNodesByOrder(flowControllerRef.current, updated, [latestNode.id]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '插入分支失败');
    } finally {
      setMutatingNodes(false);
    }
  }

  const appendNode = useCallback(
    async (payload: Partial<PlotNode>, dropPosition?: XYPosition) => {
      if (!selectedPlot) {
        throw new Error('当前未选择剧情');
      }
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append-nodes', nodes: [payload] }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const message = (data as { error?: string } | null)?.error ?? '插入节点失败';
        throw new Error(message);
      }
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      if (!selectedPlotId) {
        setSelectedPlotId(updated.id);
      }
      const appendedNodeIds: string[] = Array.isArray(data.appendedNodeIds) ? data.appendedNodeIds : [];
      const newNodeId = appendedNodeIds.length
        ? appendedNodeIds[appendedNodeIds.length - 1]
        : updated.workflow.nodes.length
        ? updated.workflow.nodes[updated.workflow.nodes.length - 1].id
        : null;
      if (newNodeId) {
        focusNodeById(newNodeId);
        positionNodesByOrder(flowControllerRef.current, updated, [newNodeId], dropPosition);
      }
      return newNodeId;
    },
    [selectedPlot, selectedPlotId, setPlots, setSelectedPlotId, focusNodeById]
  );

  const overwriteWorkflow = useCallback(
    async (nodesToPersist: PlotNode[], focusId?: string) => {
      if (!selectedPlot) {
        throw new Error('当前未选择剧情');
      }
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'overwrite-workflow',
          workflow: buildWorkflowPayload(nodesToPersist),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const message = (data as { error?: string } | null)?.error ?? '更新节点失败';
        throw new Error(message);
      }
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      if (!selectedPlotId) {
        setSelectedPlotId(updated.id);
      }
      if (focusId) {
        focusNodeById(focusId);
      }
      return updated;
    },
    [selectedPlot, selectedPlotId, setPlots, setSelectedPlotId, focusNodeById]
  );

  
  const createBranchNode = useCallback(
    async (dropPosition?: XYPosition) => {
      if (!selectedPlot) {
        setErrorMessage('请先选择剧情');
        return;
      }
      try {
        setNodeEditorError(null);
        setMutatingNodes(true);
        await appendNode(
          {
            kind: 'branch',
            text: '',
            prompt: '',
          },
          dropPosition
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '创建分支节点失败');
      } finally {
        setMutatingNodes(false);
      }
    },
    [appendNode, selectedPlot, setErrorMessage]
  );

  const handleBranchPromptChange = useCallback(
    async (nodeId: string, prompt: string) => {
      if (!selectedPlot) return;
      const current = selectedPlot.workflow.nodes.find((node) => node.id === nodeId);
      if (!current) return;
      const trimmed = prompt.trim();
      if ((current.prompt ?? '') === trimmed) return;
      const updatedNodes = selectedPlot.workflow.nodes.map((node) =>
        node.id === nodeId ? { ...node, prompt: trimmed } : node
      );
      try {
        await overwriteWorkflow(updatedNodes);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '更新分支提示词失败');
      }
    },
    [overwriteWorkflow, selectedPlot, setErrorMessage]
  );

  const handleBranchGenerate = useCallback(
    async (nodeId: string, promptOverride?: string) => {
      if (!selectedPlot) return;
      setErrorMessage(null);
      const branchNode = selectedPlot.workflow.nodes.find((node) => node.id === nodeId);
      if (!branchNode) return;
      const promptSource = typeof promptOverride === 'string' ? promptOverride : branchNode.prompt ?? '';
      const prompt = promptSource.trim();
      if (!prompt) {
        setErrorMessage('请先填写剧情发展提示词');
        return;
      }
      if (promptOverride !== undefined && prompt !== (branchNode.prompt ?? '').trim()) {
        await handleBranchPromptChange(nodeId, prompt);
      }
      const resolvedPrompt = resolvePromptTemplate(prompt);
      try {
        setBranchGenerating((prev) => ({ ...prev, [nodeId]: true }));
        const response = await fetch(`/api/plots/${selectedPlot.id}/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: resolvedPrompt,
            wordBudget: sanitizedWordBudget,
            autoInsert: true,
            sourceNodeId: nodeId,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error ?? '生成剧情失败');
        }
        const data = await response.json();
        const updated: PlotRecord = data.plot;
        const appendedNodeIds: string[] = Array.isArray(data.appendedNodeIds) ? data.appendedNodeIds : [];
        setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
        setAiUsage(data.usage ?? null);
        setAiSegments(sanitizeSegments((data as { segments?: unknown }).segments));
        if (!selectedPlotId) {
          setSelectedPlotId(updated.id);
        }
        positionNodesByOrder(flowControllerRef.current, updated, appendedNodeIds);
        if (appendedNodeIds.length) {
          focusNodeById(appendedNodeIds[appendedNodeIds.length - 1]);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '生成剧情失败');
      } finally {
        setBranchGenerating((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
      }
    },
    [
      focusNodeById,
      handleBranchPromptChange,
      resolvePromptTemplate,
      sanitizedWordBudget,
      selectedPlot,
      selectedPlotId,
      setPlots,
      setSelectedPlotId,
      setErrorMessage,
    ]
  );

  const handleCloneNode = useCallback(
    async (nodeId: string) => {
      if (!selectedPlot) return;
      const sourceNode = selectedPlot.workflow.nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return;
      try {
        setNodeEditorError(null);
        setMutatingNodes(true);
        await appendNode({
          kind: sourceNode.kind,
          text: sourceNode.text,
          character: sourceNode.kind === 'dialogue' ? sourceNode.character : undefined,
          action: sourceNode.kind === 'dialogue' ? sourceNode.action : undefined,
          fromOptionId: sourceNode.fromOptionId ?? null,
          prompt: sourceNode.kind === 'branch' ? sourceNode.prompt ?? '' : undefined,
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '克隆节点失败');
      } finally {
        setMutatingNodes(false);
      }
    },
    [appendNode, selectedPlot, setErrorMessage]
  );

  const handleNodeDrop = useCallback(
    (kind: PlotNodeKind, position: XYPosition) => {
      if (!selectedPlot) {
        setErrorMessage('请先选择剧情');
        return;
      }
      setNodeEditorError(null);
      if (kind === 'branch') {
        void createBranchNode(position);
        return;
      }
      setNodeEditorState({ mode: 'create', kind, dropPosition: position });
    },
    [createBranchNode, selectedPlot, setErrorMessage]
  );

  const openCreateNodeDialog = useCallback(
    (kind: PlotNodeKind) => {
      if (!selectedPlot) {
        setErrorMessage('请先选择剧情');
        return;
      }
      setNodeEditorError(null);
       if (kind === 'branch') {
        void createBranchNode();
        return;
      }
      setNodeEditorState({ mode: 'create', kind });
    },
    [createBranchNode, selectedPlot, setErrorMessage]
  );

  const openEditNodeDialog = useCallback((node: PlotNode) => {
    setNodeEditorError(null);
    setNodeEditorState({ mode: 'edit', kind: node.kind, node });
  }, []);

  const closeNodeEditor = useCallback(() => {
    setNodeEditorState(null);
    setNodeEditorError(null);
  }, []);

  const handleNodeEditorSubmit = useCallback(
    async (values: NodeEditorFormValues) => {
      if (!nodeEditorState || !selectedPlot) return;
      if (nodeEditorState.kind === 'branch') {
        setNodeEditorError('分支节点请在画布内编辑');
        return;
      }
      const text = values.text.trim();
      if (!text) {
        setNodeEditorError('请输入节点内容');
        return;
      }
      const character = nodeEditorState.kind === 'dialogue' ? values.character.trim() : '';
      const action = nodeEditorState.kind === 'dialogue' ? values.action.trim() : '';
      try {
        setNodeEditorError(null);
        setMutatingNodes(true);
        if (nodeEditorState.mode === 'create') {
          await appendNode(
            {
              kind: nodeEditorState.kind,
              text,
              character: nodeEditorState.kind === 'dialogue' && character ? character : undefined,
              action: nodeEditorState.kind === 'dialogue' && action ? action : undefined,
            },
            nodeEditorState.dropPosition
          );
        } else if (nodeEditorState.mode === 'edit' && nodeEditorState.node) {
          const targetId = nodeEditorState.node.id;
          const updatedNodes = selectedPlot.workflow.nodes.map((node) =>
            node.id === targetId
              ? {
                  ...node,
                  text,
                  character: nodeEditorState.kind === 'dialogue' && character ? character : undefined,
                  action: nodeEditorState.kind === 'dialogue' && action ? action : undefined,
                }
              : node
          );
          await overwriteWorkflow(updatedNodes, targetId);
        }
        closeNodeEditor();
      } catch (error) {
        setNodeEditorError(error instanceof Error ? error.message : '保存节点失败');
      } finally {
        setMutatingNodes(false);
      }
    },
    [appendNode, closeNodeEditor, nodeEditorState, overwriteWorkflow, selectedPlot, setNodeEditorError]
  );

  const handleTemplateDragStart = useCallback((event: DragEvent<HTMLDivElement>, kind: PlotNodeKind) => {
    event.dataTransfer.setData(FLOW_NODE_DRAG_TYPE, JSON.stringify({ kind }));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  async function handleDeleteNode(nodeId: string) {
    if (!selectedPlot) return;
    const confirmed = window.confirm('确定要删除该节点吗？');
    if (!confirmed) return;
    const remainingNodes = selectedPlot.workflow.nodes.filter((node) => node.id !== nodeId);
    if (remainingNodes.length === selectedPlot.workflow.nodes.length) {
      return;
    }
    try {
      setDeletingNodeId(nodeId);
      setErrorMessage(null);
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'overwrite-workflow',
          workflow: buildWorkflowPayload(remainingNodes),
        }),
      });
      if (!response.ok) throw new Error('删除节点失败');
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      setActiveNodeId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除节点失败');
    } finally {
      setDeletingNodeId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
      {errorMessage ? (
        <Card className="border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </Card>
      ) : null}
      <div
        className={cn(
          'grid gap-4',
          showPlotList ? 'grid-cols-[240px_minmax(0,1fr)_340px]' : 'grid-cols-[minmax(0,1fr)_340px]'
        )}
      >
        {showPlotList ? (
          <Card className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">剧情列表</h3>
              <Button size="icon" variant="outline" onClick={handleCreatePlot}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-auto pr-2">
              {loadingPlots ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载中...
                </div>
              ) : plots.length ? (
                plots.map((plot) => (
                  <button
                    key={plot.id}
                    onClick={() => setSelectedPlotId(plot.id)}
                    className={cn(
                      'w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary',
                      selectedPlot?.id === plot.id ? 'border-primary bg-primary/5' : ''
                    )}
                  >
                    <div className="font-medium">{plot.metadata.title}</div>
                    <div className="text-xs text-muted-foreground">
                      更新于 {new Date(plot.updatedAt).toLocaleString()}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded border border-dashed border-muted p-4 text-center text-xs text-muted-foreground">
                  暂无剧情，请点击上方按钮创建
                </div>
              )}
            </div>
          </Card>
        ) : null}

        <Card className="flex min-h-[640px] flex-col p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex flex-1 items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setShowPlotList((prev) => !prev)}
                aria-label={showPlotList ? '隐藏剧情列表' : '显示剧情列表'}
              >
                {showPlotList ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={handleSaveTitle}
                placeholder="当前剧情名称"
                className="max-w-sm"
                disabled={savingTitle}
              />
              {savingTitle ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleResetPlot}>
                <RefreshCcw className="mr-1 h-4 w-4" />
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeletePlot}>
                <Trash2 className="mr-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => flowControllerRef.current?.arrangeVertical()}
              disabled={!orderedPlotNodes.length}
            >
              纵向整理
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => flowControllerRef.current?.arrangeHorizontal()}
              disabled={!orderedPlotNodes.length}
            >
              横向整理
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-auto pr-2">
            <FlowTimeline
              nodes={orderedPlotNodes}
              selectedNodeId={activeNodeId}
              onRegisterController={handleRegisterFlowController}
              onNodeFocus={focusNodeById}
              onNodeDrop={handleNodeDrop}
              onDeleteNode={(nodeId) => void handleDeleteNode(nodeId)}
              onCloneNode={(nodeId) => void handleCloneNode(nodeId)}
              onEditNode={openEditNodeDialog}
              onBranchPromptChange={handleBranchPromptChange}
              onBranchGenerate={(nodeId, prompt) => void handleBranchGenerate(nodeId, prompt)}
              branchGenerating={branchGenerating}
            />
          </div>
        </Card>

        <Card className="flex h-full flex-col p-4">
          <Tabs defaultValue="generate" className="flex flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="generate">AI 生成</TabsTrigger>
              <TabsTrigger value="insert">插入节点</TabsTrigger>
              <TabsTrigger value="nodes">节点管理</TabsTrigger>
            </TabsList>
            <TabsContent value="generate" className="mt-4 flex flex-1 flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="plot-word-budget">目标字数</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="plot-word-budget"
                    type="range"
                    min={WORD_BUDGET_MIN}
                    max={WORD_BUDGET_MAX}
                    step={100}
                    value={sanitizedWordBudget}
                    onChange={(event) => setWordBudget(clampWordBudget(Number(event.target.value)))}
                    className="h-2 w-full flex-1 cursor-pointer appearance-none rounded bg-muted"
                  />
                  <Input
                    type="number"
                    min={WORD_BUDGET_MIN}
                    max={WORD_BUDGET_MAX}
                    value={sanitizedWordBudget}
                    onChange={(event) => setWordBudget(clampWordBudget(Number(event.target.value)))}
                    className="w-28"
                  />
                </div>
                <div className="rounded border border-dashed border-muted bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  发送时自动在提示词顶部添加：目标字数：{sanitizedWordBudget}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">对话提示词列表</Label>
                <Select
                  value={selectedPromptId ?? undefined}
                  onValueChange={(value) => {
                    setSelectedPromptId(value);
                    const prompt = promptList.find((item) => item.id === value);
                    if (prompt) {
                      setPromptText(resolvePromptTemplate(prompt.content ?? ''));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择提示词" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptList.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plot-prompt">提示词</Label>
                <Textarea
                  id="plot-prompt"
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  rows={6}
                  placeholder="描述希望AI延展剧情的方向，例如：聚焦两人关系缓和，强调雨夜细节..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="plot-auto-insert"
                  checked={autoInsertNodes}
                  onCheckedChange={(checked) => setAutoInsertNodes(checked === true)}
                />
                <Label htmlFor="plot-auto-insert" className="text-sm font-normal text-muted-foreground">
                  生成后自动插入剧情节点
                </Label>
              </div>
              <Button onClick={handleGenerate} disabled={generating || !selectedPlot}>
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                生成剧情节点
              </Button>
              {aiUsage ? (
                <div className="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                  tokens: {aiUsage.tokens} · cost: ${aiUsage.cost.toFixed(4)}
                </div>
              ) : null}
              <AiResponsePanel segments={aiSegments} onInsertChoice={(option) => void handleUseChoice(option)} />
            </TabsContent>
            <TabsContent value="insert" className="mt-4 flex flex-1 flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-1">
                {nodeTemplates.map((template) => (
                  <Card
                    key={template.kind}
                    draggable
                    onDragStart={(event) => handleTemplateDragStart(event, template.kind)}
                    className="border border-dashed border-muted/60 bg-muted/10 p-4 transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{template.title}</div>
                        <div className="text-xs text-muted-foreground">{template.description}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateNodeDialog(template.kind)}
                        disabled={mutatingNodes || !selectedPlot}
                      >
                        新建
                      </Button>
                    </div>
                
                  </Card>
                ))}
              </div>
              <div className="rounded border border-dashed border-muted/80 bg-muted/20 p-3 text-xs text-muted-foreground">
                贴士：拖动节点到画布后将弹出编辑框，可填写完整内容。
              </div>
            </TabsContent>
            <TabsContent value="nodes" className="mt-4 flex flex-1 flex-col gap-3 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="搜索节点内容..."
                  value={nodeSearchKeyword}
                  onChange={(event) => setNodeSearchKeyword(event.target.value)}
                  className="min-w-[180px] flex-1"
                />
                <Select value={nodeCharacterFilter} onValueChange={handleCharacterFilterChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部角色</SelectItem>
                    {characterOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={nodeKindFilter} onValueChange={handleKindFilterChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="节点类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="dialogue">角色消息</SelectItem>
                    <SelectItem value="narration">旁白</SelectItem>
                    <SelectItem value="branch">故事分支</SelectItem>
            </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                {filteredPlotNodes.length ? (
                  filteredPlotNodes.map((node) => {
                    const order = nodeOrderMap.get(node.id) ?? 0;
                    const isActive = activeNodeId === node.id;
                    return (
                      <Card
                        key={node.id}
                        onClick={() => focusNodeById(node.id)}
                        className={cn(
                          'cursor-pointer border transition-shadow',
                          isActive
                            ? 'border-primary ring-2 ring-primary/30 shadow-md'
                            : 'hover:border-primary/60'
                        )}
                      >
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>第 {order} 节点 · {node.kind === 'dialogue' ? '角色消息' : node.kind === 'branch' ? '故事分支' : '旁白'}</span>
                          {node.kind === 'dialogue' && node.character ? (
                            <span className="text-xs text-muted-foreground">角色：{node.character}</span>
                          ) : null}
                        </div>
                        {node.kind === 'dialogue' && node.action ? (
                          <div className="mt-1 text-xs text-muted-foreground">动作：{node.action}</div>
                        ) : null}
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {node.kind === 'branch'
                            ? node.prompt?.trim()
                              ? `提示词：${node.prompt.trim()}`
                              : '提示词未填写'
                            : node.text}
                        </p>
                        {node.fromOptionId ? (
                          <div className="mt-2 text-xs text-muted-foreground">来自分支 {node.fromOptionId}</div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(node.createdAt).toLocaleString()}</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteNode(node.id);
                            }}
                            disabled={deletingNodeId === node.id}
                          >
                            {deletingNodeId === node.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            删除节点
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center rounded border border-dashed border-muted p-6 text-sm text-muted-foreground">
                    暂无可展示的节点
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    <NodeEditorDialog
        open={nodeEditorState !== null}
        mode={nodeEditorState?.mode ?? 'create'}
        kind={nodeEditorState?.kind ?? 'dialogue'}
        initialNode={nodeEditorState?.node}
        submitting={mutatingNodes}
        error={nodeEditorError}
        onClose={closeNodeEditor}
        onSubmit={handleNodeEditorSubmit}
      />
    </>
  );
}
