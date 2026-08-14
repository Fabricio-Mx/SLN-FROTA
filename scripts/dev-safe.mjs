import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawn, spawnSync } from "node:child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const lockPath = path.join(projectRoot, ".next", "dev", "lock")

function runPowerShellJson(command) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    {
      cwd: projectRoot,
      encoding: "utf8",
    }
  )

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PowerShell command failed")
  }

  const stdout = result.stdout.trim()
  if (!stdout) {
    return []
  }

  return JSON.parse(stdout)
}

function getWorkspaceProcesses() {
  if (process.platform !== "win32") {
    return []
  }

  const escapedRoot = projectRoot.replace(/'/g, "''")
  const command = [
    "$root = '" + escapedRoot + "'",
    "$procs = Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object {",
    "  $_.CommandLine -like \"*$root*next*\" -or $_.CommandLine -like \"*$root*start-server.js*\"",
    "} | Select-Object ProcessId, ParentProcessId, CommandLine",
    "if ($procs) { $procs | ConvertTo-Json -Compress }",
  ].join("; ")

  const result = runPowerShellJson(command)
  return Array.isArray(result) ? result : [result]
}

function getListeningPorts(processIds) {
  if (process.platform !== "win32" || processIds.length === 0) {
    return []
  }

  const idList = processIds.join(",")
  const command = [
    "$ids = @(" + idList + ")",
    "$ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ids -contains $_.OwningProcess } | Select-Object LocalPort, OwningProcess",
    "if ($ports) { $ports | Sort-Object LocalPort -Unique | ConvertTo-Json -Compress }",
  ].join("; ")

  const result = runPowerShellJson(command)
  return Array.isArray(result) ? result : [result]
}

function removeStaleLock() {
  if (fs.existsSync(lockPath)) {
    fs.rmSync(lockPath, { force: true })
  }
}

function startNextDev() {
  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next")
  const child = spawn(process.execPath, [nextBin, "dev"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

try {
  const processes = getWorkspaceProcesses()

  if (processes.length > 0) {
    const ports = getListeningPorts(processes.map((proc) => proc.ProcessId))
    const port = ports[0]?.LocalPort

    if (port) {
      console.log(`Next.js dev server already running for this workspace at http://localhost:${port}.`)
      console.log("Use the existing instance instead of starting a second one.")
      process.exit(0)
    }
  }

  removeStaleLock()
  startNextDev()
} catch (error) {
  console.warn("Unable to inspect existing Next.js processes. Starting dev server normally.")
  console.warn(error instanceof Error ? error.message : String(error))
  removeStaleLock()
  startNextDev()
}