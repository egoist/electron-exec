import {
  EVENT_CHANNEL,
  EXEC_CHANNEL,
  type ExecEventMessage,
  type ExecSerializableOptions,
} from "./shared.ts"

export type ExecOptions = ExecSerializableOptions

type Listener = (...args: any[]) => void

export interface ElectronExecIPC {
  send(channel: string, ...args: any[]): void
  on(channel: string, listener: (event: unknown, ...args: any[]) => void): void
  removeListener(
    channel: string,
    listener: (event: unknown, ...args: any[]) => void,
  ): void
}

export interface RendererExecStream {
  on(event: "data", listener: (data: Uint8Array) => void): this
  once(event: "data", listener: (data: Uint8Array) => void): this
  off(event: "data", listener: (data: Uint8Array) => void): this
}

export interface RendererExecWritableStream {
  write(data: string | Uint8Array): void
  end(data?: string | Uint8Array): void
}

export interface RendererExecProcess {
  pid?: number
  stdin: RendererExecWritableStream
  stdout: RendererExecStream
  stderr: RendererExecStream
  kill(signal?: NodeJS.Signals | number): void
  on(event: "spawn", listener: () => void): this
  on(event: "error", listener: (error: Error) => void): this
  on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
  once(event: "spawn", listener: () => void): this
  once(event: "error", listener: (error: Error) => void): this
  once(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
  off(event: "spawn", listener: () => void): this
  off(event: "error", listener: (error: Error) => void): this
  off(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
}

function getIpcRenderer(): ElectronExecIPC {
  if (typeof electronExecIPC === "undefined") {
    throw new Error("electronExecIPC is not available on global scope")
  }
  return electronExecIPC
}

function toBytes(data: string | Uint8Array) {
  return typeof data === "string" ? new TextEncoder().encode(data) : data
}

class Emitter {
  #listeners = new Map<string, Set<Listener>>()

  on(event: string, listener: Listener): this {
    const listeners = this.#listeners.get(event) ?? new Set<Listener>()
    listeners.add(listener)
    this.#listeners.set(event, listeners)
    return this
  }

  once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped)
      listener(...args)
    }
    return this.on(event, wrapped)
  }

  off(event: string, listener: Listener): this {
    const listeners = this.#listeners.get(event)
    listeners?.delete(listener)
    if (listeners?.size === 0) {
      this.#listeners.delete(event)
    }
    return this
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.#listeners.get(event)
    if (!listeners) {
      return
    }
    for (const listener of listeners) {
      listener(...args)
    }
  }

  removeAllListeners() {
    this.#listeners.clear()
  }
}

class ExecStream extends Emitter implements RendererExecStream {
  override on(event: "data", listener: (data: Uint8Array) => void): this {
    return super.on(event, listener)
  }

  override once(event: "data", listener: (data: Uint8Array) => void): this {
    return super.once(event, listener)
  }

  override off(event: "data", listener: (data: Uint8Array) => void): this {
    return super.off(event, listener)
  }
}

class ExecProcess extends Emitter implements RendererExecProcess {
  pid?: number
  readonly stdin: RendererExecWritableStream
  readonly stdout = new ExecStream()
  readonly stderr = new ExecStream()

  constructor(readonly id: string) {
    super()
    this.stdin = {
      write: (data) => {
        getIpcRenderer().send(EXEC_CHANNEL, {
          type: "stdin:write",
          id: this.id,
          data: toBytes(data),
        })
      },
      end: (data) => {
        getIpcRenderer().send(EXEC_CHANNEL, {
          type: "stdin:end",
          id: this.id,
          data: data === undefined ? undefined : toBytes(data),
        })
      },
    }
  }

  kill(signal?: NodeJS.Signals | number) {
    getIpcRenderer().send(EXEC_CHANNEL, {
      type: "kill",
      id: this.id,
      signal,
    })
  }

  override on(event: "spawn", listener: () => void): this
  override on(event: "error", listener: (error: Error) => void): this
  override on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
  override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  override once(event: "spawn", listener: () => void): this
  override once(event: "error", listener: (error: Error) => void): this
  override once(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
  override once(event: string, listener: (...args: any[]) => void): this {
    return super.once(event, listener)
  }

  override off(event: "spawn", listener: () => void): this
  override off(event: "error", listener: (error: Error) => void): this
  override off(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this
  override off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener)
  }
}

const processes = new Map<string, ExecProcess>()

export function registerExecIPCHandler() {
  const listener = (_event: unknown, message: ExecEventMessage) => {
    const proc = processes.get(message.id)
    if (!proc) {
      return
    }

    switch (message.type) {
      case "spawn":
        proc.pid = message.pid
        proc.emit("spawn")
        return
      case "stdout":
        proc.stdout.emit("data", new Uint8Array(message.data))
        return
      case "stderr":
        proc.stderr.emit("data", new Uint8Array(message.data))
        return
      case "error": {
        const error = Object.assign(new Error(message.error.message), {
          name: message.error.name,
          stack: message.error.stack,
          code: message.error.code,
        })
        proc.emit("error", error)
        return
      }
      case "close":
        processes.delete(message.id)
        proc.emit("close", message.code, message.signal)
        proc.removeAllListeners()
        proc.stdout.removeAllListeners()
        proc.stderr.removeAllListeners()
    }
  }

  getIpcRenderer().on(EVENT_CHANNEL, listener)

  return () => {
    getIpcRenderer().removeListener(EVENT_CHANNEL, listener)
  }
}

export function exec(
  command: string,
  args: string[] = [],
  options?: ExecOptions,
): RendererExecProcess {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const proc = new ExecProcess(id)

  processes.set(id, proc)
  getIpcRenderer().send(EXEC_CHANNEL, {
    type: "spawn",
    id,
    command,
    args,
    options,
  })

  return proc
}
