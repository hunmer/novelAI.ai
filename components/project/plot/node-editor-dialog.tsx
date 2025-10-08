'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PlotNode, PlotNodeKind } from '@/lib/types/plot';

export interface NodeEditorFormValues {
  character: string;
  action: string;
  text: string;
}

export interface NodeEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  kind: PlotNodeKind;
  initialNode?: PlotNode;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: NodeEditorFormValues) => void;
}

export function NodeEditorDialog({
  open,
  mode,
  kind,
  initialNode,
  submitting,
  error,
  onClose,
  onSubmit,
}: NodeEditorDialogProps) {
  const [character, setCharacter] = useState('');
  const [action, setAction] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) return;
    setCharacter(initialNode?.character ?? '');
    setAction(initialNode?.action ?? '');
    setText(initialNode?.text ?? '');
  }, [open, initialNode]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit({
        character: character.trim(),
        action: action.trim(),
        text: text.trim(),
      });
    },
    [action, character, onSubmit, text]
  );

  const isDialogue = kind === 'dialogue';
  const isTextEmpty = !text.trim();

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? `新建${isDialogue ? '角色消息' : '旁白'}`
              : `编辑${isDialogue ? '角色消息' : '旁白'}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '填写节点内容并保存到当前工作流。'
              : '更新节点内容并保存修改。'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDialogue ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="node-editor-character">角色名称</Label>
                <Input
                  id="node-editor-character"
                  value={character}
                  onChange={(event) => setCharacter(event.target.value)}
                  placeholder="例如：林安"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="node-editor-action">语气 / 动作</Label>
                <Input
                  id="node-editor-action"
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  placeholder="例如：低声说"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="node-editor-text">节点内容</Label>
            <Textarea
              id="node-editor-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder={isDialogue ? '输入角色对话内容…' : '输入旁白内容…'}
            />
          </div>
          {error ? (
            <div className="rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || isTextEmpty}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? '创建节点' : '保存修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
