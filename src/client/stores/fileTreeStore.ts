import { create } from "zustand"
import { persist } from "zustand/middleware"

export type FileViewerMode = "dialog" | "side-peek"

interface FileTreeStoreState {
  expandedByProject: Record<string, string[] | null>
  showHiddenByProject: Record<string, boolean>
  searchDialogOpen: boolean
  viewerMode: FileViewerMode
  setExpanded: (projectId: string, paths: string[]) => void
  setShowHidden: (projectId: string, value: boolean) => void
  setSearchDialogOpen: (value: boolean) => void
  setViewerMode: (mode: FileViewerMode) => void
}

export const useFileTreeStore = create<FileTreeStoreState>()(
  persist(
    (set) => ({
      expandedByProject: {},
      showHiddenByProject: {},
      searchDialogOpen: false,
      viewerMode: "side-peek",
      setExpanded: (projectId, paths) =>
        set((state) => ({
          expandedByProject: { ...state.expandedByProject, [projectId]: paths },
        })),
      setShowHidden: (projectId, value) =>
        set((state) => ({
          showHiddenByProject: { ...state.showHiddenByProject, [projectId]: value },
        })),
      setSearchDialogOpen: (value) => set({ searchDialogOpen: value }),
      setViewerMode: (mode) => set({ viewerMode: mode }),
    }),
    {
      name: "kanna:file-tree",
      partialize: (state) => ({
        expandedByProject: state.expandedByProject,
        showHiddenByProject: state.showHiddenByProject,
        viewerMode: state.viewerMode,
      }),
    },
  ),
)

export function getExpandedPaths(projectId: string): string[] | null {
  return useFileTreeStore.getState().expandedByProject[projectId] ?? null
}

export function getShowHidden(projectId: string): boolean {
  return useFileTreeStore.getState().showHiddenByProject[projectId] ?? false
}
