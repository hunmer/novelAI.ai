'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2 } from 'lucide-react';

interface ImportSettingsDialogProps {
  projectId: string;
  onImportComplete?: () => void;
}

interface ImportOptions {
  worldview: boolean;
  characters: boolean;
  scenes: boolean;
}

export function ImportSettingsDialog({ projectId, onImportComplete }: ImportSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    worldview: false,
    characters: false,
    scenes: false,
  });

  const handleCheckboxChange = (key: keyof ImportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasSelection = Object.values(options).some((value) => value);

  const handleImport = async () => {
    if (!hasSelection) {
      setError('请至少选择一项内容进行导入');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge/import-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || '导入失败');
      }

      setOpen(false);
      setOptions({
        worldview: false,
        characters: false,
        scenes: false,
      });
      onImportComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="h-4 w-4" />
          一键导入设定
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入项目设定到知识库</DialogTitle>
          <DialogDescription>
            选择需要导入到知识库的项目内容,系统将自动为每项内容生成固定ID并建立索引。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="worldview"
              checked={options.worldview}
              onCheckedChange={() => handleCheckboxChange('worldview')}
            />
            <Label
              htmlFor="worldview"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              世界观设定
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="characters"
              checked={options.characters}
              onCheckedChange={() => handleCheckboxChange('characters')}
            />
            <Label
              htmlFor="characters"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              角色列表
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="scenes"
              checked={options.scenes}
              onCheckedChange={() => handleCheckboxChange('scenes')}
            />
            <Label
              htmlFor="scenes"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              场景列表
            </Label>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isImporting}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !hasSelection}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isImporting ? '导入中...' : '确认导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
