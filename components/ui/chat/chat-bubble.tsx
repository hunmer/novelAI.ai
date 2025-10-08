import { Children, cloneElement, forwardRef, isValidElement } from 'react';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MessageLoading from './message-loading';
import { Button, type ButtonProps } from '@/components/ui/button';

const chatBubbleVariant = cva('flex gap-3 max-w-[65%] items-center relative group', {
  variants: {
    variant: {
      received: 'self-start',
      sent: 'self-end flex-row-reverse',
    },
    layout: {
      default: '',
      ai: 'max-w-full w-full items-center',
    },
  },
  defaultVariants: {
    variant: 'received',
    layout: 'default',
  },
});

interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof chatBubbleVariant> {}

export const ChatBubble = forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant, layout, children, ...props }, ref) => (
    <div
      className={cn(chatBubbleVariant({ variant, layout, className }), 'relative group')}
      ref={ref}
      {...props}
    >
      {Children.map(children, (child) =>
        isValidElement(child) && typeof child.type !== 'string'
          ? cloneElement(child, {
              variant,
              layout,
            } as ComponentProps<typeof child.type>)
          : child,
      )}
    </div>
  ),
);
ChatBubble.displayName = 'ChatBubble';

interface ChatBubbleAvatarProps {
  src?: string | null;
  fallback?: string;
  className?: string;
}

export function ChatBubbleAvatar({ src, fallback, className }: ChatBubbleAvatarProps) {
  return (
    <Avatar className={cn('h-10 w-10 shrink-0 border border-border bg-background', className)}>
      {src ? <AvatarImage src={src} alt="Avatar" /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

const chatBubbleMessageVariants = cva('px-4 py-3 rounded-2xl shadow-sm border transition-colors', {
  variants: {
    variant: {
      received: 'bg-muted text-foreground border-border',
      sent: 'bg-primary text-primary-foreground border-primary',
    },
    layout: {
      default: '',
      ai: 'border-t w-full rounded-none bg-transparent',
    },
  },
  defaultVariants: {
    variant: 'received',
    layout: 'default',
  },
});

interface ChatBubbleMessageProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleMessageVariants> {
  isLoading?: boolean;
}

export const ChatBubbleMessage = forwardRef<HTMLDivElement, ChatBubbleMessageProps>(
  ({ className, variant, layout, isLoading = false, children, ...props }, ref) => (
    <div
      className={cn(
        chatBubbleMessageVariants({ variant, layout, className }),
        'break-words max-w-full whitespace-pre-wrap',
      )}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <MessageLoading />
        </div>
      ) : (
        children
      )}
    </div>
  ),
);
ChatBubbleMessage.displayName = 'ChatBubbleMessage';

interface ChatBubbleTimestampProps extends HTMLAttributes<HTMLDivElement> {
  timestamp: string;
}

export function ChatBubbleTimestamp({ timestamp, className, ...props }: ChatBubbleTimestampProps) {
  return (
    <div className={cn('mt-2 text-xs text-right text-muted-foreground', className)} {...props}>
      {timestamp}
    </div>
  );
}

type ChatBubbleActionProps = ButtonProps & {
  icon: ReactNode;
};

export function ChatBubbleAction({
  icon,
  onClick,
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: ChatBubbleActionProps) {
  return (
    <Button variant={variant} size={size} className={className} onClick={onClick} {...props}>
      {icon}
    </Button>
  );
}

type ChatBubbleActionWrapperProps = HTMLAttributes<HTMLDivElement>;

export const ChatBubbleActionWrapper = forwardRef<
  HTMLDivElement,
  ChatBubbleActionWrapperProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute left-1/2 top-full z-10 flex -translate-x-1/2 translate-y-2 gap-1 opacity-0 pointer-events-none transition-all duration-200 data-[visible=true]:pointer-events-auto data-[visible=true]:opacity-100',
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
ChatBubbleActionWrapper.displayName = 'ChatBubbleActionWrapper';

export { chatBubbleVariant, chatBubbleMessageVariants };
