import { cn } from "../../../lib/utils"
import type { AgentProvider } from "../../../../shared/types"
import { PROVIDER_ICONS } from "../ChatPreferenceControls"

interface AgentIconProps {
  provider: AgentProvider | null
  className?: string
}

const LABELS: Record<AgentProvider, string> = {
  claude: "Claude",
  codex: "Codex",
}

export function AgentIcon({ provider, className }: AgentIconProps) {
  if (!provider) return null
  const Icon = PROVIDER_ICONS[provider]
  return (
    <Icon
      aria-label={LABELS[provider]}
      className={cn("size-3.5 shrink-0 text-foreground/80", className)}
    />
  )
}
