export interface FileTreeRowNode {
  id: string
  name: string
  type: "file" | "folder"
  path: string
  isSymlink?: boolean
  children?: FileTreeRowNode[]
}

export interface VisibleFileTreeRow {
  node: FileTreeRowNode
  level: number
  ancestorContinuationMask: string
  hasNextSibling: boolean
}

const DEFAULT_VIRTUALIZATION_THRESHOLD = 150

export function flattenVisibleTreeRows(
  nodes: FileTreeRowNode[],
  expanded: Set<string>,
): VisibleFileTreeRow[] {
  const rows: VisibleFileTreeRow[] = []

  function walk(
    list: FileTreeRowNode[],
    level: number,
    ancestorContinuationMask: string,
  ) {
    list.forEach((node, index) => {
      const hasNextSibling = index < list.length - 1
      rows.push({
        node,
        level,
        ancestorContinuationMask,
        hasNextSibling,
      })

      if (node.type === "folder" && node.children && expanded.has(node.path)) {
        walk(
          node.children,
          level + 1,
          `${ancestorContinuationMask}${hasNextSibling ? "1" : "0"}`,
        )
      }
    })
  }

  walk(nodes, 0, "")
  return rows
}

export function shouldVirtualizeVisibleRows(
  visibleRowCount: number,
  threshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
): boolean {
  return visibleRowCount > threshold
}
