import { useState } from "react"
import Editor from "@monaco-editor/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { AlertCircle, Code2, Loader2, BookOpen } from "lucide-react"
import { Button } from "../../ui/button"
import { cn } from "../../../lib/utils"
import { useTheme } from "../../../hooks/useTheme"
import type { useKannaState } from "../../../app/useKannaState"
import { defaultEditorOptions, getMonacoTheme } from "./monaco-config"
import { getFileName } from "./language-map"
import { useFileContent, getErrorMessage } from "./use-file-content"

interface MarkdownViewerProps {
  filePath: string
  projectPath: string
  socket: ReturnType<typeof useKannaState>["socket"]
}

export function MarkdownViewer({ filePath, projectPath, socket }: MarkdownViewerProps) {
  const fileName = getFileName(filePath)
  const { resolvedTheme } = useTheme()
  const monacoTheme = getMonacoTheme(resolvedTheme)
  const [showPreview, setShowPreview] = useState(true)
  const { content, isLoading, error } = useFileContent(socket, projectPath, filePath)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-sm">Loading file…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-[300px]">
          <AlertCircle className="size-10 text-muted-foreground" />
          <p className="font-medium text-foreground">{getErrorMessage(error)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-border/40 px-2 bg-muted/20">
        <span className="text-xs text-muted-foreground truncate" title={fileName}>{fileName}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview((prev) => !prev)}
          className="h-6 px-2 text-xs"
        >
          <div className="relative size-3.5 mr-1">
            <BookOpen
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,transform] duration-200 ease-out",
                showPreview ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
            <Code2
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,transform] duration-200 ease-out",
                !showPreview ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
          </div>
          {showPreview ? "Source" : "Preview"}
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {showPreview ? (
          <div className="h-full overflow-auto p-6 prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || ""}
            </ReactMarkdown>
          </div>
        ) : (
          <Editor
            height="100%"
            language="markdown"
            value={content || ""}
            theme={monacoTheme}
            options={defaultEditorOptions}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
