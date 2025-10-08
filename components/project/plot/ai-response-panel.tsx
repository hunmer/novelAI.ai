'use client';

import type { FlowgramChoicesSegment, FlowgramSegment } from '@/lib/types/plot';
import { SegmentPreview } from './segment-preview';

export interface AiResponsePanelProps {
  segments: FlowgramSegment[];
  onInsertChoice: (option: FlowgramChoicesSegment['options'][0]) => void;
}

export function AiResponsePanel({ segments, onInsertChoice }: AiResponsePanelProps) {
  return (
    <details className="rounded border border-dashed border-muted bg-background/40 px-3 py-2 text-sm" open>
      <summary className="cursor-pointer select-none text-sm font-semibold outline-none">
        AI 回复结果
      </summary>
      <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-2">
        {segments.length ? (
          segments.map((segment, index) => (
            <SegmentPreview
              key={`${segment.type}-${index}`}
              segment={segment}
              onInsertChoice={onInsertChoice}
            />
          ))
        ) : (
          <div className="rounded border border-dashed border-muted/80 bg-muted/20 p-4 text-xs text-muted-foreground">
            暂无AI回复，先尝试生成剧情节点
          </div>
        )}
      </div>
    </details>
  );
}
