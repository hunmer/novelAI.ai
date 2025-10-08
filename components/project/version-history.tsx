'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getVersionHistory, rollbackToVersion } from '@/lib/actions/version.actions';
import type { Version } from '@prisma/client';
import { ClockIcon, RotateCcwIcon } from 'lucide-react';

interface VersionHistoryProps {
  projectId: string;
  onRestore?: (versionId: string) => void;
}

export function VersionHistory({ projectId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [projectId, loadVersions]);

  const loadVersions = useCallback(async () => {
    const data = await getVersionHistory(projectId);
    setVersions(data);
  }, [projectId]);

  const handleRestore = async (versionId: string) => {
    if (!confirm('确定要恢复到此版本吗?')) return;

    setIsRestoring(true);
    try {
      await rollbackToVersion(projectId, versionId);
      onRestore?.(versionId);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <ClockIcon className="h-4 w-4" />
        版本历史
      </h3>
      {versions.length === 0 ? (
        <Card className="p-4 text-center text-muted-foreground text-sm">
          暂无版本记录
        </Card>
      ) : (
        versions.map((version) => (
          <Card
            key={version.id}
            className={`p-3 cursor-pointer ${
              selectedId === version.id ? 'border-primary' : ''
            }`}
            onClick={() => setSelectedId(version.id)}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={version.source === 'ai' ? 'default' : 'secondary'}>
                    {version.source === 'ai' ? 'AI生成' : '手动编辑'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={isRestoring}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestore(version.id);
                }}
              >
                <RotateCcwIcon className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
