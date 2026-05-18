import { AlertCircle, Loader2 } from "lucide-react"
import type { useKannaState } from "../../../app/useKannaState"
import { getFileName } from "./language-map"
import { useBinaryFileContent } from "./use-file-content"

interface ImageViewerProps {
  filePath: string
  projectPath: string
  socket: ReturnType<typeof useKannaState>["socket"]
}

export function ImageViewer({ filePath, projectPath, socket }: ImageViewerProps) {
  const fileName = getFileName(filePath)
  const { data, isLoading, error } = useBinaryFileContent(socket, projectPath, filePath)

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/20 p-4">
      {isLoading && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-sm">Loading image…</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 text-center max-w-[300px]">
          <AlertCircle className="size-10 text-muted-foreground" />
          <p className="font-medium text-foreground">Failed to load image</p>
        </div>
      )}

      {data && !data.ok && (
        <div className="flex flex-col items-center gap-3 text-center max-w-[300px]">
          <AlertCircle className="size-10 text-muted-foreground" />
          <p className="font-medium text-foreground">
            {data.reason === "too-large" ? "Image too large" : "Image not found"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {data.reason === "too-large"
              ? "The image exceeds the 20MB size limit."
              : "The file could not be found."}
          </p>
        </div>
      )}

      {data?.ok && (
        <img
          src={`data:${data.mimeType};base64,${data.data}`}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded-sm"
          style={{ imageRendering: "auto" }}
        />
      )}
    </div>
  )
}
