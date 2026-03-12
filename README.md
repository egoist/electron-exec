# electron-exec

Interfacing child_process in Electron renderer.

In main process:

```ts
import { registerExecIPCHandler } from "electron-exec/main"

registerExecIPCHandler()
```

In preload script:

```js
const { contextBridge, ipcRenderer } = require("electron")

const electronExecIPC = {
  send: ipcRenderer.send.bind(ipcRenderer),
  on: ipcRenderer.on.bind(ipcRenderer),
  removeListener: ipcRenderer.removeListener.bind(ipcRenderer),
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("electronExecIPC", electronExecIPC)
} else {
  globalThis.electronExecIPC = electronExecIPC
}
```

In renderer process:

```ts
import { exec, registerExecIPCHandler } from "electron-exec"

registerExecIPCHandler()

const proc = exec("command", ["-flag"])

proc.stdin.write("hello from renderer\n")
proc.stdin.end()

proc.stdout.on("data", (data) => {
  console.log(data)
})

proc.stderr.on("data", (data) => {
  console.log(data)
})

proc.on("error", (error) => {
  console.log(error)
})

proc.on("close", (code) => {
  console.log(code)
})
```

The preload script should expose a minimal `ipcRenderer` surface as `globalThis.electronExecIPC`. If you keep Electron's default `contextIsolation: true`, expose it with `contextBridge.exposeInMainWorld(...)` as shown above. `registerExecIPCHandler()` wires the renderer-side IPC event listener. Call it once during renderer startup before spawning processes.

## Demo app

This repo includes a minimal Electron example app in [`example/`](/Users/egoist/dev/electron-exec/example/index.html).

Build the demo:

```bash
bun run example:build
```

Run the demo with the Rolldown Node.js watch API. Electron starts from a
`writeBundle` hook after the main-process bundle is written:

```bash
bun run example
```

`bun run example:watch` runs the same watch workflow explicitly.

One-off build:

```bash
bun run example:build
```

The example keeps `nodeIntegration` off for the renderer, exposes
`globalThis.electronExecIPC` through a local preload script, and registers the
renderer IPC listener during startup in
[`example/renderer.ts`](/Users/egoist/dev/electron-exec/example/renderer.ts).
