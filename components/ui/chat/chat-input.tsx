import { forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, ...props }, ref) => (
    <Textarea
      autoComplete="off"
      ref={ref}
      name="message"
      className={cn(
        'max-h-32 px-4 py-3 bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full rounded-md flex items-center h-20 resize-none',
        className,
      )}
      {...props}
    />
  ),
);

ChatInput.displayName = 'ChatInput';
