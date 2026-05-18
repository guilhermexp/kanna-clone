import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Box, Link2, RefreshCw, Search, X } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "../../../lib/utils"
import { Button } from "../../ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../ui/context-menu"
import { MaterialFileIcon, MaterialFolderIcon } from "../../../icons/material-file-icon-components"
import type { useKannaState } from "../../../app/useKannaState"
import { useAppSettingsStore } from "../../../stores/appSettingsStore"
import { useFileTreeStore } from "../../../stores/fileTreeStore"
import { buildTreeGuideSegments } from "./files-tab-guides"
import {
  flattenVisibleTreeRows,
  shouldVirtualizeVisibleRows,
  type FileTreeRowNode,
} from "./files-tab-visible-rows"

interface FilesPanelProps {
  projectId: string
  worktreePath: string
  socket: ReturnType<typeof useKannaState>["socket"]
  onClose: () => void
  onSelectFile?: (absolutePath: string) => void
}

interface FileEntry {
  path: string
  type: "file" | "folder"
  isSymlink?: boolean
}

type FileTreeNode = FileTreeRowNode

const INDENT_PX = 14
const GUIDE_OFFSET_PX = 6
const GUIDE_CONNECTOR_WIDTH_PX = 8
const FIRST_LEVEL_GUIDE_ITEM_GAP_PX = 4
const NESTED_GUIDE_ITEM_GAP_PX = 10

const RECENCY_FRESH = 10_000
const RECENCY_RECENT = 60_000
const RECENCY_FADING = 180_000
const RECENCY_TICK_MS = 2_000

type RecencyLevel = "fresh" | "recent" | "fading" | null

function getRecencyLevel(modifiedAt: number, now: number): RecencyLevel {
  const age = now - modifiedAt
  if (age < RECENCY_FRESH) return "fresh"
  if (age < RECENCY_RECENT) return "recent"
  if (age < RECENCY_FADING) return "fading"
  return null
}

const recencyRowStyles: Record<Exclude<RecencyLevel, null>, string> = {
  fresh: "text-emerald-400",
  recent: "text-amber-400",
  fading: "text-amber-400/50",
}

