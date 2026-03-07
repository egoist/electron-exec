# electron-exec

Interfacing child_process in Electron renderer.

In main process:

```ts
import { registerExecIPCHandler } from "electron-exec/main"

registerExecIPCHandler()
```

In renderer process:

```ts
import { exec } from "electron-exec"

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

The example keeps `nodeIntegration` off for the renderer and exposes
`ipcRenderer` through a preload script as `globalThis.ipcRenderer`.
