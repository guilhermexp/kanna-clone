import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { KannaSocket } from "../../../app/socket"
import { filterSlashCommands } from "./slash-commands"
import { findTrigger, type AutocompleteItem, type TriggerMatch } from "./types"

interface FileEntryWire {
  path: string
  type: "file" | "folder"
}

const FILES_CACHE = new Map<string, FileEntryWire[]>()

interface UseAutocompleteArgs {
  value: string
  cursor: number
  projectId: string | null
  socket: KannaSocket | null
}

export function useAutocomplete({ value, cursor, projectId, socket }: UseAutocompleteArgs) {
  const trigger = useMemo<TriggerMatch | null>(() => findTrigger(value, cursor), [value, cursor])

  const [files, setFiles] = useState<FileEntryWire[]>(() =>
    projectId ? FILES_CACHE.get(projectId) ?? [] : [],
  )
  const [loading, setLoading] = useState(false)
  const requestedProjectId = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || !socket) return
    if (trigger?.trigger !== "@") return
    if (requestedProjectId.current === projectId) return
    const cached = FILES_CACHE.get(projectId)
    if (cached) {
      setFiles(cached)
      return
    }
    requestedProjectId.current = projectId
    setLoading(true)
    socket
      .command<{ entries: FileEntryWire[] }>({
        type: "project.files.list",
        projectId,
        showHidden: false,
      })
      .then((result) => {
        FILES_CACHE.set(projectId, result.entries)
        setFiles(result.entries)
      })
      .catch(() => {
        FILES_CACHE.set(projectId, [])
        setFiles([])
        requestedProjectId.current = null
      })
      .finally(() => setLoading(false))
  }, [projectId, socket, trigger?.trigger])

  const items = useMemo<AutocompleteItem[]>(() => {
    if (!trigger) return []
    if (trigger.trigger === "/") {
      return filterSlashCommands(trigger.query)
    }
    const q = trigger.query.toLowerCase()
    const filtered = q
      ? files.filter((entry) => entry.path.toLowerCase().includes(q))
      : files
    return filtered.slice(0, 50).map((entry) => ({
      id: `${entry.type}:${entry.path}`,
      label: entry.path,
      kind: entry.type,
      insertText: `@${entry.path}`,
    }))
  }, [trigger, files])

  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)
  useEffect(() => {
    setHighlightedIndex(0)
  }, [trigger?.trigger, trigger?.query])
  useEffect(() => {
    if (trigger == null || dismissedStart == null) return
    if (trigger.start !== dismissedStart) setDismissedStart(null)
  }, [trigger, dismissedStart])

  const dismiss = useCallback(() => {
    if (trigger) setDismissedStart(trigger.start)
  }, [trigger])

  const isDismissed = trigger != null && dismissedStart === trigger.start
  const open = !isDismissed && trigger !== null && (items.length > 0 || (trigger.trigger === "@" && loading))

  const replaceTriggerWith = useCallback(
    (item: AutocompleteItem): { nextValue: string; nextCursor: number } => {
      if (!trigger) return { nextValue: value, nextCursor: cursor }
      const before = value.slice(0, trigger.start)
      const after = value.slice(trigger.end)
      const insert = `${item.insertText} `
      const nextValue = `${before}${insert}${after}`
      const nextCursor = before.length + insert.length
      return { nextValue, nextCursor }
    },
    [trigger, value, cursor],
  )

  return {
    open,
    trigger,
    items,
    highlightedIndex,
    setHighlightedIndex,
    loading,
    replaceTriggerWith,
    dismiss,
  }
}
