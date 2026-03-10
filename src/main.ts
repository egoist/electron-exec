import { spawn, type ChildProcess } from "node:child_process"
import { ipcMain } from "electron"
import {
  EVENT_CHANNEL,
  EXEC_CHANNEL,
  type ExecEventMessage,
  type ExecRequestMessage,
} from "./shared.ts"
import treeKill from "tree-kill"

type ProcessOwnerMap = Map<string, ChildProcess>

const owners = new Map<number, ProcessOwnerMap>()

function killChild(child: ChildProcess, signal?: NodeJS.Signals | number) {
  const pid = child.pid
  if (pid) {
    return new Promise<void>((resolve, reject) => {
      treeKill(pid, signal, (error) => {
        if (error) return reject(error)
        resolve()
      })
    })
  }
  child.kill(signal)
}

function serializeError(
  error: Error & { code?: string },
): Extract<ExecEventMessage, { type: "error" }>["error"] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
  }
}

export function registerExecIPCHandler() {
  const handler = (
    event: Parameters<typeof ipcMain.on>[1] extends (
      event: infer T,
      ...args: any[]
    ) => void
      ? T
      : never,
    message: ExecRequestMessage,
  ) => {
    if (message.type === "spawn") {
      const child: ChildProcess = spawn(message.command, message.args, {
        cwd: message.options?.cwd,
        env: message.options?.env,
        shell: message.options?.shell,
        stdio: ["pipe", "pipe", "pipe"],
      })

      const sender = event.sender
      const senderId = sender.id

      const safeSend = (msg: ExecEventMessage) => {
        if (!sender.isDestroyed()) {
          sender.send(EVENT_CHANNEL, msg)
        }
      }

      let ownerProcesses = owners.get(senderId)
      if (!ownerProcesses) {
        ownerProcesses = new Map()
        owners.set(senderId, ownerProcesses)

        sender.once("destroyed", () => {
          const senderProcesses = owners.get(senderId)
          if (!senderProcesses) {
            return
          }
          for (const proc of senderProcesses.values()) {
            killChild(proc)
          }
          owners.delete(senderId)
        })
      }

      ownerProcesses.set(message.id, child)

      safeSend({
        type: "spawn",
        id: message.id,
        pid: child.pid,
      })

      child.stdout?.on("data", (data: Buffer) => {
        safeSend({
          type: "stdout",
          id: message.id,
          data,
        })
      })

      child.stderr?.on("data", (data: Buffer) => {
        safeSend({
          type: "stderr",
          id: message.id,
          data,
        })
      })

      child.on("error", (error: Error & { code?: string }) => {
        safeSend({
          type: "error",
          id: message.id,
          error: serializeError(error),
        })
      })

      child.on(
        "close",
        (code: number | null, signal: NodeJS.Signals | null) => {
          ownerProcesses.delete(message.id)
          if (ownerProcesses.size === 0) {
            owners.delete(senderId)
          }

          safeSend({
            type: "close",
            id: message.id,
            code,
            signal,
          })
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
      killChild(child, message.signal)
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
