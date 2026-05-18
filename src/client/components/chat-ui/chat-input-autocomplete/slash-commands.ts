import type { AutocompleteItem } from "./types"

export const BUILTIN_SLASH_COMMANDS: AutocompleteItem[] = [
  { id: "cmd:clear", label: "clear", description: "Start a new conversation", insertText: "/clear", kind: "command" },
  { id: "cmd:plan", label: "plan", description: "Switch to plan mode", insertText: "/plan", kind: "command" },
  { id: "cmd:agent", label: "agent", description: "Switch to agent mode", insertText: "/agent", kind: "command" },
  { id: "cmd:compact", label: "compact", description: "Compact conversation context", insertText: "/compact", kind: "command" },
  { id: "cmd:review", label: "review", description: "Ask agent to review your code", insertText: "/review", kind: "command" },
  { id: "cmd:pr-comments", label: "pr-comments", description: "Generate PR review comments", insertText: "/pr-comments", kind: "command" },
  { id: "cmd:release-notes", label: "release-notes", description: "Generate release notes", insertText: "/release-notes", kind: "command" },
  { id: "cmd:security-review", label: "security-review", description: "Perform a security audit", insertText: "/security-review", kind: "command" },
  { id: "cmd:commit", label: "commit", description: "Commit staged changes carefully", insertText: "/commit", kind: "command" },
]

export function filterSlashCommands(query: string): AutocompleteItem[] {
  if (!query) return BUILTIN_SLASH_COMMANDS
  const q = query.toLowerCase()
  return BUILTIN_SLASH_COMMANDS.filter(
    (cmd) => cmd.label.toLowerCase().includes(q) || cmd.description?.toLowerCase().includes(q),
  )
}
