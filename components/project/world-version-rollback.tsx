'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getVersionHistory, rollbackToVersion } from '@/lib/actions/version.actions';
import { VersionDiff } from '@/components/project/version-diff';
import type { Version } from '@prisma/client';
import { ClockIcon, RotateCcwIcon, EyeIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface WorldVersionRollbackProps {
  projectId: string;
  currentContent: string;
  onRestore?: (versionId: string) => void;
}

/**
 * 世界观版本回退组件
 * 增强功能：
 * - 显示版本列表和详细信息
 * - 支持版本内容预览
 * - 支持版本对比差异显示
 * - 支持一键回退到指定版本
 */
export function WorldVersionRollback({
  projectId,
  currentContent,
  onRestore
}: WorldVersionRollbackProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [projectId]);

  const loadVersions = async () => {
    const data = await getVersionHistory(projectId);
    setVersions(data);
  };

  const handleRestore = async (version: Version) => {
    if (!confirm(`确定要恢复到 ${new Date(version.createdAt).toLocaleString('zh-CN')} 的版本吗？此操作将创建新版本。`)) {
      return;
    }

    setIsRestoring(true);
    try {
      await rollbackToVersion(projectId, version.id);
      onRestore?.(version.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleExpand = (versionId: string) => {
    setExpandedId(expandedId === versionId ? null : versionId);
  };

  const handleViewDiff = (version: Version) => {
    setSelectedVersion(version);
    setShowDiff(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ClockIcon className="h-4 w-4" />
          版本历史
        </h3>
        {versions.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {versions.length} 个版本
          </Badge>
        )}
      </div>

      {versions.length === 0 ? (
        <Card className="p-4 text-center text-muted-foreground text-sm">
          暂无版本记录
        </Card>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {versions.map((version, index) => (
            <Card
              key={version.id}
              className="p-3 hover:border-primary/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          当前
                        </Badge>
                      )}
                      <Badge variant={version.source === 'ai' ? 'default' : 'secondary'} className="text-xs">
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

                    {version.metadata && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        提示词: {(version.metadata as any)?.prompt || '无'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpand(version.id)}
                      className="h-7 w-7 p-0"
                    >
                      {expandedId === version.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    {index > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDiff(version)}
                          className="h-7 w-7 p-0"
                          title="查看差异"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isRestoring}
                          onClick={() => handleRestore(version)}
                          className="h-7 w-7 p-0"
                          title="回退到此版本"
                        >
                          <RotateCcwIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {expandedId === version.id && (
                  <div className="pt-2 border-t">
                    <div className="text-xs space-y-1">
                      <p className="text-muted-foreground">内容预览:</p>
                      <div className="bg-muted/50 p-2 rounded-md max-h-32 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                          {version.content.substring(0, 300)}
                          {version.content.length > 300 && '...'}
                        </pre>
                      </div>
                      <p className="text-muted-foreground pt-1">
                        字数: {version.content.length} 字符
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showDiff && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">版本差异对比</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDiff(false)}
              >
                关闭
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <VersionDiff
                oldContent={selectedVersion.content}
                newContent={currentContent}
                oldLabel={`版本 ${new Date(selectedVersion.createdAt).toLocaleString('zh-CN')}`}
                newLabel="当前版本"
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
