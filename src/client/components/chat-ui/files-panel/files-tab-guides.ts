type TreeGuideSegmentKind =
  | "ancestor-vertical"
  | "current-top"
  | "current-bottom"
  | "connector"

export interface TreeGuideSegment {
  depth: number
  kind: TreeGuideSegmentKind
}

export function buildTreeGuideSegments(
  level: number,
  ancestorContinuation: boolean[],
  hasNextSibling: boolean,
): TreeGuideSegment[] {
  if (level <= 0) return []

  const segments: TreeGuideSegment[] = []

  ancestorContinuation.forEach((shouldContinue, depth) => {
    if (shouldContinue) {
      segments.push({ depth, kind: "ancestor-vertical" })
    }
  })

  const currentDepth = level - 1
  segments.push({ depth: currentDepth, kind: "current-top" })

  if (hasNextSibling) {
    segments.push({ depth: currentDepth, kind: "current-bottom" })
  }

  segments.push({ depth: currentDepth, kind: "connector" })

  return segments
}
