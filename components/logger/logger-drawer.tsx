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
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logger 监控面板
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6">
          <iframe
            src="http://localhost:5173/"
            className="h-full w-full rounded-lg border-0"
            title="Logger Monitor"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
