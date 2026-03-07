import { app, BrowserWindow } from "electron"
import { resolve } from "node:path"
import { registerExecIPCHandler } from "../src/main.ts"

registerExecIPCHandler()

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 760,
    backgroundColor: "#101418",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: resolve(process.cwd(), "example/preload.cjs"),
    },
  })

  void window.loadFile(resolve(process.cwd(), "example/index.html"))
}

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
