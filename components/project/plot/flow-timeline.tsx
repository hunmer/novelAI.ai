'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { AlignLeft, GitBranch, Loader2, MessageCircle, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  type ReactFlowInstance,
  ReactFlowProvider,
  NodeToolbar,
  useNodesState,
  type XYPosition,
} from 'reactflow';
import type { PlotNode, PlotNodeKind } from '@/lib/types/plot';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  FLOW_BRANCH_OFFSET_X,
  FLOW_CANVAS_MIN_HEIGHT,
  FLOW_HORIZONTAL_MARGIN,
  FLOW_NODE_DRAG_TYPE,
  FLOW_NODE_VERTICAL_GAP,
  FLOW_VERTICAL_MARGIN,
} from './constants';

export interface FlowTimelineController {
  focusNode: (nodeId: string) => void;
  arrangeVertical: () => void;
  arrangeHorizontal: () => void;
  setNodePosition: (nodeId: string, position: XYPosition) => void;
}

export interface FlowTimelineProps {
  nodes: PlotNode[];
  selectedNodeId?: string | null;
  onRegisterController?: (controller: FlowTimelineController) => void;
  onNodeFocus?: (nodeId: string) => void;
  onNodeDrop?: (kind: PlotNodeKind, position: XYPosition) => void;
  onDeleteNode?: (nodeId: string) => void;
  onCloneNode?: (nodeId: string) => void;
  onEditNode?: (node: PlotNode) => void;
  onBranchPromptChange?: (nodeId: string, prompt: string) => void;
  onBranchGenerate?: (nodeId: string, prompt: string) => void;
  branchGenerating?: Record<string, boolean>;
}

interface PlotFlowNodeData {
  plotNode: PlotNode;
  order: number;
  onEdit?: (node: PlotNode) => void;
  onBranchPromptChange?: (prompt: string) => void;
  onBranchGenerate?: (prompt: string) => void;
  branchGenerating?: boolean;
}

