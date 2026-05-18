# Kanna Fork — Mudanças

Documento das alterações feitas sobre o repositório upstream `jakemor/kanna` neste fork.
Última atualização: 2026-05-18

---

## Resumo

| # | Tema | Tipo | Impacto |
|---|---|---|---|
| 1 | Sidebar — remoção de divisórias | Polimento visual | 2 linhas |
| 2 | Settings — toggle "Tool Group Output" | Feature pequena | 7 arquivos |
| 3 | Files panel (file tree completo) | Feature grande | 13 arquivos + 1088 SVGs |
| 4 | File Viewer (preview rico de arquivos) | Feature grande | 9 arquivos + dep Monaco |
| 5 | Agent icon na sidebar (Claude/Codex) | Polimento UX | 3 arquivos + 2 SVGs |

Todas as mudanças mantêm os testes existentes verdes (606 pass / 4 fail — esses 4 do DiffStore já falhavam antes, dependem de branch `main` no ambiente).

---

## 1. Sidebar — remoção das faixas divisórias

**Pedido:** "Tira essa faixa divisória que fica mais elegante."

### Arquivos
- `src/client/app/KannaSidebar.tsx`

### O que mudou
- Linha 396: removida `border-b` do header "KANNA"
- Linha 530: removida `border-t border-border` do footer "Settings"

Resultado: header e footer da sidebar agora flutuam sem linhas separadoras.

### Referência
Decisão visual própria, sem referência externa.

---

## 2. Settings — toggle "Tool Group Output"

**Pedido:** "Tem algum botão que deixa escolher se quero as saídas auto-colapsadas ou sempre visíveis?"

### Arquivos
- `src/shared/types.ts` — campo `alwaysExpandToolGroups` em `AppSettingsSnapshot` e `AppSettingsPatch`
- `src/server/app-settings.ts` — normalize/serialize do campo (5 pontos)
- `src/server/app-settings.test.ts` — fixture atualizada
- `src/server/ws-router.ts` — fixture fallback atualizada
- `src/server/ws-router.test.ts` — fixture de teste atualizada
- `src/client/app/SettingsPage.tsx` — `SegmentedControl` em Appearance + handler
- `src/client/app/KannaTranscript.tsx` — força `expanded` quando setting ligado
- `src/client/app/ChatPage/ChatTranscriptViewport.tsx` — mesma lógica + `extraData` da LegendList

### O que mudou
Em **Settings → Appearance** adicionada nova `SettingsRow` "Tool Group Output" com 2 opções:
- **Auto-collapse** (padrão atual)
- **Always expand**

A escolha persiste em `~/.kanna/data/settings.json` no campo `alwaysExpandToolGroups`. O toggle sobrescreve o estado por-grupo nos dois viewports de transcript (`KannaTranscript.tsx` e `ChatTranscriptViewport.tsx`). Quando ligado, todos os grupos de tool calls nascem expandidos. Você ainda pode colapsar manualmente clicando no chevron.

### Referência
Decisão de UX própria, padrão segue o `analyticsEnabled` que já existia no SettingsPage (mesmo `SegmentedControl`).

---

## 3. Files panel — árvore de arquivos do projeto

**Pedido:** "Quero clonar exatamente o widget File que tem no meu app 1code, inclusive os ícones."

### Origem (1code)
Repo: `~/Documents/1code` (`21st-desktop`, app id `dev.21st.agents`)

Componentes portados de:
- `src/renderer/features/details-sidebar/sections/files-tab.tsx` (1485 linhas — componente principal)
- `src/renderer/features/details-sidebar/sections/files-tab-visible-rows.ts` (helper de virtualização)
- `src/renderer/features/details-sidebar/sections/files-tab-guides.ts` (helper de linhas-guia)
- `src/renderer/icons/material-file-icons.ts` (resolver lógico)
- `src/renderer/icons/material-file-icon-resolver.ts` (URL builder)
- `src/renderer/icons/material-file-icon-components.tsx` (componentes React)
- `src/renderer/generated/file-icons/manifest.json` (mapping extensão → ícone)
- `src/renderer/public/file-icons/*.svg` (1 088 SVGs Material File Icons)
- `src/main/lib/trpc/routers/files.ts` (621 linhas — router tRPC) → reescrito como handlers WS no Kanna

