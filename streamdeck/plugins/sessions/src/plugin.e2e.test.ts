import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { WebSocketServer } from "ws"

// End-to-end via a MOCK STREAM DECK over a REAL FILESYSTEM.
//
// Spins up a fake Stream Deck app (a WebSocket server implementing the real
// registration handshake), lays down session records and a transcript exactly
// as Claude Code writes them, launches the actual built plugin process, sends
// it the `willAppear` the app sends for two keys, and asserts on the
// `setImage` that comes back — which is what gets painted.
//
// Things only this test can prove, because they're properties of the spawned
// process rather than of any module:
//
//  1. The plugin reads the session directory and transcripts under launchd's
//     four-entry `PATH` and minimal environment, and can run `/bin/ps` there.
//     The app runs plugins with the login environment, not a shell's (see the
//     repo's `verify` skill).
//  2. The manifest is valid enough for the SDK to route the action. Manifest
//     errors are otherwise silent apart from one line in the Elgato log.
//  3. Slots fill in key order — the second key gets the second session.
//
// Everything is a fixture in a temp directory, so this never reads the real
// sessions or depends on any being open.

const PLUGIN_DIR = join(process.cwd(), "com.dmoraes.sessions.sdPlugin")
const PLUGIN_ENTRY = join(PLUGIN_DIR, "bin", "plugin.js")
const ACTION = "com.dmoraes.sessions.slot"

const DEVICE = {
  id: "dev-1",
  name: "Mock Stream Deck +",
  type: 7, // DeviceType.StreamDeckPlus
  size: { columns: 4, rows: 2 },
}

/** 280 616 context tokens — 28% of a 1M window, the reading that started this. */
const USAGE = {
  input_tokens: 2,
  cache_creation_input_tokens: 5,
  cache_read_input_tokens: 280_609,
  output_tokens: 406,
}

/**
 * Two sessions, laid out the way Claude Code does: a record per session and a
 * transcript under the encoded project directory.
 *
 * Both records carry *this* process's pid, because the plugin drops any whose
 * process has gone — that liveness check is real here, not stubbed. The
 * filenames are normally `<pid>.json`, but the pid the plugin uses is the one
 * inside the file, so two records can share a live process.
 */
function fixture(): { home: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), "home-"))
  const sessions = join(home, ".claude", "sessions")
  const projects = join(home, ".claude", "projects")
  mkdirSync(sessions, { recursive: true })

  const write = (
    file: string,
    session: Record<string, unknown> & { sessionId: string; cwd: string },
  ): void => {
    writeFileSync(
      join(sessions, file),
      JSON.stringify({ pid: process.pid, ...session }),
    )
    const dir = join(projects, session.cwd.replaceAll(/[/.]/g, "-"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, `${session.sessionId}.jsonl`),
      `${JSON.stringify({ type: "assistant", message: { usage: USAGE } })}\n`,
    )
  }

  write("1001.json", {
    sessionId: "aaaaaaaa-0000-0000-0000-000000000001",
    cwd: "/Users/x/Work/steward/.claude/worktrees/calm-mapping-twilight",
    startedAt: 1_785_784_000_000,
    status: "busy",
    name: "stream deck",
  })
  write("1002.json", {
    sessionId: "bbbbbbbb-0000-0000-0000-000000000002",
    cwd: "/Users/x/Work/dotfiles",
    startedAt: 1_785_785_000_000,
    status: "idle",
    name: "derived-thing",
    nameSource: "derived",
  })

  return {
    home,
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  }
}

function portOf(server: WebSocketServer): number {
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address with a port")
  }
  return address.port
}

function registrationInfo(pluginUUID: string, devices: unknown[]) {
  return {
    application: {
      font: "",
      language: "en",
      platform: "mac",
      platformVersion: "14.0",
      version: "6.9.0",
    },
    colors: {},
    devicePixelRatio: 2,
    plugin: { uuid: pluginUUID, version: "0.1.0" },
    devices,
  }
}

function decode(image: string): string {
  return Buffer.from(
    image.replace("data:image/svg+xml;base64,", ""),
    "base64",
  ).toString("utf8")
}

/**
 * Launch the plugin against a mock deck and a fixture home, deliver a
 * `willAppear` for two adjacent keys, and resolve with what each paints.
 */
async function paintedKeys(home: string): Promise<Map<string, string>> {
  const deck = new WebSocketServer({ host: "127.0.0.1", port: 0 })
  await once(deck, "listening")

  let stderr = ""
  let child: ReturnType<typeof spawn> | undefined
  const painted = new Map<string, string>()

  const result = new Promise<Map<string, string>>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`timeout waiting for setImage. stderr:\n${stderr}`)),
      20000,
    )

    deck.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString())
        if (msg.event === "registerPlugin") {
          ws.send(
            JSON.stringify({
              event: "deviceDidConnect",
              device: DEVICE.id,
              deviceInfo: DEVICE,
            }),
          )
          for (const [index, context] of ["ctx-1", "ctx-2"].entries()) {
            ws.send(
              JSON.stringify({
                event: "willAppear",
                action: ACTION,
                context,
                device: DEVICE.id,
                payload: {
                  controller: "Keypad",
                  coordinates: { column: index, row: 0 },
                  isInMultiAction: false,
                  settings: {
                    contextWindow: 1_000_000,
                    sessionsDir: join(home, ".claude", "sessions"),
                    projectsDir: join(home, ".claude", "projects"),
                  },
                },
              }),
            )
          }
          return
        }
        if (msg.event === "setImage") {
          painted.set(msg.context, decode(msg.payload?.image ?? ""))
          const svgs = [...painted.values()]
          if (
            svgs.some((svg) => svg.includes("steward")) &&
            svgs.some((svg) => svg.includes("dotfiles"))
          ) {
            clearTimeout(timer)
            resolve(painted)
          }
        }
      })
    })

    child = spawn(
      process.execPath,
      [
        PLUGIN_ENTRY,
        "-port",
        String(portOf(deck)),
        "-pluginUUID",
        "com.dmoraes.sessions",
        "-registerEvent",
        "registerPlugin",
        "-info",
        JSON.stringify(registrationInfo("com.dmoraes.sessions", [DEVICE])),
      ],
      {
        cwd: PLUGIN_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        // Exactly what launchd gives the Stream Deck app: no homebrew, no nvm.
        env: { HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
      },
    )
    child.stderr?.on("data", (d) => (stderr += d.toString()))
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`plugin exited ${code}. stderr:\n${stderr}`))
      }
    })
  })

  try {
    return await result
  } finally {
    child?.kill("SIGKILL")
    deck.close()
  }
}

test("keys paint live sessions, oldest first, under launchd's PATH", async () => {
  const { home, cleanup } = fixture()
  try {
    const painted = await paintedKeys(home)
    const first = painted.get("ctx-1") ?? ""
    const second = painted.get("ctx-2") ?? ""

    // Slot order is key order, and the older session takes the first key.
    expect(first, "first key did not take the oldest session").toContain(
      ">steward<",
    )
    expect(second).toContain(">dotfiles<")

    // A name someone chose displaces the worktree; a derived one doesn't.
    expect(first).toContain(">stream deck<")
    expect(second).not.toContain(">derived-thing<")

    // `busy` orbits teal, `idle` doesn't.
    expect(first).toContain("#2DD4BF")
    expect(second).not.toContain("#2DD4BF")

    // 280 616 tokens against the 1M window declared in settings. Reading 140%
    // here would mean the 200k default leaked back in.
    expect(
      first,
      "context is not a percentage of the declared window",
    ).toContain(">28%<")
  } finally {
    cleanup()
  }
}, 30000)
