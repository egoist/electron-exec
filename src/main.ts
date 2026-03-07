import { spawn, type ChildProcess } from "node:child_process"
import { ipcMain } from "electron"
import {
  EVENT_CHANNEL,
  EXEC_CHANNEL,
  type ExecEventMessage,
  type ExecRequestMessage,
} from "./shared.ts"

type ProcessOwnerMap = Map<string, ChildProcess>
type ManagedChildProcess = ChildProcess & {
  on(
    event: "error",
    listener: (error: Error & { code?: string }) => void,
  ): ManagedChildProcess
  on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): ManagedChildProcess
}

const owners = new Map<number, ProcessOwnerMap>()

function serializeError(error: Error & { code?: string }): Extract<
  ExecEventMessage,
  { type: "error" }
>["error"] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
  }
}

export function registerExecIPCHandler() {
  const handler = (event: Parameters<typeof ipcMain.on>[1] extends (
    event: infer T,
    ...args: any[]
  ) => void
    ? T
    : never,
  message: ExecRequestMessage) => {
    if (message.type === "spawn") {
      const child = spawn(message.command, message.args, {
        cwd: message.options?.cwd,
        env: message.options?.env,
        shell: message.options?.shell,
        stdio: ["pipe", "pipe", "pipe"],
      }) as ManagedChildProcess

      let ownerProcesses = owners.get(event.sender.id)
      if (!ownerProcesses) {
        ownerProcesses = new Map()
        owners.set(event.sender.id, ownerProcesses)

        event.sender.once("destroyed", () => {
          const senderProcesses = owners.get(event.sender.id)
          if (!senderProcesses) {
            return
          }
          for (const proc of senderProcesses.values()) {
            proc.kill()
          }
          owners.delete(event.sender.id)
        })
      }

      ownerProcesses.set(message.id, child)

      event.sender.send(EVENT_CHANNEL, {
        type: "spawn",
        id: message.id,
        pid: child.pid,
      } satisfies ExecEventMessage)

      child.stdout?.on("data", (data: Buffer) => {
        event.sender.send(EVENT_CHANNEL, {
          type: "stdout",
          id: message.id,
          data,
        } satisfies ExecEventMessage)
      })

      child.stderr?.on("data", (data: Buffer) => {
        event.sender.send(EVENT_CHANNEL, {
          type: "stderr",
          id: message.id,
          data,
        } satisfies ExecEventMessage)
      })

      child.on("error", (error: Error & { code?: string }) => {
        event.sender.send(EVENT_CHANNEL, {
          type: "error",
          id: message.id,
          error: serializeError(error),
        } satisfies ExecEventMessage)
      })

      child.on(
        "close",
        (code: number | null, signal: NodeJS.Signals | null) => {
        ownerProcesses.delete(message.id)
        if (ownerProcesses.size === 0) {
          owners.delete(event.sender.id)
        }

        event.sender.send(EVENT_CHANNEL, {
          type: "close",
          id: message.id,
          code,
          signal,
        } satisfies ExecEventMessage)
        },
      )

      return
    }

    const ownerProcesses = owners.get(event.sender.id)
    const child = ownerProcesses?.get(message.id)
    if (!child) {
      return
    }

    if (message.type === "kill") {
      child.kill(message.signal)
      return
    }

    if (message.type === "stdin:write") {
      child.stdin?.write(Buffer.from(message.data))
      return
    }

    child.stdin?.end(message.data ? Buffer.from(message.data) : undefined)
  }

  ipcMain.on(EXEC_CHANNEL, handler)

  return () => {
    ipcMain.removeListener(EXEC_CHANNEL, handler)
  }
}
