import { Children, cloneElement, forwardRef, isValidElement } from 'react';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MessageLoading from './message-loading';
import { Button, type ButtonProps } from '@/components/ui/button';

const chatBubbleVariant = cva('flex gap-2 max-w-[60%] items-end relative group', {
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
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="Avatar" /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

const chatBubbleMessageVariants = cva('p-4', {
  variants: {
    variant: {
      received: 'bg-secondary text-secondary-foreground rounded-r-lg rounded-tl-lg',
      sent: 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg',
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
    <div className={cn('text-xs mt-2 text-right text-muted-foreground', className)} {...props}>
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

interface ChatBubbleActionWrapperProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'sent' | 'received';
  className?: string;
}

export const ChatBubbleActionWrapper = forwardRef<
  HTMLDivElement,
  ChatBubbleActionWrapperProps
>(({ variant, className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200',
      variant === 'sent'
        ? '-left-1 -translate-x-full flex-row-reverse'
        : '-right-1 translate-x-full',
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
ChatBubbleActionWrapper.displayName = 'ChatBubbleActionWrapper';

export { chatBubbleVariant, chatBubbleMessageVariants };
