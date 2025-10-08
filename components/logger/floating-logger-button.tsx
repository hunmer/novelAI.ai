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
  const hasMoved = React.useRef(false);
  const latestPosition = React.useRef(position);
  const storageKey = React.useRef('loggerWidgetPosition');

  const clampPosition = React.useCallback((x: number, y: number) => {
    const maxX = Math.max(0, window.innerWidth - 56);
    const maxY = Math.max(0, window.innerHeight - 56);

    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = window.localStorage.getItem(storageKey.current);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        const { x, y } = clampPosition(parsed.x, parsed.y);
        setPosition({ x, y });
        return;
      } catch (error) {
        console.warn('Failed to restore logger widget position', error);
      }
    }

    const initialY = window.innerHeight / 2 - 28;
    const initialX = window.innerWidth - 80;
    setPosition(clampPosition(initialX, initialY));
  }, [clampPosition]);

  React.useEffect(() => {
    latestPosition.current = position;
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
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

      hasMoved.current = true;
      setPosition(clampPosition(newX, newY));
    },
    [clampPosition, isDragging]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    if (typeof window === 'undefined') {
      return;
    }

    const { x, y } = latestPosition.current;
    window.localStorage.setItem(storageKey.current, JSON.stringify({ x, y }));
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
      onClick={() => {
        // 只有在没有拖动时才触发点击
        if (!isDragging && !hasMoved.current) {
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
