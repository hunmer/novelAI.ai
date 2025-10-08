'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlignLeft,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import type {
  FlowgramChoicesSegment,
  FlowgramSegment,
  PlotNode,
  PlotRecord,
} from '@/lib/types/plot';
import { cn } from '@/lib/utils';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  NodeProps,
  Position,
  ReactFlowProvider,
} from 'reactflow';

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

interface PromptOption {
  id: string;
  name: string;
  content: string;
  system?: string;
}

interface PlotTabProps {
  projectId: string;
}

type InsertKind = 'dialogue' | 'narration';

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
  const [inserting, setInserting] = useState(false);
  const [insertKind, setInsertKind] = useState<InsertKind>('dialogue');
  const [dialogueCharacter, setDialogueCharacter] = useState('');
  const [dialogueAction, setDialogueAction] = useState('');
  const [messageText, setMessageText] = useState('');
  const [narrationText, setNarrationText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const [wordBudget, setWordBudget] = useState<number>(800);

  const selectedPlot = useMemo(() => {
    if (!selectedPlotId) return plots[0] ?? null;
    return plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null;
  }, [plots, selectedPlotId]);

  const sanitizedWordBudget = useMemo(() => clampWordBudget(wordBudget), [wordBudget]);

  useEffect(() => {
    setTitleDraft(selectedPlot?.metadata.title ?? '');
  }, [selectedPlot]);

  const lastSegments = selectedPlot?.metadata.lastSegments ?? [];
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
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? '生成剧情失败');
      }
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      setAiUsage(data.usage ?? null);
      if (!selectedPlotId) {
        setSelectedPlotId(updated.id);
      }
      setPromptText(resolvedPrompt);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '生成剧情失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleInsertNode(fromChoiceId?: string) {
    if (!selectedPlot) return;
    const targetKind = insertKind;
    const text =
      targetKind === 'dialogue' ? messageText.trim() : narrationText.trim();
    if (!text) {
      setErrorMessage('请输入节点内容');
      return;
    }
    try {
      setInserting(true);
      setErrorMessage(null);
      const payload: Partial<PlotNode> = {
        kind: targetKind,
        text,
        character: targetKind === 'dialogue' ? dialogueCharacter.trim() : undefined,
        action: targetKind === 'dialogue' ? dialogueAction.trim() : undefined,
        fromOptionId: fromChoiceId ?? null,
      };
      const response = await fetch(`/api/plots/${selectedPlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append-nodes', nodes: [payload] }),
      });
      if (!response.ok) throw new Error('插入节点失败');
      const data = await response.json();
      const updated: PlotRecord = data.plot;
      setPlots((prev) => prev.map((plot) => (plot.id === updated.id ? updated : plot)));
      setMessageText('');
      setNarrationText('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '插入节点失败');
    } finally {
      setInserting(false);
    }
  }

  async function handleUseChoice(option: FlowgramChoicesSegment['options'][0]) {
    if (!selectedPlot) return;
    const summary = option.summary ?? '';
    const hint = option.hint ?? '';
    const combined = [summary, hint].filter(Boolean).join(' - ');
    const text = `【分支 ${option.id}】${combined}`;
    try {
      setInserting(true);
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '插入分支失败');
    } finally {
      setInserting(false);
    }
  }

  const nodes = selectedPlot?.workflow.nodes ?? [];

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? (
        <Card className="border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </Card>
      ) : null}
      <div className="grid grid-cols-[240px_minmax(0,1fr)_340px] gap-4">
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

        <Card className="flex min-h-[640px] flex-col p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex flex-1 items-center gap-3">
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
                重置剧情
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeletePlot}>
                <Trash2 className="mr-1 h-4 w-4" />
                删除剧情
              </Button>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-auto pr-2">
            <FlowTimeline nodes={nodes} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="space-y-3 p-4">
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
          </Card>

          <Card className="space-y-3 p-4">
            <Label className="text-sm font-medium">手动插入节点</Label>
            <div className="flex gap-2">
              <ToggleButton
                active={insertKind === 'dialogue'}
                onClick={() => setInsertKind('dialogue')}
              >
                角色消息
              </ToggleButton>
              <ToggleButton
                active={insertKind === 'narration'}
                onClick={() => setInsertKind('narration')}
              >
                旁白
              </ToggleButton>
            </div>
            {insertKind === 'dialogue' ? (
              <div className="space-y-2">
                <Input
                  placeholder="角色名称"
                  value={dialogueCharacter}
                  onChange={(event) => setDialogueCharacter(event.target.value)}
                />
                <Input
                  placeholder="语气 / 动作"
                  value={dialogueAction}
                  onChange={(event) => setDialogueAction(event.target.value)}
                />
                <Textarea
                  placeholder="对话内容"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={3}
                />
              </div>
            ) : (
              <Textarea
                placeholder="旁白内容"
                value={narrationText}
                onChange={(event) => setNarrationText(event.target.value)}
                rows={4}
              />
            )}
            <Button onClick={() => void handleInsertNode()} disabled={inserting || !selectedPlot}>
              {inserting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              插入节点
            </Button>
          </Card>

          <Card className="flex-1 space-y-3 p-4">
            <h3 className="text-sm font-semibold">AI 回复结果</h3>
            <div className="space-y-3 overflow-y-auto pr-2 text-sm">
              {lastSegments.length ? (
                lastSegments.map((segment, index) => (
                  <SegmentPreview
                    key={`${segment.type}-${index}`}
                    segment={segment}
                    onInsertChoice={(option) => void handleUseChoice(option)}
                  />
                ))
              ) : (
                <div className="rounded border border-dashed border-muted p-4 text-center text-xs text-muted-foreground">
                  暂无AI回复，先尝试生成剧情节点
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface FlowTimelineProps {
  nodes: PlotNode[];
}

interface PlotFlowNodeData {
  plotNode: PlotNode;
  order: number;
}

const FLOW_NODE_VERTICAL_GAP = 220;
const FLOW_BRANCH_OFFSET_X = 280;
const FLOW_CANVAS_MIN_HEIGHT = 640;

function FlowTimeline({ nodes }: FlowTimelineProps) {
  if (!nodes.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        暂无节点，使用右侧提示词生成或手动插入。
      </div>
    );
  }

  const nodeTypes = useMemo(
    () => ({
      dialogue: CharacterMessageNode,
      narration: NarrationNode,
    }),
    []
  );

  const flowNodes = useMemo<Node<PlotFlowNodeData>[]>(
    () =>
      nodes.map((plotNode, index) => ({
        id: plotNode.id,
        type: plotNode.kind,
        position: {
          x: plotNode.fromOptionId ? FLOW_BRANCH_OFFSET_X : 0,
          y: index * FLOW_NODE_VERTICAL_GAP,
        },
        data: {
          plotNode,
          order: index + 1,
        },
        draggable: false,
        selectable: false,
      })),
    [nodes]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      nodes.reduce<Edge[]>((accumulator, plotNode, index) => {
        if (index === 0) return accumulator;
        const previous = nodes[index - 1];
        const label = plotNode.fromOptionId ? `来自分支 ${plotNode.fromOptionId}` : undefined;
        accumulator.push({
          id: `${previous.id}-${plotNode.id}`,
          source: previous.id,
          target: plotNode.id,
          type: 'smoothstep',
          label,
          labelBgPadding: [6, 2],
          labelBgBorderRadius: 4,
          labelStyle: { fontSize: 10 },
        });
        return accumulator;
      }, []),
    [nodes]
  );

  return (
    <ReactFlowProvider>
      <div className="h-full" style={{ minHeight: FLOW_CANVAS_MIN_HEIGHT }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          selectNodesOnDrag={false}
          className="[&_.react-flow__attribution]:hidden"
        >
          <Background gap={24} color="#E5E7EB" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

function CharacterMessageNode({ data }: NodeProps<PlotFlowNodeData>) {
  const { plotNode, order } = data;
  return (
    <div className="relative w-[360px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-none !bg-primary/70"
      />
      <Card className="border border-primary/40 bg-primary/5 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {order}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-primary">
              <MessageCircle className="h-4 w-4" />
              {plotNode.character || '未命名角色'}
            </span>
          </div>
          {plotNode.action ? <span className="text-xs text-muted-foreground">{plotNode.action}</span> : null}
        </div>
        <p className="text-sm leading-relaxed text-foreground">{plotNode.text}</p>
        {plotNode.fromOptionId ? (
          <div className="mt-2 text-xs text-muted-foreground">来自分支 {plotNode.fromOptionId}</div>
        ) : null}
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !rounded-full !border-none !bg-primary/70"
      />
    </div>
  );
}

function NarrationNode({ data }: NodeProps<PlotFlowNodeData>) {
  const { plotNode, order } = data;
  return (
    <div className="relative w-[320px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-none !bg-muted-foreground/70"
      />
      <Card className="border border-muted bg-muted/20 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground">
            {order}
          </span>
          <AlignLeft className="h-4 w-4" />
          <span>旁白</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{plotNode.text}</p>
        {plotNode.fromOptionId ? (
          <div className="mt-2 text-xs text-muted-foreground/80">来自分支 {plotNode.fromOptionId}</div>
        ) : null}
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !rounded-full !border-none !bg-muted-foreground/70"
      />
    </div>
  );
}

function SegmentPreview({
  segment,
  onInsertChoice,
}: {
  segment: FlowgramSegment;
  onInsertChoice: (option: FlowgramChoicesSegment['options'][0]) => void;
}) {
  if (segment.type === 'meta') {
    return (
      <div className="space-y-1 rounded border border-dashed border-primary/60 bg-primary/5 p-3">
        <div className="text-xs font-semibold text-primary">剧情设定更新</div>
        <div className="text-sm font-medium">{segment.title}</div>
        <div className="text-xs text-muted-foreground">
          {[segment.genre, segment.style, segment.pov].filter(Boolean).join(' · ')}
        </div>
        {segment.tags?.length ? (
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {segment.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (segment.type === 'narration') {
    return (
      <div className="rounded border border-muted bg-muted/20 p-3 text-sm">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <AlignLeft className="h-3 w-3" />
          旁白
        </div>
        {segment.text}
      </div>
    );
  }

  if (segment.type === 'dialogue') {
    return (
      <div className="rounded border border-muted/80 bg-background p-3 text-sm">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2">
            <MessageCircle className="h-3 w-3" />
            {segment.character}
          </span>
          {segment.action ? <span>{segment.action}</span> : null}
        </div>
        {segment.message}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-primary/40 bg-primary/5 p-3 text-sm">
      <div className="text-xs font-semibold text-primary">可选分支 · 第 {segment.step} 步</div>
      <div className="space-y-2">
        {segment.options.map((option) => (
          <Card key={option.id} className="border border-primary/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{option.summary}</div>
                <div className="text-xs text-muted-foreground">{option.hint}</div>
                {option.keywords?.length ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    关键词：{option.keywords.join('、')}
                  </div>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onInsertChoice(option)}
              >
                插入分支
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/60'
      )}
    >
      {children}
    </button>
  );
}
