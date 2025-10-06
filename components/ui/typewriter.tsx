'use client';

import { useEffect, useState } from 'react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, typeSpeed);

      return () => clearTimeout(timeout);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, typeSpeed, onComplete]);

  useEffect(() => {
    if (cursor) {
      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 500);

      return () => clearInterval(interval);
    }
  }, [cursor]);

  // 重置当文本改变时
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {displayedText}
      {cursor && currentIndex < text.length && (
        <span className={cn('inline-block w-0.5 h-5 bg-current ml-0.5', showCursor ? 'opacity-100' : 'opacity-0')}>
          |
        </span>
      )}
    </span>
  );
}
