import { readdir, readFile, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path"

export interface FileEntry {
  path: string
  type: "file" | "folder"
  isSymlink?: boolean
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "release",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  ".vercel",
  ".netlify",
  "out",
  ".svelte-kit",
  ".astro",
])

const IGNORED_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".gitkeep",
])

const IGNORED_EXTENSIONS = new Set([
  ".log",
  ".lock",
  ".pyc",
  ".pyo",
  ".class",
  ".o",
  ".obj",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
])

const ALLOWED_LOCK_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
])

const MAX_CACHE_ENTRIES = 20
const CACHE_TTL_MS = 5_000
const fileListCache = new Map<string, { entries: FileEntry[]; timestamp: number }>()

export function validatePathSafe(targetPath: string, allowedParent?: string) {
  if (targetPath.includes("\0")) {
    throw new Error("Path contains invalid characters")
  }
  if (!isAbsolute(targetPath)) {
    throw new Error("Path must be absolute")
  }
  const resolved = resolve(targetPath)
  if (allowedParent) {
    const resolvedParent = resolve(allowedParent)
    if (!resolved.startsWith(resolvedParent + "/") && resolved !== resolvedParent) {
      throw new Error("Path escapes allowed directory")
    }
  }
}

async function scanDirectory(
  rootPath: string,
  currentPath: string = rootPath,
  depth: number = 0,
  maxDepth: number = 15,
  showHidden: boolean = false,
): Promise<FileEntry[]> {
  if (depth > maxDepth) return []

  const entries: FileEntry[] = []

  try {
    const dirEntries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of dirEntries) {
      const fullPath = join(currentPath, entry.name)
      const relativePath = relative(rootPath, fullPath)

      const isSymlink = entry.isSymbolicLink()
      const targetStat = isSymlink ? await stat(fullPath).catch(() => null) : null
      const isDirectory = entry.isDirectory() || targetStat?.isDirectory() === true
      const isFile = entry.isFile() || targetStat?.isFile() === true

      if (isDirectory) {
        const entryName = entry.name
        if (IGNORED_DIRS.has(entryName)) continue
        if (
          !showHidden
          && entryName.startsWith(".")
          && !entryName.startsWith(".github")
          && !entryName.startsWith(".vscode")
        ) {
          continue
        }

        entries.push({ path: relativePath, type: "folder", isSymlink: isSymlink || undefined })

        if (!isSymlink) {
          const subEntries = await scanDirectory(rootPath, fullPath, depth + 1, maxDepth, showHidden)
          entries.push(...subEntries)
        }
      } else if (isFile) {
        if (IGNORED_FILES.has(entry.name)) continue

        const ext = entry.name.includes(".") ? "." + entry.name.split(".").pop()?.toLowerCase() : ""
        if (IGNORED_EXTENSIONS.has(ext)) {
          if (!ALLOWED_LOCK_FILES.has(entry.name)) continue
        }

        entries.push({ path: relativePath, type: "file", isSymlink: isSymlink || undefined })
      }
    }
  } catch (error) {
    console.warn(`[kanna/files] Could not read directory: ${currentPath}`, error)
  }

  return entries
}

export async function listProjectFiles(projectPath: string, showHidden: boolean = false): Promise<FileEntry[]> {
  if (!projectPath) return []

  validatePathSafe(projectPath)

  try {
    const pathStat = await stat(projectPath)
    if (!pathStat.isDirectory()) {
      return []
    }
  } catch {
    return []
  }

  const cacheKey = `${projectPath}::${showHidden ? "hidden" : "visible"}`
  const cached = fileListCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.entries
  }

  const entries = await scanDirectory(projectPath, projectPath, 0, 15, showHidden)

  if (fileListCache.size >= MAX_CACHE_ENTRIES) {
    let oldest: string | null = null
    let oldestTime = Infinity
    for (const [key, val] of fileListCache) {
      if (val.timestamp < oldestTime) {
        oldestTime = val.timestamp
        oldest = key
      }
    }
    if (oldest) fileListCache.delete(oldest)
  }

  fileListCache.set(cacheKey, { entries, timestamp: now })
  return entries
}