function CharacterMessageNode({ data, selected }: NodeProps<PlotFlowNodeData>) {
  const { plotNode, order } = data;
  return (
    <div className="relative w-[360px]">
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            data.onEdit?.(data.plotNode);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </NodeToolbar>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-none !bg-primary/70"
      />
      <Card
        className={cn(
          'border border-primary/40 bg-primary/5 p-4 shadow-sm transition-shadow hover:shadow-md',
          selected ? 'border-primary ring-2 ring-primary/40 shadow-md' : ''
        )}
      >
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

function NarrationNode({ data, selected }: NodeProps<PlotFlowNodeData>) {
  const { plotNode, order } = data;
  return (
    <div className="relative w-[320px]">
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            data.onEdit?.(data.plotNode);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </NodeToolbar>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-none !bg-muted-foreground/70"
      />
      <Card
        className={cn(
          'border border-muted bg-muted/20 p-4 shadow-sm transition-shadow hover:shadow-md',
          selected ? 'border-primary/50 ring-2 ring-primary/30 shadow-md' : ''
        )}
      >
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

function BranchNode({ data, selected }: NodeProps<PlotFlowNodeData>) {
  const { plotNode, order, branchGenerating } = data;
  const [promptDraft, setPromptDraft] = useState(plotNode.prompt ?? '');

  useEffect(() => {
    setPromptDraft(plotNode.prompt ?? '');
  }, [plotNode.prompt]);

  const trimmedPrompt = promptDraft.trim();

  return (
    <div className="relative w-[360px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-none !bg-secondary/70"
      />
      <Card
        className={cn(
          'border border-secondary/40 bg-secondary/10 p-4 shadow-sm transition-shadow hover:shadow-md',
          selected ? 'border-secondary ring-2 ring-secondary/30 shadow-md' : ''
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-secondary-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-foreground">
            {order}
          </span>
          <GitBranch className="h-4 w-4" />
          <span>故事分支</span>
        </div>
        <Textarea
          value={promptDraft}
          onChange={(event) => setPromptDraft(event.target.value)}
          onBlur={() => {
            if (trimmedPrompt !== (plotNode.prompt ?? '').trim()) {
              data.onBranchPromptChange?.(trimmedPrompt);
            }
          }}
          placeholder="输入分支提示词，例如：描述反派视角的发展…"
          rows={4}
          className="mb-3 text-sm"
        />
        <Button
          size="sm"
          className="w-full justify-center"
          disabled={branchGenerating || !trimmedPrompt}
          onClick={(event) => {
            event.stopPropagation();
            if (!trimmedPrompt) return;
            data.onBranchGenerate?.(trimmedPrompt);
          }}
        >
          {branchGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          生成分支剧情
        </Button>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !rounded-full !border-none !bg-secondary/70"
      />
    </div>
  );
}

export function FlowTimeline({
  nodes,
  selectedNodeId,
  onRegisterController,
  onNodeFocus,
  onNodeDrop,
  onDeleteNode,
  onCloneNode,
  onEditNode,
  onBranchPromptChange,
  onBranchGenerate,
  branchGenerating,
}: FlowTimelineProps) {
  const nodeTypes = useMemo(
    () => ({
      dialogue: CharacterMessageNode,
      narration: NarrationNode,
      branch: BranchNode,
    }),
    []
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<PlotFlowNodeData>>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    setFlowNodes((previousNodes) => {
      const previousMap = new Map(previousNodes.map((node) => [node.id, node]));
      return nodes.map((plotNode, index) => {
        const previous = previousMap.get(plotNode.id);
        return {
          id: plotNode.id,
          type: plotNode.kind,
          data: {
            plotNode,
            order: index + 1,
            onEdit: onEditNode ? () => onEditNode(plotNode) : undefined,
            onBranchPromptChange:
              plotNode.kind === 'branch' && onBranchPromptChange
                ? (value: string) => onBranchPromptChange(plotNode.id, value)
                : undefined,
            onBranchGenerate:
              plotNode.kind === 'branch' && onBranchGenerate
                ? (prompt: string) => onBranchGenerate(plotNode.id, prompt)
                : undefined,
            branchGenerating:
              plotNode.kind === 'branch' ? branchGenerating?.[plotNode.id] ?? false : undefined,
          },
          position:
            previous?.position ??
            {
              x: plotNode.fromOptionId ? FLOW_BRANCH_OFFSET_X : 0,
              y: index * FLOW_NODE_VERTICAL_GAP,
            },
          draggable: true,
          selectable: false,
          selected: previous?.selected ?? false,
        };
      });
    });
  }, [branchGenerating, nodes, onBranchGenerate, onBranchPromptChange, onEditNode, setFlowNodes]);

  useEffect(() => {
    if (!selectedNodeId) {
      setFlowNodes((prev) =>
        prev.map((node) => (node.selected ? { ...node, selected: false } : node))
      );
      return;
    }
    setFlowNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNodeId && !node.selected
          ? { ...node, selected: true }
          : node.id !== selectedNodeId && node.selected
          ? { ...node, selected: false }
          : node
      )
    );
  }, [selectedNodeId, setFlowNodes]);

  const arrangeVertical = useCallback(() => {
    const nodeMeta = new Map(nodes.map((node) => [node.id, node]));
    closeContextMenu();
    setFlowNodes((prev) => {
      let currentY = 0;
      return prev.map((flowNode) => {
        const meta = nodeMeta.get(flowNode.id);
        const nodeHeight = reactFlowInstance?.getNode(flowNode.id)?.height ?? DEFAULT_NODE_HEIGHT;
        const nextNode = {
          ...flowNode,
          position: {
            x: meta?.fromOptionId ? FLOW_BRANCH_OFFSET_X : 0,
            y: currentY,
          },
        };
        currentY += nodeHeight + FLOW_VERTICAL_MARGIN;
        return nextNode;
      });
    });
  }, [closeContextMenu, nodes, reactFlowInstance, setFlowNodes]);

  const arrangeHorizontal = useCallback(() => {
    const nodeMeta = new Map(nodes.map((node) => [node.id, node]));
    closeContextMenu();
    setFlowNodes((prev) => {
      let currentX = 0;
      return prev.map((flowNode) => {
        const meta = nodeMeta.get(flowNode.id);
        const measuredNode = reactFlowInstance?.getNode(flowNode.id);
        const nodeWidth = measuredNode?.width ?? DEFAULT_NODE_WIDTH;
        const nodeHeight = measuredNode?.height ?? DEFAULT_NODE_HEIGHT;
        const nextNode = {
          ...flowNode,
          position: {
            x: meta?.fromOptionId ? currentX + FLOW_BRANCH_OFFSET_X : currentX,
            y: meta?.fromOptionId ? FLOW_VERTICAL_MARGIN : 0,
          },
        };
        currentX += nodeWidth + FLOW_HORIZONTAL_MARGIN;
        const nextY = meta?.fromOptionId ? nodeHeight + FLOW_VERTICAL_MARGIN * 2 : 0;
        return {
          ...nextNode,
          position: {
            ...nextNode.position,
            y: nextY,
          },
        };
      });
    });
  }, [closeContextMenu, nodes, reactFlowInstance, setFlowNodes]);

  const setNodePosition = useCallback(
    (nodeId: string, position: XYPosition) => {
      if (!reactFlowInstance) return;
      setFlowNodes((prev) =>
        prev.map((flowNode) =>
          flowNode.id === nodeId
            ? {
                ...flowNode,
                position,
              }
            : flowNode
        )
      );
    },
    [reactFlowInstance, setFlowNodes]
  );

  const handleNodeContextMenu = useCallback(
    (event: MouseEvent, node: Node<PlotFlowNodeData>) => {
      event.preventDefault();
      if (!wrapperRef.current) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      setContextMenu({
        nodeId: node.id,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    []
  );

  useEffect(() => {
    if (!reactFlowInstance || !onRegisterController) return;
    const controller: FlowTimelineController = {
      focusNode(nodeId: string) {
        const targetNode = reactFlowInstance.getNode(nodeId);
        if (targetNode) {
          reactFlowInstance.fitView({ nodes: [targetNode], padding: 0.4, duration: 300 });
        }
      },
      arrangeVertical,
      arrangeHorizontal,
      setNodePosition,
    };
    onRegisterController(controller);
  }, [reactFlowInstance, onRegisterController, arrangeVertical, arrangeHorizontal, setNodePosition]);

  const flowEdges = useMemo<Edge[]>(() => {
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    return nodes.reduce<Edge[]>((accumulator, plotNode, index) => {
      const parentId =
        typeof plotNode.fromOptionId === 'string' && nodeIdSet.has(plotNode.fromOptionId)
          ? plotNode.fromOptionId
          : null;
      if (parentId) {
        accumulator.push({
          id: `${parentId}-${plotNode.id}`,
          source: parentId,
          target: plotNode.id,
          type: 'smoothstep',
          label: '分支',
          labelBgPadding: [6, 2],
          labelBgBorderRadius: 4,
          labelStyle: { fontSize: 10 },
        });
        return accumulator;
      }
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
    }, []);
  }, [nodes]);

  if (!nodes.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        暂无节点，使用右侧提示词生成或手动插入。
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div ref={wrapperRef} className="relative h-full" style={{ minHeight: FLOW_CANVAS_MIN_HEIGHT }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          selectNodesOnDrag={false}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            closeContextMenu();
            if (onNodeFocus) onNodeFocus(node.id);
          }}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={closeContextMenu}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            closeContextMenu();
          }}
          onMoveStart={closeContextMenu}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            closeContextMenu();
            if (!reactFlowInstance || !wrapperRef.current || !onNodeDrop) return;
            const raw = event.dataTransfer.getData(FLOW_NODE_DRAG_TYPE);
            if (!raw) return;
            let parsed: { kind?: PlotNodeKind };
            try {
              parsed = JSON.parse(raw);
            } catch {
              return;
            }
            if (parsed.kind !== 'dialogue' && parsed.kind !== 'narration' && parsed.kind !== 'branch') return;
            const bounds = wrapperRef.current.getBoundingClientRect();
            const position = reactFlowInstance.project({
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            });
            onNodeDrop(parsed.kind, position);
          }}
          onInit={setReactFlowInstance}
          className="[&_.react-flow__attribution]:hidden"
        >
          <Background gap={24} color="#E5E7EB" />
          <Controls showInteractive={false} />
        </ReactFlow>
        {contextMenu ? (
          <div
            className="absolute z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                closeContextMenu();
                void onCloneNode?.(contextMenu.nodeId);
              }}
            >
              克隆节点
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-destructive hover:bg-destructive/10"
              onClick={() => {
                closeContextMenu();
                void onDeleteNode?.(contextMenu.nodeId);
              }}
            >
              删除节点
            </button>
          </div>
        ) : null}
      </div>
    </ReactFlowProvider>
  );
}
