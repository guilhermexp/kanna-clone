const extensionToMonacoLanguage: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".vue": "html",
  ".svelte": "html",
  ".json": "json",
  ".jsonc": "json",
  ".json5": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "ini",
  ".xml": "xml",
  ".svg": "xml",
  ".md": "markdown",
  ".mdx": "markdown",
  ".markdown": "markdown",
  ".py": "python",
  ".pyw": "python",
  ".pyi": "python",
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  ".go": "go",
  ".mod": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".hh": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".phtml": "php",
  ".sql": "sql",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".dockerfile": "dockerfile",
  ".ini": "ini",
  ".conf": "ini",
  ".cfg": "ini",
  ".properties": "ini",
  ".lua": "lua",
  ".r": "r",
  ".R": "r",
  ".pl": "perl",
  ".pm": "perl",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".edn": "clojure",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hs": "haskell",
  ".scala": "scala",
  ".sc": "scala",
  ".fs": "fsharp",
  ".fsx": "fsharp",
  ".m": "objective-c",
  ".mm": "objective-c",
  ".dart": "dart",
  ".txt": "plaintext",
  ".log": "plaintext",
  ".gitignore": "plaintext",
  ".gitattributes": "plaintext",
  ".env": "plaintext",
  ".editorconfig": "ini",
  ".prettierrc": "json",
  ".eslintrc": "json",
  ".babelrc": "json",
  ".diff": "plaintext",
  ".patch": "plaintext",
}

const filenameToMonacoLanguage: Record<string, string> = {
  "dockerfile": "dockerfile",
  "Dockerfile": "dockerfile",
  "makefile": "makefile",
  "Makefile": "makefile",
  "GNUmakefile": "makefile",
  "CMakeLists.txt": "cmake",
  "Gemfile": "ruby",
  "Rakefile": "ruby",
  "Vagrantfile": "ruby",
  "Podfile": "ruby",
  ".gitignore": "plaintext",
  ".gitattributes": "plaintext",
  ".dockerignore": "plaintext",
  ".npmignore": "plaintext",
  ".prettierignore": "plaintext",
  ".eslintignore": "plaintext",
  "package.json": "json",
  "tsconfig.json": "json",
  "jsconfig.json": "json",
  ".prettierrc": "json",
  ".eslintrc": "json",
  ".babelrc": "json",
}

export function getMonacoLanguage(filePath: string): string {
  const filename = filePath.split("/").pop() || filePath
  if (filenameToMonacoLanguage[filename]) {
    return filenameToMonacoLanguage[filename]
  }
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
  if (extensionToMonacoLanguage[ext]) {
    return extensionToMonacoLanguage[ext]
  }
  return "plaintext"
}

export type FileViewerType = "code" | "image" | "markdown" | "unsupported"

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"]

const UNSUPPORTED_EXTENSIONS = [
  ".pdf", ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
  ".zip", ".tar", ".gz", ".7z", ".rar",
]

export function getFileViewerType(filePath: string): FileViewerType {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
  if (IMAGE_EXTENSIONS.includes(ext)) return "image"
  if (UNSUPPORTED_EXTENSIONS.includes(ext)) return "unsupported"
  if ([".md", ".mdx", ".markdown"].includes(ext)) return "markdown"
  return "code"
}

export function isImageFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
  return IMAGE_EXTENSIONS.includes(ext)
}

export function getFileName(filePath: string): string {
  const parts = filePath.split("/")
  return parts[parts.length - 1] || filePath
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
