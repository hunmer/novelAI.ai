'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterProps {
  text: string;
  typeSpeed?: number;
  className?: string;
  onComplete?: () => void;
  cursor?: boolean;
}

export function Typewriter({
  text,
  typeSpeed = 30,
  className,
  onComplete,
  cursor = true,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const currentIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 如果新文本比当前显示的文本长,继续打字
    if (currentIndexRef.current < text.length) {
      // 清除之前的 timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDisplayedText(text.substring(0, currentIndexRef.current + 1));
        currentIndexRef.current += 1;
      }, typeSpeed);
    } else if (currentIndexRef.current === text.length && currentIndexRef.current > 0 && onComplete) {
      onComplete();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, typeSpeed, onComplete]);

  useEffect(() => {
    if (cursor) {
      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 500);

      return () => clearInterval(interval);
    }
  }, [cursor]);

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {displayedText}
      {cursor && currentIndexRef.current < text.length && (
        <span className={cn('inline-block w-0.5 h-5 bg-current ml-0.5', showCursor ? 'opacity-100' : 'opacity-0')}>
          |
        </span>
      )}
    </span>
  );
}
