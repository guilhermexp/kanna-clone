import { useEffect, useRef } from "react"
import { cn } from "../../../lib/utils"
import type { AutocompleteItem } from "./types"

interface Props {
  items: AutocompleteItem[]
  highlightedIndex: number
  onHighlight: (index: number) => void
  onSelect: (item: AutocompleteItem) => void
  loading?: boolean
  emptyMessage?: string
}

export function AutocompletePopover({ items, highlightedIndex, onHighlight, onSelect, loading, emptyMessage }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlightedIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex])

  return (
    <div
      ref={listRef}
      role="listbox"
      className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover/95 backdrop-blur-lg shadow-lg z-50"
    >
      {loading && items.length === 0 ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage ?? "No matches"}</div>
      ) : (
        items.map((item, idx) => (
          <div
            key={item.id}
            data-idx={idx}
            role="option"
            aria-selected={idx === highlightedIndex}
            onMouseEnter={() => onHighlight(idx)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(item)
            }}
            className={cn(
              "flex items-baseline gap-3 px-4 py-2 cursor-pointer text-sm",
              idx === highlightedIndex && "bg-accent text-accent-foreground",
            )}
          >
            <span className={cn("font-medium tabular-nums", (item.kind === "command" || item.kind === "skill") && "text-foreground")}>
              {item.kind === "command" ? `/${item.label}` : item.kind === "skill" ? `$${item.label}` : item.label}
            </span>
            {item.description ? (
              <span className="text-muted-foreground truncate">{item.description}</span>
            ) : null}
          </div>
        ))
      )}
    </div>
  )
}
