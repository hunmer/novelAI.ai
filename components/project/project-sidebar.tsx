'use client';

import { Separator } from '@/components/ui/separator';
import { CreateProjectDialog } from './create-project-dialog';

export function ProjectSidebar() {
  return (
    <aside className="w-64 border-r bg-muted/40 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novel.AI</h2>
          <CreateProjectDialog />
        </div>
        <Separator />
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">项目列表</h3>
          {/* 项目列表将在后续任务中实现 */}
        </div>
      </div>
    </aside>
  );
}
