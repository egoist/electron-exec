const { ipcRenderer } = require("electron")

globalThis.ipcRenderer = ipcRenderer
globalThis.electronExecPlatform = process.platform
globalThis.electronExecShell = process.env.SHELL
