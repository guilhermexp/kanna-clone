# CLAUDE.md

Guia pra agentes (Claude Code / Codex) trabalhando neste repo.

## O que é

**Kanna** — UI web local pros CLIs Claude Code e Codex.

- Upstream: [github.com/jakemor/kanna](https://github.com/jakemor/kanna)
- Este diretório é um **fork** do Guilherme com modificações próprias (ver `docs/fork-changes.md`)
- Package: `kanna-code` v0.41.5
- Stack: **Bun** server + React 19 + Vite + Zustand + WebSocket

## Arquitetura em uma tela

```
Browser (React + Zustand)
      ↕  WebSocket
Bun Server (HTTP + WS) ← localhost:3210
      ├── WSRouter ─── subscription & command routing
      ├── AgentCoordinator ─── multi-provider turn management
      ├── ProviderCatalog ─── provider/model/effort normalization
      ├── EventStore ─── JSONL persistence + snapshot compaction
      └── ReadModels ─── derived views (sidebar, chat, projects)
      ↕
3 canais de execução:
      ├── Claude Agent SDK (in-process, mesma runtime Bun)
      ├── Codex CLI (subprocess `codex app-server` via JSON-RPC stdio)
      └── Terminal embutido (Bun.spawn PTY → xterm.js)
      ↕
Estado em ~/.kanna/data/ (JSONL append-only + snapshot.json)
```

**Padrões-chave:** Event sourcing, CQRS (event log + read snapshots), reactive WS broadcast, multi-provider coordinator.

## Comandos

```bash
bun install                # Setup
bun run dev                # Dev com HMR (Vite client + Bun server)
bun run dev --port 3333    # Porta customizada
bun run build              # Build production em dist/
bun run check              # tsc --noEmit + build
bun test                   # Bun test runner
bun run start              # Rodar produção (cli.ts)
```

**Validação obrigatória antes de commit:** `bun x tsc --noEmit` + `bun test`.

## Estrutura

```
src/
├── client/                 React UI (renderer)
│   ├── app/                Pages + central state hook (useKannaState)
│   │   ├── ChatPage/       Chat surface principal
│   │   ├── KannaSidebar.tsx
│   │   ├── KannaTranscript.tsx
│   │   └── SettingsPage.tsx
│   ├── components/
│   │   ├── chat-ui/        Chat chrome (navbar, sidebar, panels)
│   │   │   ├── BrowserPanel.tsx
│   │   │   ├── GitPanel.tsx
│   │   │   ├── files-panel/  ← FORK: árvore de arquivos
│   │   │   ├── file-viewer/  ← FORK: preview rico
│   │   │   └── sidebar/      Chat list + AgentIcon (fork)
│   │   ├── messages/       Tool calls, text, markdown, etc.
│   │   └── ui/             shadcn-style (button, popover, dialog…)
│   ├── stores/             Zustand stores (chatInput, preferences,
│   │                        rightSidebar, fileTree*, etc.)
│   ├── icons/              Material file icons (fork — vindo do 1code)
│   ├── generated/          manifest.json dos file-icons (fork)
│   └── lib/                Formatters, utils, sidebarChats
├── server/                 Bun backend
│   ├── cli.ts              Entry point
│   ├── server.ts           HTTP/WS server setup
│   ├── agent.ts            AgentCoordinator (multi-provider)
│   ├── codex-app-server.ts JSON-RPC com Codex CLI
│   ├── ws-router.ts        WS command routing & subscriptions
│   ├── event-store.ts      JSONL persist + replay + snapshot
│   ├── terminal-manager.ts PTY via Bun.spawn
│   ├── file-tree.ts        ← FORK: scan + read de arquivos
│   ├── discovery.ts        Auto-discover de projetos
│   ├── read-models.ts      Derived view models
│   └── app-settings.ts     ~/.kanna/data/settings.json manager
└── shared/                 Tipos compartilhados client/server
    ├── types.ts            Core types, AppSettingsSnapshot, etc.
    ├── protocol.ts         ClientCommand union (WS protocol)
    ├── tools.ts            Tool call hydration
    └── branding.ts         App name + data dir paths
```

## Convenções

- **Components:** PascalCase (`ChatRow.tsx`)
- **Hooks/utils:** camelCase (`useFileContent.ts`, `sidebarChats.ts`)
- **Stores:** camelCase + `Store` suffix (`fileTreeStore.ts`)
- **Atoms:** N/A — Kanna usa **Zustand**, não jotai
- **Path alias:** N/A — Kanna usa imports relativos (ex: `../../lib/utils`)
- **Test runner:** Bun (`*.test.ts` ao lado do arquivo)
- **CSS:** Tailwind v4 com `@theme inline` (sem `tailwind.config.ts`)

## Estado e comunicação

| Tipo | Lugar | Persistência |
|---|---|---|
| **Server state** | `EventStore` em JSONL | `~/.kanna/data/{chats,messages,turns,projects}.jsonl` + snapshot |
| **Client state** | Zustand stores em `src/client/stores/` | localStorage (alguns persistidos) |
| **Server→Client** | WS subscriptions (`sidebar`, `chat`, `project-git`, etc.) | Push reativo |
| **Client→Server** | WS commands (`ClientCommand` union em `shared/protocol.ts`) | Request/ack |

**Adicionar novo comando WS:**
1. Adicionar entry no union `ClientCommand` em `src/shared/protocol.ts`
2. Adicionar `case "..."` no switch dentro de `src/server/ws-router.ts`
3. Cliente chama via `socket.command<T>({ type: "..." })`

**Adicionar novo setting:**
1. Campo em `AppSettingsSnapshot` + `AppSettingsPatch` em `shared/types.ts`
2. Normalize/serialize em `src/server/app-settings.ts` (5 lugares: `AppSettingsFile`, `toFilePayload`, `toSnapshot`, `normalizeAppSettings`, `toComparablePayload`)
3. Atualizar fixtures de teste em `app-settings.test.ts` e `ws-router.test.ts`
4. UI em `SettingsPage.tsx` chamando `handleWriteAppSettings({ ...patch })`

## Mudanças do fork

Ver **[docs/fork-changes.md](docs/fork-changes.md)** pra detalhes completos. Resumo:

1. **Sidebar limpa** — removidas divisórias `border-b`/`border-t` no header/footer
2. **Toggle "Tool Group Output"** — Settings → Appearance, opção pra sempre expandir tool calls
3. **Files panel** — árvore de arquivos do projeto (porta do 1code), com Material File Icons (1088 SVGs), virtualização, recency glow, context menu. Botão FolderTree no ChatNavbar.
4. **File viewer** — preview rico (Monaco para código, react-markdown, image viewer) com 2 modos: **side-peek** (resizable panel ao lado do chat, default) e **dialog** (overlay modal). Toggle no header do viewer.
5. **Agent icons na sidebar** — cada `ChatRow` mostra ícone do provider (Anthropic A\ ou OpenAI swirl) usando `PROVIDER_ICONS` de `ChatPreferenceControls.tsx`

Dependências adicionadas no fork: `@tanstack/react-virtual`, `@monaco-editor/react`.

## Rodando como serviço (macOS LaunchAgent)

Este fork está instalado como serviço:

- **Plist:** `~/Library/LaunchAgents/dev.kanna.fork.plist`
- **Symlink global:** `~/.bun/bin/kanna` → fork local via `bun link`
- **Porta:** 3210 (produção do serviço)
- **Logs:** `~/Library/Logs/kanna-fork.{out,err}.log`

```bash
# Status / restart depois de mudanças
bun run build && launchctl kickstart -k "gui/$(id -u)/dev.kanna.fork"

# Parar
launchctl bootout "gui/$(id -u)/dev.kanna.fork"

# Logs ao vivo
tail -f ~/Library/Logs/kanna-fork.out.log
```

## Gotchas

- **3 canais de execução** — não acoplar Claude (in-process via SDK) com Codex (subprocess JSON-RPC) com terminal (PTY).
- **Bun é o runtime** — não esperar APIs Node específicas; ver Bun docs antes de assumir.
- **WS protocol é tipado** — qualquer comando novo precisa entrar no union `ClientCommand` em `shared/protocol.ts` E no switch do `ws-router.ts`.
- **Event sourcing** — não mutar `messages.jsonl` direto; sempre via `EventStore.append*`.
- **Settings tem 5 pontos** — campos novos em `AppSettingsSnapshot` precisam aparecer em `AppSettingsFile`, `toFilePayload`, `toSnapshot`, `normalizeAppSettings`, `toComparablePayload`. Esquecer um quebra typecheck OU runtime.
- **Tests git-flaky** — `diff-store.test.ts` falha em ambiente onde branch default não é `main`. **Não é regressão**, ignorar nos resultados.
- **File preview Monaco** — carrega do CDN (`cdn.jsdelivr.net`) na primeira abertura. ~1-2s de delay inicial, depois fica em cache.
- **No-emoji policy** — não adicionar emojis em código ou comentários a menos que pedido explicitamente.

## Sincronização com upstream

```bash
git remote add upstream https://github.com/jakemor/kanna.git
git fetch upstream
git merge upstream/main      # ou rebase
```

Conflitos esperados nos arquivos listados em `docs/fork-changes.md` (final).
