import { memo, useCallback, useEffect, useMemo, useState } from "react"
import Editor from "@monaco-editor/react"
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileWarning,
  FolderOpen,
  Loader2,
  Map,
  Maximize2,
  PanelRight,
  Settings2,
  WrapText,
  X,
} from "lucide-react"
import { Button } from "../../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"
import { cn } from "../../../lib/utils"
import { useTheme } from "../../../hooks/useTheme"
import { MaterialFileIcon } from "../../../icons/material-file-icon-components"
import type { useKannaState } from "../../../app/useKannaState"
import { useFileTreeStore, type FileViewerMode } from "../../../stores/fileTreeStore"
import { ImageViewer } from "./ImageViewer"
import { MarkdownViewer } from "./MarkdownViewer"
import { defaultEditorOptions, getMonacoTheme } from "./monaco-config"
import {
  formatFileSize,
  getFileName,
  getFileViewerType,
  getMonacoLanguage,
} from "./language-map"
import { useFileContent, getErrorMessage } from "./use-file-content"

interface FileViewerProps {
  filePath: string
  projectPath: string
  socket: ReturnType<typeof useKannaState>["socket"]
  onClose: () => void
  /** Default "dialog" — fixed overlay. "side-peek" renders inline (caller controls layout). */
  mode?: FileViewerMode
}

export const FileViewer = memo(function FileViewer({
  filePath,
  projectPath,
  socket,
  onClose,
  mode = "dialog",
}: FileViewerProps) {
  const fileName = getFileName(filePath)
  const viewerType = useMemo(() => getFileViewerType(filePath), [filePath])
  const absolutePath = useMemo(
    () => (filePath.startsWith("/") ? filePath : `${projectPath}/${filePath}`),
    [filePath, projectPath],
  )
  const setViewerMode = useFileTreeStore((s) => s.setViewerMode)

  const handleOpenInEditor = useCallback(() => {
    void socket
      .command({ type: "system.openExternal", localPath: absolutePath, action: "open_editor" })
      .catch(() => undefined)
  }, [socket, absolutePath])

  const handleRevealInFinder = useCallback(() => {
    void socket
      .command({ type: "system.openExternal", localPath: absolutePath, action: "open_finder" })
      .catch(() => undefined)
  }, [socket, absolutePath])

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(absolutePath).catch(() => undefined)
  }, [absolutePath])

  useEffect(() => {
    if (mode !== "dialog") return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, mode])

  const content = (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden bg-background",
        mode === "dialog" ? "h-full max-w-[1400px] rounded-lg border border-border shadow-2xl" : "h-full border-l border-border/60",
      )}
    >
      <Header
        fileName={fileName}
        filePath={filePath}
        mode={mode}
        onSwitchMode={setViewerMode}
        onClose={onClose}
        onOpenInEditor={handleOpenInEditor}
        onRevealInFinder={handleRevealInFinder}
        onCopyPath={handleCopyPath}
      />
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        {viewerType === "image" ? (
          <ImageViewer filePath={filePath} projectPath={projectPath} socket={socket} />
        ) : viewerType === "markdown" ? (
          <MarkdownViewer filePath={filePath} projectPath={projectPath} socket={socket} />
        ) : viewerType === "unsupported" ? (
          <UnsupportedFile
            fileName={fileName}
            filePath={absolutePath}
            onOpenInEditor={handleOpenInEditor}
          />
        ) : (
          <CodeViewer filePath={filePath} projectPath={projectPath} socket={socket} />
        )}
      </div>
    </div>
  )

  if (mode === "side-peek") {
    return content
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-[2px] p-4 md:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {content}
    </div>
  )
})

