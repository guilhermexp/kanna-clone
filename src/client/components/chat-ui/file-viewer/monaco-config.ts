import type { editor } from "monaco-editor"

export const defaultEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  minimap: { enabled: true },
  lineNumbers: "on",
  wordWrap: "off",
  automaticLayout: true,
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  folding: true,
  foldingStrategy: "indentation",
  showFoldingControls: "mouseover",
  bracketPairColorization: { enabled: true },
  guides: {
    bracketPairs: true,
    indentation: true,
  },
  scrollBeyondLastLine: false,
  renderWhitespace: "selection",
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  padding: { top: 8, bottom: 8 },
  quickSuggestions: false,
  parameterHints: { enabled: false },
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: "off",
  tabCompletion: "off",
  wordBasedSuggestions: "off",
  smoothScrolling: true,
  cursorBlinking: "solid",
  cursorStyle: "line",
  renderLineHighlight: "line",
  contextmenu: false,
  mouseWheelZoom: true,
}

export function getMonacoTheme(appTheme: string | null | undefined): string {
  if (!appTheme) return "vs-dark"
  return appTheme === "light" ? "vs" : "vs-dark"
}
