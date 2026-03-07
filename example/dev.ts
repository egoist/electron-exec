import { spawn } from "node:child_process"
import type { EventEmitter } from "node:events"
import { resolve } from "node:path"
import { watch } from "rolldown"
import treeKill from "tree-kill"
import config from "./rolldown.config.ts"

const cwd = resolve(import.meta.dir, "..")
const mainBundle = resolve(cwd, "example/dist/main.cjs")

let electronProcess: ReturnType<typeof spawn> | undefined
let pendingRestart = false
let shuttingDown = false

function spawnElectron() {
  const next = spawn("bun", ["electron", mainBundle], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  const nextEvents = next as ReturnType<typeof spawn> & EventEmitter

  nextEvents.on("exit", () => {
    if (electronProcess === next) {
      electronProcess = undefined
    }

    if (pendingRestart && !shuttingDown) {
      pendingRestart = false
      spawnElectron()
    }
  })

  nextEvents.on("error", (error: Error) => {
    console.error("[example] failed to start Electron:", error.message)
  })

  electronProcess = next
}

function restartElectron() {
  if (shuttingDown) {
    return
  }

  if (!electronProcess) {
    spawnElectron()
    return
  }

  pendingRestart = true
  if (electronProcess.pid) {
    treeKill(electronProcess.pid)
    return
  }
  electronProcess.kill()
}

const watchConfigs = config.map((item, index) => {
  if (index !== 0) {
    return item
  }

  return {
    ...item,
    plugins: [
      {
        name: "start-electron-on-write",
        writeBundle() {
          restartElectron()
        },
      },
    ],
  }
})

const watcher = watch(watchConfigs)

watcher.on("event", (event) => {
  switch (event.code) {
    case "START":
      console.log("[example] Rolldown watch started")
      break
    case "BUNDLE_START":
      console.log("[example] rebuilding bundles")
      break
    case "ERROR":
      console.error("[example] build error:", event.error)
      break
  }
})

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  watcher.close()
  if (electronProcess) {
    if (electronProcess.pid) {
      treeKill(electronProcess.pid, signal, () => {
        process.exit(0)
      })
      return
    }
    ;(electronProcess as ReturnType<typeof spawn> & EventEmitter).once("exit", () => {
      process.exit(0)
    })
    electronProcess.kill(signal)
    return
  }

  process.exit(0)
}

process.on("SIGINT", () => {
  shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  shutdown("SIGTERM")
})