function Header({
  fileName,
  filePath,
  mode,
  onSwitchMode,
  onClose,
  onOpenInEditor,
  onRevealInFinder,
  onCopyPath,
}: {
  fileName: string
  filePath: string
  mode: FileViewerMode
  onSwitchMode: (mode: FileViewerMode) => void
  onClose: () => void
  onOpenInEditor: () => void
  onRevealInFinder: () => void
  onCopyPath: () => void
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    onCopyPath()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [onCopyPath])

  const toggleMode = useCallback(() => {
    onSwitchMode(mode === "dialog" ? "side-peek" : "dialog")
  }, [mode, onSwitchMode])

  return (
    <div className="flex h-11 flex-shrink-0 items-center justify-between gap-2 border-b border-border px-2 bg-muted/30">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 flex-shrink-0"
          onClick={onClose}
          title={mode === "dialog" ? "Close (Esc)" : "Close"}
        >
          <X className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 flex-shrink-0"
          onClick={toggleMode}
          title={mode === "dialog" ? "Switch to side panel" : "Switch to dialog"}
        >
          {mode === "dialog" ? <PanelRight className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
        <MaterialFileIcon fileName={fileName} className="size-4 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={filePath}>{fileName}</div>
          <div className="truncate text-[11px] text-muted-foreground" title={filePath}>{filePath}</div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenInEditor}
          className="h-7 px-2 text-xs gap-1.5"
          title="Open in editor"
        >
          <ExternalLink className="size-3.5" />
          <span className="hidden sm:inline">Open in editor</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRevealInFinder}
          title="Reveal in Finder"
        >
          <FolderOpen className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy path"}
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function CodeViewer({
  filePath,
  projectPath,
  socket,
}: {
  filePath: string
  projectPath: string
  socket: ReturnType<typeof useKannaState>["socket"]
}) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = getMonacoTheme(resolvedTheme)
  const language = useMemo(() => getMonacoLanguage(filePath), [filePath])
  const { content, isLoading, error, byteLength } = useFileContent(socket, projectPath, filePath)
  const [wordWrap, setWordWrap] = useState(false)
  const [minimap, setMinimap] = useState(true)
  const [lineNumbers, setLineNumbers] = useState(true)

  const editorOptions = useMemo(
    () => ({
      ...defaultEditorOptions,
      wordWrap: wordWrap ? ("on" as const) : ("off" as const),
      minimap: { enabled: minimap },
      lineNumbers: lineNumbers ? ("on" as const) : ("off" as const),
    }),
    [wordWrap, minimap, lineNumbers],
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertCircle className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{getErrorMessage(error)}</p>
          {byteLength !== null && error === "too-large" && (
            <p className="text-xs text-muted-foreground">File size: {formatFileSize(byteLength)}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-b border-border/40 px-2 text-xs text-muted-foreground bg-muted/20">
        <div className="flex items-center gap-2">
          <span>{language}</span>
          {byteLength !== null && (
            <>
              <span>·</span>
              <span>{formatFileSize(byteLength)}</span>
            </>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6" title="View options">
              <Settings2 className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-2">
            <button
              type="button"
              onClick={() => setWordWrap((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                wordWrap && "text-foreground"
              )}
            >
              <WrapText className="size-3.5" />
              <span className="flex-1 text-left">Word wrap</span>
              {wordWrap && <Check className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setMinimap((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                minimap && "text-foreground"
              )}
            >
              <Map className="size-3.5" />
              <span className="flex-1 text-left">Minimap</span>
              {minimap && <Check className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setLineNumbers((v) => !v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                lineNumbers && "text-foreground"
              )}
            >
              <span className="size-3.5 text-center text-[10px]">#</span>
              <span className="flex-1 text-left">Line numbers</span>
              {lineNumbers && <Check className="size-3.5" />}
            </button>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={content || ""}
          theme={monacoTheme}
          options={editorOptions}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        />
      </div>
    </div>
  )
}

function UnsupportedFile({
  fileName,
  filePath,
  onOpenInEditor,
}: {
  fileName: string
  filePath: string
  onOpenInEditor: () => void
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <FileWarning className="size-12 text-muted-foreground" />
        <div>
          <p className="text-base font-medium text-foreground">{fileName}</p>
          <p className="text-xs text-muted-foreground mt-1 break-all">{filePath}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          This file type can&apos;t be previewed inline.
        </p>
        <Button onClick={onOpenInEditor} size="sm" className="gap-1.5">
          <ExternalLink className="size-3.5" />
          Open in editor
        </Button>
      </div>
    </div>
  )
}