### Arquivos no Kanna
**Backend**
- `src/server/file-tree.ts` — scan recursivo com cache LRU + filtros idênticos ao 1code
- `src/server/ws-router.ts` — 3 handlers novos: `project.files.list`, `project.files.search`, `project.files.clearCache`
- `src/shared/protocol.ts` — tipos dos comandos

**Frontend**
- `public/file-icons/` — 1 088 SVGs (4,3 MB)
- `src/client/generated/file-icons/manifest.json` — manifest (428 KB)
- `src/client/icons/material-file-icons.ts` — resolver
- `src/client/icons/material-file-icon-resolver.ts` — URL builder
- `src/client/icons/material-file-icon-components.tsx` — `<MaterialFileIcon>`, `<MaterialFolderIcon>`
- `src/client/stores/fileTreeStore.ts` — Zustand persistido (`expandedByProject`, `showHiddenByProject`) — substitui Jotai `atomFamily` do 1code
- `src/client/components/chat-ui/files-panel/files-tab-guides.ts`
- `src/client/components/chat-ui/files-panel/files-tab-visible-rows.ts`
- `src/client/components/chat-ui/files-panel/FilesPanel.tsx` — componente principal (~700 linhas)
- `src/client/components/chat-ui/ChatNavbar.tsx` — botão `FolderTree` no header
- `src/client/app/ChatPage/index.tsx` — wiring
- `src/client/stores/rightSidebarStore.ts` — adicionado `"files"` ao union

**Dependência nova:** `@tanstack/react-virtual@3.13.24`

### Adaptações ao Kanna
| 1code | Kanna |
|---|---|
| Jotai `atomFamily` | Zustand `fileTreeStore` |
| tRPC `files.search.useQuery` | `socket.command({ type: "project.files.list" })` |
| tRPC `files.watchChanges.useSubscription` | Cortado (Kanna não tem subscription WS) — cache TTL 5s + botão refresh |
| `RenameDialog` / mutations de move/rename/delete | Cortado (Kanna é read-only — ws-router não tem mutations de arquivo) |
| Drag-and-drop interno + OS file drop | Cortado (mesma razão) |
| `tRPC` external open | `socket.command({ type: "system.openExternal" })` (já existia) |

### Features que vieram completas
- Árvore hierárquica com Material File Icons (idêntico ao 1code)
- Virtualização automática acima de 150 linhas (`@tanstack/react-virtual`)
- Linhas-guia da árvore (ancestor/connector/top/bottom)
- Recently-modified glow (verde 10s / âmbar 1min / âmbar-claro 3min com decay)
- Expand/collapse persistido por projeto
- Toggle hidden files
- Toggle expand-all / collapse-all
- Refresh manual
- Filtro inline
- Keyboard nav (↑↓→← Enter Space Home End)
- Context menu: Open, Open in Editor, Reveal in Finder, Copy Path, Copy Relative Path
- Symlinks marcados visualmente

### Como acessar
Header do chat → ícone **🗂️ FolderTree** (entre Globe e GitBranch).

---

## 4. File Viewer — preview rico de arquivos

**Pedido:** "Traz também o file preview, que quando clico em algum arquivo abre o preview rico, de tudo."

### Origem (1code)
Componentes portados de `src/renderer/features/file-viewer/`:
- `components/file-viewer-sidebar.tsx` (908 linhas — componente principal)
- `components/image-viewer.tsx` (198 linhas)
- `components/markdown-viewer.tsx` (368 linhas)
- `components/monaco-config.ts` (300 linhas — incluindo theme registration complexo)
- `hooks/use-file-content.ts` (133 linhas)
- `utils/language-map.ts` (251 linhas — extensão → linguagem Monaco)
- `utils/file-utils.ts` (24 linhas)

