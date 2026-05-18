import rawManifest from "../generated/file-icons/manifest.json"
import { cn } from "../lib/utils"
import {
  getMaterialFileIconName,
  type MaterialFileIconManifest,
} from "./material-file-icons"
import { getMaterialFileIconAssetUrl } from "./material-file-icon-resolver"

const manifest = rawManifest as MaterialFileIconManifest

function MaterialIconImage({
  iconName,
  className,
}: {
  iconName: string
  className?: string
}) {
  const src = getMaterialFileIconAssetUrl(iconName)

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn("size-4 shrink-0 select-none object-contain", className)}
      draggable={false}
    />
  )
}

export function MaterialFileIcon({
  fileName,
  className,
}: {
  fileName: string
  className?: string
}) {
  const iconName = getMaterialFileIconName(fileName, false, false, manifest)
  return <MaterialIconImage iconName={iconName} className={className} />
}

export function MaterialFolderIcon({
  folderName = "folder",
  isOpen = false,
  className,
}: {
  folderName?: string
  isOpen?: boolean
  className?: string
}) {
  const iconName = getMaterialFileIconName(folderName, true, isOpen, manifest)
  return <MaterialIconImage iconName={iconName} className={className} />
}
