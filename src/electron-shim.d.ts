declare module "electron" {
  import type { EventEmitter } from "node:events"

  export interface BrowserWindowConstructorOptions {
    width?: number
    height?: number
    backgroundColor?: string
    webPreferences?: {
      nodeIntegration?: boolean
      contextIsolation?: boolean
      preload?: string
    }
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions)
    loadFile(path: string): Promise<void>
    static getAllWindows(): BrowserWindow[]
  }

  export const app: {
    whenReady(): Promise<void>
    on(
      event: "activate" | "window-all-closed",
      listener: () => void,
    ): void
    quit(): void
  }

  export interface IpcMainEvent {
    sender: {
      id: number
      send(channel: string, ...args: any[]): void
      once(event: "destroyed", listener: () => void): this
    }
  }

  export interface IpcRendererEvent extends EventEmitter {}

  export const ipcMain: {
    on(
      channel: string,
      listener: (event: IpcMainEvent, ...args: any[]) => void,
    ): void
    removeListener(
      channel: string,
      listener: (event: IpcMainEvent, ...args: any[]) => void,
    ): void
  }

  export const ipcRenderer: {
    send(channel: string, ...args: any[]): void
    on(
      channel: string,
      listener: (event: IpcRendererEvent, ...args: any[]) => void,
    ): void
    removeListener(
      channel: string,
      listener: (event: IpcRendererEvent, ...args: any[]) => void,
    ): void
  }
}