function useRecentlyModified() {
  const mapRef = useRef(new Map<string, number>())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      for (const [path, ts] of mapRef.current) {
        if (now - ts >= RECENCY_FADING) mapRef.current.delete(path)
      }
      if (mapRef.current.size > 0) setTick((t) => t + 1)
    }, RECENCY_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const markModified = useCallback((relativePath: string) => {
    mapRef.current.set(relativePath, Date.now())
    setTick((t) => t + 1)
  }, [])

  const getLevel = useCallback((relativePath: string): RecencyLevel => {
    const ts = mapRef.current.get(relativePath)
    if (ts == null) return null
    return getRecencyLevel(ts, Date.now())
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const getFolderLevel = useCallback((folderPath: string): RecencyLevel => {
    let best: RecencyLevel = null
    const prefix = folderPath + "/"
    const now = Date.now()
    for (const [path, ts] of mapRef.current) {
      if (path.startsWith(prefix) || path === folderPath) {
        const level = getRecencyLevel(ts, now)
        if (level === "fresh") return "fresh"
        if (level === "recent") best = "recent"
        if (level === "fading" && best == null) best = "fading"
      }
    }
    return best
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { markModified, getLevel, getFolderLevel }
}

function buildFileTree(files: FileEntry[]): FileTreeNode[] {
  type Internal = Omit<FileTreeNode, "children"> & {
    children?: Record<string, Internal>
  }
  const root: Record<string, Internal> = {}
  for (const file of files) {
    const parts = file.path.split("/")
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isLast = i === parts.length - 1
      const pathSoFar = parts.slice(0, i + 1).join("/")
      const nodeType = isLast ? file.type : "folder"
      if (!cur[part]) {
        cur[part] = {
          id: pathSoFar,
          name: part,
          type: nodeType,
          path: pathSoFar,
          isSymlink: isLast ? file.isSymlink : undefined,
          children: nodeType === "folder" ? {} : undefined,
        }
      } else if (isLast && file.isSymlink) {
        cur[part]!.isSymlink = true
      }
      if (nodeType === "folder" && cur[part]!.children) {
        cur = cur[part]!.children!
      }
    }
  }
  function toArray(nodes: Record<string, Internal>): FileTreeNode[] {
    return Object.values(nodes)
      .map((n) => ({
        ...n,
        children: n.children ? toArray(n.children) : undefined,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }
  return toArray(root)
}

function collectAllFolderPaths(nodes: FileTreeNode[]): Set<string> {
  const s = new Set<string>()
  ;(function walk(list: FileTreeNode[]) {
    for (const n of list) {
      if (n.type === "folder" && n.children) {
        s.add(n.path)
        walk(n.children)
      }
    }
  })(nodes)
  return s
}

function collectRootFolderPaths(nodes: FileTreeNode[]): Set<string> {
  const s = new Set<string>()
  for (const n of nodes) if (n.type === "folder") s.add(n.path)
  return s
}

function parentPath(p: string): string | null {
  const i = p.lastIndexOf("/")
  return i > 0 ? p.slice(0, i) : null
}

interface TreeNodeProps {
  node: FileTreeNode
  level: number
  focusedPath: string | null
  activePath: string | null
  isExpanded: boolean
  ancestorContinuationMask: string
  hasNextSibling: boolean
  editorLabel: string
  recencyLevel: RecencyLevel
  onToggleExpand: (path: string) => void
  onActivate: (path: string) => void
  onFocus: (path: string) => void
  onContextAction: (action: string, node: FileTreeNode) => void
  treeRef: React.RefObject<HTMLDivElement | null>
}

const TreeNode = memo(function TreeNode({
  node,
  level,
  focusedPath,
  activePath,
  isExpanded,
  ancestorContinuationMask,
  hasNextSibling,
  editorLabel,
  recencyLevel,
  onToggleExpand,
  onActivate,
  onFocus,
  onContextAction,
  treeRef,
}: TreeNodeProps) {
  const isFolder = node.type === "folder"
  const isFocused = focusedPath === node.path
  const isActive = !isFocused && activePath === node.path
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [isFocused])

  const handleClick = useCallback(() => {
    onFocus(node.path)
    if (isFolder) {
      onToggleExpand(node.path)
    } else {
      onActivate(node.path)
    }
    treeRef.current?.focus()
  }, [isFolder, onToggleExpand, onActivate, onFocus, node.path, treeRef])

  const guideSegments = useMemo(() => {
    return buildTreeGuideSegments(
      level,
      Array.from(ancestorContinuationMask, (token) => token === "1"),
      hasNextSibling,
    )
  }, [level, ancestorContinuationMask, hasNextSibling])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          role="treeitem"
          aria-expanded={isFolder ? isExpanded : undefined}
          data-file-tree-node="true"
          data-node-path={node.path}
          data-node-type={node.type}
          onClick={handleClick}
          className={cn(
            "group relative flex h-6 w-full cursor-pointer select-none items-center rounded-md pr-2 transition-colors duration-150",
            isFocused
              ? "bg-accent text-accent-foreground"
              : isActive
                ? "bg-accent/40 text-accent-foreground"
                : recencyLevel && !isFocused
                  ? recencyRowStyles[recencyLevel]
                  : node.isSymlink
                    ? "text-muted-foreground/70 hover:bg-accent/35 hover:text-foreground"
                    : "text-foreground hover:bg-accent/35",
          )}
          style={{
            paddingLeft:
              8 +
              (level * INDENT_PX) +
              (level === 1
                ? FIRST_LEVEL_GUIDE_ITEM_GAP_PX
                : level > 1
                  ? NESTED_GUIDE_ITEM_GAP_PX
                  : 0),
          }}
        >
          {guideSegments.length > 0 && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {guideSegments.map((segment, index) => {
                const left = 8 + (segment.depth * INDENT_PX) + GUIDE_OFFSET_PX
                if (segment.kind === "ancestor-vertical") {
                  return (
                    <span
                      key={`${segment.kind}-${segment.depth}-${index}`}
                      className="absolute inset-y-0 w-px bg-border/35"
                      style={{ left }}
                    />
                  )
                }
                if (segment.kind === "current-top") {
                  return (
                    <span
                      key={`${segment.kind}-${segment.depth}-${index}`}
                      className="absolute w-px bg-border/35"
                      style={{ left, top: 0, height: "50%" }}
                    />
                  )
                }
                if (segment.kind === "current-bottom") {
                  return (
                    <span
                      key={`${segment.kind}-${segment.depth}-${index}`}
                      className="absolute bottom-0 w-px bg-border/35"
                      style={{ left, top: "50%" }}
                    />
                  )
                }
                return (
                  <span
                    key={`${segment.kind}-${segment.depth}-${index}`}
                    className="absolute h-px bg-border/35"
                    style={{
                      left,
                      top: "50%",
                      width: GUIDE_CONNECTOR_WIDTH_PX,
                    }}
                  />
                )
              })}
            </div>
          )}
          <span className={cn(
            "relative z-[1] mr-1.5 flex h-full w-4 shrink-0 items-center justify-center",
            node.isSymlink && !isFocused && "opacity-75",
          )}>
            {isFolder
              ? <MaterialFolderIcon folderName={node.name} isOpen={isExpanded} className="size-[15px]" />
              : <MaterialFileIcon fileName={node.name} className="size-[15px]" />}
            {node.isSymlink && (
              <span className="absolute -bottom-0.5 -left-0.5 flex size-2.5 items-center justify-center rounded-full bg-background/90 text-muted-foreground ring-1 ring-border/60">
                <Link2 className="size-1.5" strokeWidth={2.4} />
              </span>
            )}
          </span>
          <span className="relative z-[1] min-w-0 truncate text-[12px] leading-none">{node.name}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!isFolder && (
          <>
            <ContextMenuItem onClick={() => onContextAction("open-preview", node)}>
              Open
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={() => onContextAction("open-editor", node)}>
          Open in {editorLabel}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onContextAction("reveal-finder", node)}>
          Reveal in Finder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onContextAction("copy-path", node)}>
          Copy Path
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onContextAction("copy-relative", node)}>
          Copy Relative Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

export const FilesPanel = memo(function FilesPanel({
  projectId,
  worktreePath,
  socket,
  onClose,
  onSelectFile,
}: FilesPanelProps) {
  const treeRef = useRef<HTMLDivElement>(null)
  const treeScrollRef = useRef<HTMLDivElement>(null)
  const [allFiles, setAllFiles] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [filter, setFilter] = useState("")
  const [focusedPath, setFocusedPath] = useState<string | null>(null)

  const showHidden = useFileTreeStore((state) => state.showHiddenByProject[projectId] ?? false)
  const setShowHidden = useFileTreeStore((state) => state.setShowHidden)
  const storedExpanded = useFileTreeStore((state) => state.expandedByProject[projectId] ?? null)
  const setStoredExpanded = useFileTreeStore((state) => state.setExpanded)

  const editorPreset = useAppSettingsStore((store) => store.settings?.editor.preset ?? "cursor")
  const editorLabel = useMemo(() => {
    switch (editorPreset) {
      case "vscode": return "VS Code"
      case "xcode": return "Xcode"
      case "windsurf": return "Windsurf"
      case "cursor": return "Cursor"
      case "custom": return "Editor"
      default: return "Editor"
    }
  }, [editorPreset])

  const expandedPaths = useMemo(() => new Set(storedExpanded ?? []), [storedExpanded])
  const expandedPathsRef = useRef(expandedPaths)
  expandedPathsRef.current = expandedPaths

  const setExpandedPaths = useCallback(
    (update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      const prev = expandedPathsRef.current
      const next = typeof update === "function" ? update(prev) : update
      setStoredExpanded(projectId, [...next])
    },
    [projectId, setStoredExpanded],
  )

  const { markModified, getLevel: getFileRecencyLevel, getFolderLevel } = useRecentlyModified()

  const getNodeRecencyLevel = useCallback(
    (path: string, type: "file" | "folder"): RecencyLevel =>
      type === "folder" ? getFolderLevel(path) : getFileRecencyLevel(path),
    [getFileRecencyLevel, getFolderLevel],
  )

  useEffect(() => {
    let cancelled = false
    if (!projectId) return
    setLoading(true)
    socket
      .command<{ entries: FileEntry[]; projectPath: string }>({
        type: "project.files.list",
        projectId,
        showHidden,
      })
      .then((result) => {
        if (cancelled) return
        setAllFiles(result.entries)
      })
      .catch((error: unknown) => {
        console.warn("[kanna/files] list failed", error)
        if (!cancelled) setAllFiles([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, showHidden, socket, reloadTick])

  const refresh = useCallback(() => {
    socket
      .command({ type: "project.files.clearCache", projectId })
      .catch(() => undefined)
      .finally(() => setReloadTick((t) => t + 1))
  }, [projectId, socket])

  const filteredEntries = useMemo(() => {
    if (!allFiles) return null
    if (!filter.trim()) return allFiles
    const q = filter.toLowerCase()
    const matched = allFiles.filter((entry) => entry.path.toLowerCase().includes(q))
    const dirs = new Set<string>()
    for (const entry of matched) {
      const parts = entry.path.split("/")
      let cur = ""
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i]!
        dirs.add(cur)
      }
    }
    const result: FileEntry[] = []
    const seen = new Set<string>()
    for (const entry of allFiles) {
      if (matched.includes(entry) || (entry.type === "folder" && dirs.has(entry.path))) {
        if (!seen.has(entry.path)) {
          seen.add(entry.path)
          result.push(entry)
        }
      }
    }
    return result
  }, [allFiles, filter])

  const tree = useMemo(() => (filteredEntries ? buildFileTree(filteredEntries) : []), [filteredEntries])
  const allFolderPaths = useMemo(() => collectAllFolderPaths(tree), [tree])

  useEffect(() => {
    if (tree.length > 0 && storedExpanded === null) {
      setStoredExpanded(projectId, [...collectRootFolderPaths(tree)])
    }
  }, [tree, storedExpanded, projectId, setStoredExpanded])

  const effectiveExpanded = useMemo(
    () => (filter.trim() ? allFolderPaths : expandedPaths),
    [filter, allFolderPaths, expandedPaths],
  )

  const visibleRows = useMemo(
    () => flattenVisibleTreeRows(tree, effectiveExpanded),
    [tree, effectiveExpanded],
  )
  const visibleNodes = useMemo(() => visibleRows.map((row) => row.node), [visibleRows])
  const shouldVirtualizeTree = useMemo(
    () => shouldVirtualizeVisibleRows(visibleRows.length),
    [visibleRows.length],
  )
  const focusedNodeIndex = useMemo(
    () => focusedPath ? visibleRows.findIndex((row) => row.node.path === focusedPath) : -1,
    [focusedPath, visibleRows],
  )
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
    enabled: shouldVirtualizeTree,
  })

  useEffect(() => {
    if (!shouldVirtualizeTree || focusedNodeIndex < 0) return
    rowVirtualizer.scrollToIndex(focusedNodeIndex, { align: "auto" })
  }, [focusedNodeIndex, rowVirtualizer, shouldVirtualizeTree])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [setExpandedPaths])

  const activateFile = useCallback(
    (relativePath: string) => {
      if (!worktreePath) return
      const absolute = `${worktreePath}/${relativePath}`
      markModified(relativePath)
      onSelectFile?.(absolute)
    },
    [worktreePath, onSelectFile, markModified],
  )

  const isAllExpanded = useMemo(() => {
    if (allFolderPaths.size === 0) return false
    for (const p of allFolderPaths) {
      if (!expandedPaths.has(p)) return false
    }
    return true
  }, [allFolderPaths, expandedPaths])

  const toggleExpandCollapse = useCallback(() => {
    setExpandedPaths((prev) => {
      if (prev.size > 0) {
        setFocusedPath(null)
        return new Set()
      }
      return new Set(allFolderPaths)
    })
  }, [allFolderPaths, setExpandedPaths])

  const toAbsolute = useCallback(
    (relativePath: string) => (worktreePath ? `${worktreePath}/${relativePath}` : relativePath),
    [worktreePath],
  )

  const handleContextAction = useCallback(
    (action: string, node: FileTreeNode) => {
      const absolutePath = toAbsolute(node.path)
      switch (action) {
        case "open-preview":
          if (node.type === "file") activateFile(node.path)
          break
        case "open-editor":
          void socket.command({
            type: "system.openExternal",
            localPath: absolutePath,
            action: "open_editor",
          }).catch(() => undefined)
          break
        case "reveal-finder":
          void socket.command({
            type: "system.openExternal",
            localPath: absolutePath,
            action: "open_finder",
          }).catch(() => undefined)
          break
        case "copy-path":
          navigator.clipboard.writeText(absolutePath).catch(() => undefined)
          break
        case "copy-relative":
          navigator.clipboard.writeText(node.path).catch(() => undefined)
          break
        default:
          break
      }
    },
    [toAbsolute, activateFile, socket],
  )

  const refocusTree = useCallback(() => {
    requestAnimationFrame(() => treeRef.current?.focus())
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visibleNodes.length === 0) return
      const idx = focusedPath ? visibleNodes.findIndex((n) => n.path === focusedPath) : -1
      const focusIndex = (i: number) => {
        const clamped = Math.max(0, Math.min(i, visibleNodes.length - 1))
        setFocusedPath(visibleNodes[clamped]!.path)
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          focusIndex(idx < 0 ? 0 : idx + 1)
          break
        case "ArrowUp":
          e.preventDefault()
          focusIndex(idx <= 0 ? 0 : idx - 1)
          break
        case "ArrowRight":
          e.preventDefault()
          if (idx < 0) break
          {
            const node = visibleNodes[idx]!
            if (node.type === "folder" && node.children) {
              if (!expandedPaths.has(node.path)) {
                toggleExpand(node.path)
                refocusTree()
              } else if (node.children.length > 0) {
                setFocusedPath(node.children[0]!.path)
              }
            }
          }
          break
        case "ArrowLeft":
          e.preventDefault()
          if (idx < 0) break
          {
            const node = visibleNodes[idx]!
            if (node.type === "folder" && node.children && expandedPaths.has(node.path)) {
              toggleExpand(node.path)
              refocusTree()
            } else {
              const pp = parentPath(node.path)
              if (pp) setFocusedPath(pp)
            }
          }
          break
        case "Enter":
          e.preventDefault()
          if (idx < 0) break
          {
            const node = visibleNodes[idx]!
            if (node.type === "folder") toggleExpand(node.path)
            else activateFile(node.path)
            refocusTree()
          }
          break
        case " ":
          e.preventDefault()
          if (idx < 0) break
          {
            const node = visibleNodes[idx]!
            if (node.type === "file") activateFile(node.path)
            else toggleExpand(node.path)
            refocusTree()
          }
          break
        case "Home":
          e.preventDefault()
          focusIndex(0)
          break
        case "End":
          e.preventDefault()
          focusIndex(visibleNodes.length - 1)
          break
        default:
          break
      }
    },
    [visibleNodes, focusedPath, expandedPaths, toggleExpand, activateFile, refocusTree],
  )

  const worktreeName = worktreePath.split("/").pop() || "workspace"

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden p-2">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/50">
        <div className="flex h-9 flex-shrink-0 items-center gap-2 px-2 bg-muted/30">
          <Box className="size-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium text-foreground flex-shrink-0">Files</span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setShowHidden(projectId, !showHidden)}
              title={showHidden ? "Hide hidden files" : "Show hidden files"}
            >
              <span className={cn("text-[10px] font-semibold", showHidden ? "text-foreground" : "text-muted-foreground")}>
                .{showHidden ? "✓" : ""}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={toggleExpandCollapse}
              title={isAllExpanded ? "Collapse all" : "Expand all"}
            >
              <span className="text-[10px] font-semibold text-muted-foreground">
                {isAllExpanded ? "−" : "+"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={refresh}
              title="Refresh"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onClose}
              title="Close"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex h-8 flex-shrink-0 items-center gap-1.5 border-t border-border/40 px-2">
          <Search className="size-3 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="text-muted-foreground hover:text-foreground"
              title="Clear"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div
          ref={treeScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 pt-1.5"
        >
          {loading && !allFiles ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">Loading files…</p>
            </div>
          ) : tree.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                {filter ? "No files match the filter" : "No files"}
              </p>
            </div>
          ) : (
            <div
              ref={treeRef}
              role="tree"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="outline-none"
            >
              <div
                className="flex h-6 w-full select-none items-center rounded-md pr-2 text-foreground"
                style={{ paddingLeft: 8 }}
              >
                <span className="mr-1.5 flex h-full w-4 shrink-0 items-center justify-center">
                  <MaterialFolderIcon folderName={worktreeName} isOpen className="size-[15px]" />
                </span>
                <span className="min-w-0 truncate text-[12px] font-medium leading-none">{worktreeName}</span>
              </div>
              {shouldVirtualizeTree ? (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = visibleRows[virtualRow.index]
                    if (!row) return null
                    return (
                      <div
                        key={row.node.id}
                        className="absolute left-0 top-0 w-full"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TreeNode
                          node={row.node}
                          level={row.level}
                          focusedPath={focusedPath}
                          activePath={null}
                          isExpanded={row.node.type === "folder" && !!row.node.children && effectiveExpanded.has(row.node.path)}
                          ancestorContinuationMask={row.ancestorContinuationMask}
                          hasNextSibling={row.hasNextSibling}
                          editorLabel={editorLabel}
                          recencyLevel={getNodeRecencyLevel(row.node.path, row.node.type)}
                          onToggleExpand={toggleExpand}
                          onActivate={activateFile}
                          onFocus={setFocusedPath}
                          onContextAction={handleContextAction}
                          treeRef={treeRef}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                visibleRows.map((row) => (
                  <TreeNode
                    key={row.node.id}
                    node={row.node}
                    level={row.level}
                    focusedPath={focusedPath}
                    activePath={null}
                    isExpanded={row.node.type === "folder" && !!row.node.children && effectiveExpanded.has(row.node.path)}
                    ancestorContinuationMask={row.ancestorContinuationMask}
                    hasNextSibling={row.hasNextSibling}
                    editorLabel={editorLabel}
                    recencyLevel={getNodeRecencyLevel(row.node.path, row.node.type)}
                    onToggleExpand={toggleExpand}
                    onActivate={activateFile}
                    onFocus={setFocusedPath}
                    onContextAction={handleContextAction}
                    treeRef={treeRef}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