E do backend:
- `src/main/lib/trpc/routers/files.ts` — procedures `readTextFile` e `readBinaryFile`

### Arquivos no Kanna
**Backend**
- `src/server/file-tree.ts` — funções `readTextFileSafe` (cap 2 MB, detecção de binário por null-byte) e `readBinaryFileSafe` (cap 20 MB, base64 + MIME)
- `src/server/ws-router.ts` — 2 handlers: `project.files.readText`, `project.files.readBinary`
- `src/shared/protocol.ts` — tipos dos comandos

**Frontend** (`src/client/components/chat-ui/file-viewer/`)
- `language-map.ts` — mapa de linguagens + `getFileViewerType`
- `monaco-config.ts` — opções padrão do editor read-only + theme switch
- `use-file-content.ts` — hooks `useFileContent` (texto) e `useBinaryFileContent` (imagem)
- `ImageViewer.tsx` — preview de imagens
- `MarkdownViewer.tsx` — render bonito com toggle source/preview
- `FileViewer.tsx` — container principal com Monaco para código + roteamento por tipo

**Dependência nova:** `@monaco-editor/react@4.7.0` (Monaco carregado via CDN, lazy)

### Adaptações ao Kanna
| 1code | Kanna |
|---|---|
| `useAtom` (Jotai) | `useState` local + Kanna's `useTheme` |
| `trpc.files.readTextFile.useQuery` | `socket.command({ type: "project.files.readText" })` |
| `trpc.files.watchChanges.useSubscription` | Cortado — re-fetch manual |
| `next-themes` `resolvedTheme` | Kanna `useTheme().resolvedTheme` |
| `DropdownMenu` (Radix) | Kanna `Popover` (Kanna não tem dropdown-menu) |
| `ChatMarkdownRenderer` complexo | `react-markdown + remark-gfm` direto (mais simples, já era dep do Kanna) |
| Theme registration complex (VSCode TextMate → Monaco) | Simplificado para `vs-dark` / `vs` baseado no theme atom |
| 3 modos (side-peek / center-peek / full-page) | Único modo: dialog overlay (center-peek style) |

### Features que vieram completas
- **Código** (.ts/.js/.py/.go/.rs/.swift/…): Monaco com syntax highlight, opções (word wrap, minimap, line numbers)
- **Markdown** (.md/.mdx): renderizado bonito por padrão + toggle pra ver source no Monaco
- **Imagem** (.png/.jpg/.svg/.gif/.webp/.ico/.bmp): preview com `object-contain`
- **Não suportado** (.pdf, .zip, .exe): tela com ícone + botão "Open in editor"
- Header: ícone Material + nome + caminho + **Open in editor** / **Reveal in Finder** / **Copy path**
- ESC ou clicar fora → fecha

### Como acessar
Files panel → click em qualquer arquivo abre o dialog overlay.

**Nota:** Primeira abertura tem ~1-2s de delay pra Monaco baixar via CDN (cdn.jsdelivr.net). Depois fica em cache.

---

## 5. Agent icons na sidebar

**Pedido:** "Coloca na sidebar, em cada sessão, qual agente que está sendo executado, apenas com ícone do agente na frente da sessão."

### Origem
Ícones SVG oficiais do 1code: `~/Documents/1code/assets/agent-icons/high-res/`
- `claude-code.svg`
- `codex.svg`

### Arquivos no Kanna
- `public/agent-claude.svg` — cópia direta
- `public/agent-codex.svg` — cópia direta
- `src/client/components/chat-ui/sidebar/AgentIcon.tsx` — componente helper que escolhe SVG pelo provider
- `src/client/components/chat-ui/sidebar/ChatRow.tsx` — render no início da row

### O que mudou
Cada `ChatRow` agora começa com o ícone oficial do agente (Claude laranja-D97757 ou Codex gradient). O `chat.provider` já estava em `SidebarChatRow` no shared/types, então não precisei mexer no backend nem nas read models.

