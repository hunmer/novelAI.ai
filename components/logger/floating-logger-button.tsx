'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingLoggerButtonProps {
  onClick: () => void;
}

export function FloatingLoggerButton({ onClick }: FloatingLoggerButtonProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dragStart = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    // 初始位置设置在右侧中间
    const initialY = window.innerHeight / 2 - 28;
    const initialX = window.innerWidth - 80;
    setPosition({ x: initialX, y: initialY });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;

      // 限制在窗口范围内
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    },
    [isDragging]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <button
      ref={buttonRef}
      onClick={(e) => {
        // 只有在没有拖动时才触发点击
        if (!isDragging) {
          onClick();
        }
      }}
      onMouseDown={handleMouseDown}
      className={cn(
        'fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 active:scale-95',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-grab'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      aria-label="打开Logger监控面板"
    >
      <FileText className="h-6 w-6" />
    </button>
  );
}
