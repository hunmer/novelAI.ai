"use client"

import * as React from "react"
import { Textarea } from "./textarea"
import { Markdown } from "./markdown"
import { Button } from "./button"
import { Eye, Edit } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 20,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<"edit" | "preview">("preview")

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "edit" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("edit")}
        >
          <Edit className="h-4 w-4 mr-1" />
          编辑
        </Button>
        <Button
          type="button"
          variant={mode === "preview" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("preview")}
        >
          <Eye className="h-4 w-4 mr-1" />
          预览
        </Button>
      </div>

      {mode === "edit" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono"
        />
      ) : (
        <Markdown className={`min-h-[${rows * 24}px]`}>{value || placeholder || ""}</Markdown>
      )}
    </div>
  )
}
