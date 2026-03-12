const { ipcRenderer } = require("electron")

globalThis.electronExecIPC = {
  send: ipcRenderer.send.bind(ipcRenderer),
  on: ipcRenderer.on.bind(ipcRenderer),
  removeListener: ipcRenderer.removeListener.bind(ipcRenderer),
}

globalThis.electronExecPlatform = process.platform
globalThis.electronExecShell = process.env.SHELL