O status indicator existente (loading spinner / waiting blue dot / unread green dot) aparece **ao lado** do agent icon quando ativo. Em chats idle só aparece o ícone do agente.

### Referência
SVGs vieram diretamente do `assets/agent-icons/high-res/` do 1code (são os ícones oficiais que a Anthropic e OpenAI publicam).

---

## Dependências adicionadas

| Pacote | Versão | Pra quê |
|---|---|---|
| `@tanstack/react-virtual` | 3.13.24 | Virtualização da árvore de arquivos |
| `@monaco-editor/react` | 4.7.0 | Editor Monaco (lazy-load do CDN) |

Sem outras deps novas. Tudo o resto reusou o que já estava no `package.json` (react-markdown, remark-gfm, zustand, lucide-react, radix-ui/popover, radix-ui/context-menu, tailwind, etc.).

---

## Estrutura final dos diretórios novos

```
kanna/
├── docs/
│   └── fork-changes.md                    ← este arquivo
├── public/
│   ├── agent-claude.svg                   ← novo
│   ├── agent-codex.svg                    ← novo
│   └── file-icons/                        ← 1088 SVGs (4.3 MB)
└── src/
    ├── client/
    │   ├── components/chat-ui/
    │   │   ├── files-panel/               ← Files tree (novo dir)
    │   │   │   ├── FilesPanel.tsx
    │   │   │   ├── files-tab-guides.ts
    │   │   │   └── files-tab-visible-rows.ts
    │   │   ├── file-viewer/               ← File preview (novo dir)
    │   │   │   ├── FileViewer.tsx
    │   │   │   ├── ImageViewer.tsx
    │   │   │   ├── MarkdownViewer.tsx
    │   │   │   ├── language-map.ts
    │   │   │   ├── monaco-config.ts
    │   │   │   └── use-file-content.ts
    │   │   └── sidebar/
    │   │       └── AgentIcon.tsx          ← novo
    │   ├── generated/file-icons/
    │   │   └── manifest.json              ← novo (428 KB)
    │   ├── icons/                         ← novo dir
    │   │   ├── material-file-icon-components.tsx
    │   │   ├── material-file-icon-resolver.ts
    │   │   └── material-file-icons.ts
    │   └── stores/
    │       └── fileTreeStore.ts           ← novo
    ├── server/
    │   └── file-tree.ts                   ← novo (scan + read functions)
    └── shared/
        └── protocol.ts                    ← comandos novos
```

---

## Validação

Todas as mudanças foram validadas com:
- `tsc --noEmit` → limpo
- `bun run build:client` → build em ~4s
- `bun test` → 606 pass / 4 fail (DiffStore — pré-existente, não relacionado)

Bundle final: `dist/client/assets/index-*.js` ~2.3 MB minificado (~602 KB gzip). Monaco vem do CDN, não infla o bundle.

---

## Referências dos commits upstream

Este fork foi feito a partir do tag `0.41.5` do `jakemor/kanna`. As features foram desenvolvidas em cima dessa base sem rebase ainda.

Para sincronizar com upstream:
```bash
cd ~/Documents/Projetos/SelfHosting/kanna
git remote add upstream https://github.com/jakemor/kanna.git
git fetch upstream
git merge upstream/main   # ou rebase, conforme preferência
```

Conflitos esperados nos arquivos modificados:
- `src/shared/protocol.ts`
- `src/shared/types.ts`
- `src/server/ws-router.ts`
- `src/server/app-settings.ts`
- `src/client/app/SettingsPage.tsx`
- `src/client/app/ChatPage/index.tsx`
- `src/client/app/KannaSidebar.tsx`
- `src/client/app/KannaTranscript.tsx`
- `src/client/app/ChatPage/ChatTranscriptViewport.tsx`
- `src/client/components/chat-ui/ChatNavbar.tsx`
- `src/client/components/chat-ui/sidebar/ChatRow.tsx`
- `src/client/stores/rightSidebarStore.ts`

Arquivos novos (criados neste fork) não devem conflitar.
