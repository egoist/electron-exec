declare global {
  var ipcRenderer:
    | {
        send(channel: string, ...args: any[]): void
        on(
          channel: string,
          listener: (event: unknown, ...args: any[]) => void,
        ): void
      }
    | undefined
  var electronExecPlatform: string | undefined
  var electronExecShell: string | undefined
}

export {}
