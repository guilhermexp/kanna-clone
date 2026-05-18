export type MaterialFileIconManifest = {
  fileNames: Record<string, string>
  fileExtensions: Record<string, string>
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
  defaultIcon: string
  defaultFolderIcon: string
  defaultFolderOpenIcon: string
}

export function getMaterialFileIconName(
  fileName: string,
  isDirectory: boolean,
  isOpen: boolean,
  manifest: MaterialFileIconManifest,
): string {
  return isDirectory
    ? getMaterialFolderIconName(fileName, isOpen, manifest)
    : getMaterialFileLeafIconName(fileName, manifest)
}

function getMaterialFolderIconName(
  folderName: string,
  isOpen: boolean,
  manifest: MaterialFileIconManifest,
): string {
  const baseName = folderName.toLowerCase()

  if (isOpen && manifest.folderNamesExpanded[baseName]) {
    return manifest.folderNamesExpanded[baseName]!
  }

  if (manifest.folderNames[baseName]) {
    return isOpen
      ? (manifest.folderNamesExpanded[baseName] ?? manifest.folderNames[baseName])!
      : manifest.folderNames[baseName]!
  }

  return isOpen ? manifest.defaultFolderOpenIcon : manifest.defaultFolderIcon
}

function getMaterialFileLeafIconName(
  fileName: string,
  manifest: MaterialFileIconManifest,
): string {
  const fileNameLower = fileName.toLowerCase()

  if (manifest.fileNames[fileName]) {
    return manifest.fileNames[fileName]!
  }

  if (manifest.fileNames[fileNameLower]) {
    return manifest.fileNames[fileNameLower]!
  }

  const dotIndex = fileName.indexOf(".")

  if (dotIndex !== -1) {
    const afterFirstDot = fileName.slice(dotIndex + 1).toLowerCase()
    const segments = afterFirstDot.split(".")

    for (let index = 0; index < segments.length; index++) {
      const extension = segments.slice(index).join(".")

      if (manifest.fileExtensions[extension]) {
        return manifest.fileExtensions[extension]!
      }
    }
  }

  return manifest.defaultIcon
}
