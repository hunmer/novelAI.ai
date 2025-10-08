'use client';

import { AlignLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { FlowgramChoicesSegment, FlowgramSegment } from '@/lib/types/plot';

export interface SegmentPreviewProps {
  segment: FlowgramSegment;
  onInsertChoice: (option: FlowgramChoicesSegment['options'][0]) => void;
}

export function SegmentPreview({ segment, onInsertChoice }: SegmentPreviewProps) {
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
              <Button size="sm" variant="outline" onClick={() => onInsertChoice(option)}>
                插入分支
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
