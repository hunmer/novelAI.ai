'use client';

import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { FileText } from 'lucide-react';

interface LoggerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoggerDrawer({ open, onOpenChange }: LoggerDrawerProps) {
  // iframe 始终保持挂载状态,避免重新加载
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  return (
    <>
      {/* iframe 独立于 drawer 挂载,始终存在 */}
      <div
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{
          display: open ? 'block' : 'none',
        }}
      >
        <div className="absolute right-0 top-0 h-full w-full sm:max-w-2xl pointer-events-auto">
          <div className="flex h-full flex-col bg-background">
            <iframe
              ref={iframeRef}
              src="http://localhost:5173/"
              className="h-full w-full border-0"
              title="Logger Monitor"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
        </div>
      </div>

      {/* drawer 只负责背景遮罩和标题栏 */}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="right" className="flex w-full flex-col sm:max-w-2xl bg-transparent shadow-none border-0">
          <DrawerHeader className="flex-shrink-0 bg-background rounded-tl-lg">
            <DrawerTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Logger 监控面板
            </DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </>
  );
}
