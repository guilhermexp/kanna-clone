const MATERIAL_FILE_ICON_PUBLIC_BASE = "/file-icons/"
const MATERIAL_FILE_ICON_EXTENSION = ".svg"

function normalizeMaterialFileIconName(iconName: string): string {
  const normalized = iconName.trim().replace(/^\/+/, "").replace(/\.svg$/i, "")
  if (!normalized || normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    return "file"
  }
  return normalized
}

export function getMaterialFileIconAssetUrl(iconName: string): string {
  return `${MATERIAL_FILE_ICON_PUBLIC_BASE}${normalizeMaterialFileIconName(iconName)}${MATERIAL_FILE_ICON_EXTENSION}`
}
