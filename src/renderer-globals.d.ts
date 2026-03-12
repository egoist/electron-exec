import type { ElectronExecIPC } from "./renderer.ts"

declare global {
  const electronExecIPC: ElectronExecIPC

  interface GlobalThis {
    electronExecIPC: ElectronExecIPC
    electronExecPlatform?: string
    electronExecShell?: string
  }
}

export {}
