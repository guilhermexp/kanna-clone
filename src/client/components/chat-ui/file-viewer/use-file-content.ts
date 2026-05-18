import { useCallback, useEffect, useMemo, useState } from "react"
import type { useKannaState } from "../../../app/useKannaState"

export type FileLoadError = "not-found" | "too-large" | "binary" | "unknown"

export interface FileContentResult {
  content: string | null
  isLoading: boolean
  error: FileLoadError | null
  byteLength: number | null
  refetch: () => void
}

type ReadTextResult =
  | { ok: true; content: string; byteLength: number }
  | { ok: false; reason: FileLoadError; byteLength: number }

export function getErrorMessage(error: FileLoadError): string {
  switch (error) {
    case "not-found":
      return "File not found"
    case "too-large":
      return "File is too large to display (max 2 MB)"
    case "binary":
      return "Cannot display binary file"
    case "unknown":
    default:
      return "Failed to load file"
  }
}

export function useFileContent(
  socket: ReturnType<typeof useKannaState>["socket"],
  projectPath: string | null,
  filePath: string | null,
): FileContentResult {
  const absolutePath = useMemo(() => {
    if (!projectPath || !filePath) return null
    return filePath.startsWith("/") ? filePath : `${projectPath}/${filePath}`
  }, [projectPath, filePath])

  const [state, setState] = useState<FileContentResult>({
    content: null,
    isLoading: !!absolutePath,
    error: null,
    byteLength: null,
    refetch: () => {},
  })
  const [reloadTick, setReloadTick] = useState(0)
  const refetch = useCallback(() => setReloadTick((t) => t + 1), [])

  useEffect(() => {
    if (!absolutePath) {
      setState({ content: null, isLoading: false, error: null, byteLength: null, refetch })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, isLoading: true, error: null, refetch }))
    socket
      .command<ReadTextResult>({ type: "project.files.readText", filePath: absolutePath })
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setState({
            content: result.content,
            isLoading: false,
            error: null,
            byteLength: result.byteLength,
            refetch,
          })
        } else {
          setState({
            content: null,
            isLoading: false,
            error: result.reason,
            byteLength: result.byteLength,
            refetch,
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({
          content: null,
          isLoading: false,
          error: "unknown",
          byteLength: null,
          refetch,
        })
      })
    return () => {
      cancelled = true
    }
  }, [absolutePath, socket, reloadTick, refetch])

  return state
}

export type ReadBinaryResult =
  | { ok: true; data: string; mimeType: string; byteLength: number }
  | { ok: false; reason: "not-found" | "too-large" | "unknown"; byteLength: number }

export function useBinaryFileContent(
  socket: ReturnType<typeof useKannaState>["socket"],
  projectPath: string | null,
  filePath: string | null,
) {
  const absolutePath = useMemo(() => {
    if (!projectPath || !filePath) return null
    return filePath.startsWith("/") ? filePath : `${projectPath}/${filePath}`
  }, [projectPath, filePath])

  const [data, setData] = useState<ReadBinaryResult | null>(null)
  const [isLoading, setIsLoading] = useState(!!absolutePath)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!absolutePath) {
      setIsLoading(false)
      setData(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    socket
      .command<ReadBinaryResult>({ type: "project.files.readBinary", filePath: absolutePath })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [absolutePath, socket])

  return { data, isLoading, error }
}
