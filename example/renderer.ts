import { exec, registerExecIPCHandler } from "../src/index.ts"

registerExecIPCHandler()

const textDecoder = new TextDecoder()
const commandInput = document.querySelector<HTMLInputElement>("#command")
const argsInput = document.querySelector<HTMLInputElement>("#args")
const runButton = document.querySelector<HTMLButtonElement>("#run")
const killButton = document.querySelector<HTMLButtonElement>("#kill")
const stdinInput = document.querySelector<HTMLTextAreaElement>("#stdin")
const sendStdinButton = document.querySelector<HTMLButtonElement>("#send-stdin")
const endStdinButton = document.querySelector<HTMLButtonElement>("#end-stdin")
const statusOutput = document.querySelector<HTMLElement>("#status")
const stdoutOutput = document.querySelector<HTMLElement>("#stdout")
const stderrOutput = document.querySelector<HTMLElement>("#stderr")

if (
  !commandInput ||
  !argsInput ||
  !runButton ||
  !killButton ||
  !stdinInput ||
  !sendStdinButton ||
  !endStdinButton ||
  !statusOutput ||
  !stdoutOutput ||
  !stderrOutput
) {
  throw new Error("Example app failed to initialize")
}

const safeCommandInput = commandInput
const safeArgsInput = argsInput
const safeRunButton = runButton
const safeKillButton = killButton
const safeStdinInput = stdinInput
const safeSendStdinButton = sendStdinButton
const safeEndStdinButton = endStdinButton
const safeStatusOutput = statusOutput
const safeStdoutOutput = stdoutOutput
const safeStderrOutput = stderrOutput

const platform = globalThis.electronExecPlatform ?? "unknown"
const defaultCommand =
  platform === "win32" ? "cmd" : globalThis.electronExecShell || "sh"
const defaultArgs =
  platform === "win32"
    ? '/d /s /c "more"'
    : '-lc "cat"'

safeCommandInput.value = defaultCommand
safeArgsInput.value = defaultArgs
safeStdinInput.value = "hello from stdin\nsecond line\n"

let currentProc: ReturnType<typeof exec> | undefined

function appendLine(element: HTMLElement, text: string) {
  element.textContent += text
  element.scrollTop = element.scrollHeight
}

function resetOutput() {
  safeStdoutOutput.textContent = ""
  safeStderrOutput.textContent = ""
}

function setRunningState(isRunning: boolean) {
  safeRunButton.disabled = isRunning
  safeKillButton.disabled = !isRunning
  safeSendStdinButton.disabled = !isRunning
  safeEndStdinButton.disabled = !isRunning
}

function parseArgs(input: string) {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return matches.map((part) => {
    if (
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith("'") && part.endsWith("'"))
    ) {
      return part.slice(1, -1)
    }
    return part
  })
}

safeRunButton.addEventListener("click", () => {
  resetOutput()
  setRunningState(true)

  const proc = exec(safeCommandInput.value, parseArgs(safeArgsInput.value))
  currentProc = proc

  safeStatusOutput.textContent = "Running..."

  proc.on("spawn", () => {
    safeStatusOutput.textContent = `Running (pid ${proc.pid ?? "unknown"})`
  })

  proc.stdout.on("data", (data) => {
    appendLine(safeStdoutOutput, textDecoder.decode(data, { stream: true }))
  })

  proc.stderr.on("data", (data) => {
    appendLine(safeStderrOutput, textDecoder.decode(data, { stream: true }))
  })

  proc.on("error", (error) => {
    appendLine(safeStderrOutput, `${error.name}: ${error.message}\n`)
  })

  proc.on("close", (code, signal) => {
    safeStatusOutput.textContent = `Closed with code ${code ?? "null"}${signal ? `, signal ${signal}` : ""}`
    setRunningState(false)
    if (currentProc === proc) {
      currentProc = undefined
    }
  })
})

safeKillButton.addEventListener("click", () => {
  currentProc?.kill()
})

safeSendStdinButton.addEventListener("click", () => {
  currentProc?.stdin.write(safeStdinInput.value)
})

safeEndStdinButton.addEventListener("click", () => {
  currentProc?.stdin.end()
})
