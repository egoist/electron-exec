export const EXEC_CHANNEL = "electron-exec:request"
export const EVENT_CHANNEL = "electron-exec:event"

export type ExecSerializableOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  shell?: boolean | string
}

export type ExecRequestMessage =
  | {
      type: "spawn"
      id: string
      command: string
      args: string[]
      options?: ExecSerializableOptions
    }
  | {
      type: "kill"
      id: string
      signal?: NodeJS.Signals | number
    }
  | {
      type: "stdin:write"
      id: string
      data: Uint8Array
    }
  | {
      type: "stdin:end"
      id: string
      data?: Uint8Array
    }

export type ExecEventMessage =
  | {
      type: "spawn"
      id: string
      pid?: number
    }
  | {
      type: "stdout"
      id: string
      data: Uint8Array
    }
  | {
      type: "stderr"
      id: string
      data: Uint8Array
    }
  | {
      type: "error"
      id: string
      error: {
        name: string
        message: string
        stack?: string
        code?: string
      }
    }
  | {
      type: "close"
      id: string
      code: number | null
      signal: NodeJS.Signals | null
    }
