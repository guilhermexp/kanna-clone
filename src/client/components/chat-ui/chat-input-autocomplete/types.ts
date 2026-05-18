export type AutocompleteTrigger = "/" | "@" | "$"

export interface AutocompleteItem {
  id: string
  label: string
  description?: string
  insertText: string
  kind: "command" | "file" | "folder" | "skill"
}

export interface TriggerMatch {
  trigger: AutocompleteTrigger
  start: number
  end: number
  query: string
}

export function findTrigger(text: string, cursor: number): TriggerMatch | null {
  let i = cursor - 1
  while (i >= 0) {
    const ch = text[i]
    if (ch === "/" || ch === "@" || ch === "$") {
      const before = i === 0 ? " " : text[i - 1]
      if (before && /\s/.test(before)) {
        const query = text.slice(i + 1, cursor)
        if (/\s/.test(query)) return null
        return { trigger: ch, start: i, end: cursor, query }
      }
      return null
    }
    if (/\s/.test(ch ?? "")) return null
    i--
  }
  return null
}