export function clearProjectFilesCache(projectPath: string) {
  fileListCache.delete(`${projectPath}::visible`)
  fileListCache.delete(`${projectPath}::hidden`)
}

export interface ProjectFileSearchResult {
  id: string
  label: string
  path: string
  repository: "local"
  type: "file" | "folder"
  isSymlink?: boolean
}

export function filterProjectFiles(
  entries: FileEntry[],
  query: string,
  limit: number,
  typeFilter?: "file" | "folder",
): ProjectFileSearchResult[] {
  const queryLower = query.toLowerCase()

  let filtered = entries
  if (typeFilter) {
    filtered = filtered.filter((entry) => entry.type === typeFilter)
  }
  if (query) {
    filtered = filtered.filter((entry) => {
      const name = basename(entry.path).toLowerCase()
      const pathLower = entry.path.toLowerCase()
      return name.includes(queryLower) || pathLower.includes(queryLower)
    })
  }

  filtered.sort((a, b) => {
    const aName = basename(a.path).toLowerCase()
    const bName = basename(b.path).toLowerCase()

    if (query) {
      const aExact = aName === queryLower
      const bExact = bName === queryLower
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1

      const aStarts = aName.startsWith(queryLower)
      const bStarts = bName.startsWith(queryLower)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      if (aStarts && bStarts && aName.length !== bName.length) {
        return aName.length - bName.length
      }

      const aContains = aName.includes(queryLower)
      const bContains = bName.includes(queryLower)
      if (aContains && !bContains) return -1
      if (!aContains && bContains) return 1
    }

    return aName.localeCompare(bName)
  })

  const limited = filtered.slice(0, Math.min(limit, 5000))

  return limited.map((entry) => ({
    id: `${entry.type}:local:${entry.path}`,
    label: basename(entry.path),
    path: entry.path,
    repository: "local",
    type: entry.type,
    isSymlink: entry.isSymlink,
  }))
}

const MAX_TEXT_SIZE = 2 * 1024 * 1024
const MAX_BINARY_SIZE = 20 * 1024 * 1024

export type ReadTextResult =
  | { ok: true; content: string; byteLength: number }
  | { ok: false; reason: "not-found" | "too-large" | "binary" | "unknown"; byteLength: number }

export async function readTextFileSafe(filePath: string): Promise<ReadTextResult> {
  try {
    validatePathSafe(filePath)
    const fileStat = await stat(filePath)
    if (fileStat.size > MAX_TEXT_SIZE) {
      return { ok: false, reason: "too-large", byteLength: fileStat.size }
    }
    const buffer = await readFile(filePath)
    const sample = buffer.subarray(0, 8192)
    if (sample.includes(0)) {
      return { ok: false, reason: "binary", byteLength: fileStat.size }
    }
    return { ok: true, content: buffer.toString("utf-8"), byteLength: fileStat.size }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("ENOENT") || msg.includes("no such file")) {
      return { ok: false, reason: "not-found", byteLength: 0 }
    }
    return { ok: false, reason: "unknown", byteLength: 0 }
  }
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
}

export type ReadBinaryResult =
  | { ok: true; data: string; mimeType: string; byteLength: number }
  | { ok: false; reason: "not-found" | "too-large" | "unknown"; byteLength: number }

export async function readBinaryFileSafe(filePath: string): Promise<ReadBinaryResult> {
  try {
    validatePathSafe(filePath)
    const fileStat = await stat(filePath)
    if (fileStat.size > MAX_BINARY_SIZE) {
      return { ok: false, reason: "too-large", byteLength: fileStat.size }
    }
    const buffer = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_MAP[ext] || "application/octet-stream"
    return {
      ok: true,
      data: buffer.toString("base64"),
      mimeType,
      byteLength: fileStat.size,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("ENOENT") || msg.includes("no such file")) {
      return { ok: false, reason: "not-found", byteLength: 0 }
    }
    return { ok: false, reason: "unknown", byteLength: 0 }
  }
}
