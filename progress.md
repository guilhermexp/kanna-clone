# Progress — Kanna fork

## Última sessão (2026-05-18)

### Concluído

- Fork desvinculado de `jakemor/kanna`, novo origin: `https://github.com/guilhermexp/kanna-clone.git` (branch `main`)
- Página **Changelog** removida da Settings (sidebar item, useEffect, state hooks, render branch + ajuste no teste `resolveSettingsSectionId`)
- **Autocomplete `/` e `@` no chat input** (versão lite, mantém textarea):
  - `src/client/components/chat-ui/chat-input-autocomplete/`
    - `types.ts` (findTrigger)
    - `slash-commands.ts` (9 built-ins: clear, plan, agent, compact, review, pr-comments, release-notes, security-review, commit)
    - `AutocompletePopover.tsx` (popover acima do textarea)
    - `useAutocomplete.ts` (hook + cache de files por projeto via `project.files.list`)
  - `ChatInput.tsx`, `ChatInputDock.tsx`, `ChatPage/index.tsx` — thread de `socket` + nova prop
  - Keyboard nav: ↑↓ navega, Enter/Tab insere, Esc dismissa
  - Popover ancorado no container externo (largura total do input, 840px max)
- Commits empurrados: `bd30642` (fork inicial) + `a8d1ce1` (autocomplete + remove changelog)
- Serviço LaunchAgent rodando em http://localhost:3210/

### Pendente — próxima instrução

**Toggle "Barra lateral translúcida" em Settings** (sidebar do app translúcida on/off).

Screenshot de referência mostra um toggle nas Settings com o label "Barra lateral translúcida" e um slider de "Contraste" (valor 45). Implementação prevista:

1. Adicionar campo `translucentSidebar: boolean` (e talvez `sidebarContrast: number`) em `AppSettingsSnapshot`/`AppSettingsPatch` (`src/shared/types.ts`) — **5 pontos de tocar** em `src/server/app-settings.ts` (AppSettingsFile, toFilePayload, toSnapshot, normalizeAppSettings, toComparablePayload), conforme CLAUDE.md
2. UI em `SettingsPage.tsx` → Appearance section → toggle + slider chamando `handleWriteAppSettings({ ... })`
3. Consumir no `KannaSidebar.tsx` aplicando classes Tailwind (backdrop-blur + bg/alpha) condicionalmente
4. Atualizar fixtures de teste em `app-settings.test.ts` e `ws-router.test.ts`
5. Build + restart launchd (`bun run build && launchctl kickstart -k "gui/$(id -u)/dev.kanna.fork"`)

### Comandos úteis

```bash
bun run build && launchctl kickstart -k "gui/$(id -u)/dev.kanna.fork"
tail -f ~/Library/Logs/kanna-fork.out.log
bun test
bun x tsc --noEmit
```
