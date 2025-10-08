import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import { cn } from "@/lib/utils"

interface MarkdownProps {
  children: string
  className?: string
}

const Markdown = React.forwardRef<HTMLDivElement, MarkdownProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "markdown-content w-full rounded-md border border-input px-3 py-2 text-base prose prose-sm dark:prose-invert max-w-none overflow-auto break-words",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {children}
        </ReactMarkdown>
      </div>
    )
  }
)
Markdown.displayName = "Markdown"

export { Markdown } 
