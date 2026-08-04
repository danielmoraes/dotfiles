import { spawn } from "node:child_process"
import { once } from "node:events"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { WebSocketServer } from "ws"
import { CSWAP } from "./cswap"

// End-to-end via a MOCK STREAM DECK.
//
// Spins up a fake Stream Deck app (a WebSocket server implementing the real
// registration handshake), launches the actual built plugin process, sends it
// the `willAppear` the app sends for a dial, and asserts on the `setFeedback`
// that comes back — which *is* what gets painted on the touch strip.
//
// Two things only this test can prove, because they're properties of the
// spawned process rather than of any module:
//
//  1. `cswap` is reachable from launchd's four-entry `PATH`. The app runs
//     plugins with the login environment, and the last plugin to assume
//     otherwise painted `!` on every key (see the repo's `verify` skill).
//  2. The manifest is valid enough for the SDK to route the action. Manifest
//     errors are otherwise silent apart from one line in the Elgato log.
//
// This talks to the real cswap and the real accounts, but only ever reads:
// nothing here presses the dial, so no account is switched.
//
// Which is why it runs only where cswap is installed. The CLI is a uv tool on
// this machine rather than something the repo can pull in, and the accounts it
// reads live in the login Keychain — so on a CI runner there is nothing here to
// be right or wrong about, and the test stands aside instead of failing.

const PLUGIN_DIR = join(process.cwd(), "com.dmoraes.cswap.sdPlugin")
const PLUGIN_ENTRY = join(PLUGIN_DIR, "bin", "plugin.js")
const ACTION = "com.dmoraes.cswap.accounts"

/** Only the machine that drives the deck has the CLI this test is about. */
const INSTALLED = existsSync(CSWAP)

/** A Stream Deck + — the only device with the dials this action needs. */
const DEVICE = {
  id: "dev-1",
  name: "Mock Stream Deck +",
  type: 7, // DeviceType.StreamDeckPlus
  size: { columns: 4, rows: 2 },
}

function registrationInfo(pluginUUID: string) {
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
    devices: [DEVICE],
  }
}

function portOf(server: WebSocketServer): number {
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address with a port")
  }
  return address.port
}

/**
 * Launch the plugin against a mock Stream Deck, deliver one `willAppear` for
 * the dial, and resolve with the SVG it paints on the strip.
 */
async function paintedSvg(): Promise<string> {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 })
  await once(wss, "listening")
  const port = portOf(wss)

  let stderr = ""
  let child: ReturnType<typeof spawn> | undefined

  // Listeners before spawn, so an early exit or connection can't be missed.
  const result = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`timeout waiting for setFeedback. stderr:\n${stderr}`),
        ),
      20000,
    )

    wss.on("connection", (ws) => {
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
          ws.send(
            JSON.stringify({
              event: "willAppear",
              action: ACTION,
              context: "ctx-1",
              device: DEVICE.id,
              payload: {
                // The real app sends `Encoder` for a dial; the coordinates are
                // D2's, where the layout puts this action.
                controller: "Encoder",
                coordinates: { column: 1, row: 0 },
                isInMultiAction: false,
                settings: {},
              },
            }),
          )
          return
        }
        if (msg.event === "setFeedback" && msg.context === "ctx-1") {
          clearTimeout(timer)
          const canvas: string = msg.payload?.canvas ?? ""
          resolve(
            Buffer.from(
              canvas.replace("data:image/svg+xml;base64,", ""),
              "base64",
            ).toString("utf8"),
          )
        }
      })
    })

    child = spawn(
      process.execPath,
      [
        PLUGIN_ENTRY,
        "-port",
        String(port),
        "-pluginUUID",
        "com.dmoraes.cswap",
        "-registerEvent",
        "registerPlugin",
        "-info",
        JSON.stringify(registrationInfo("com.dmoraes.cswap")),
      ],
      {
        cwd: PLUGIN_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        // Exactly what launchd gives the Stream Deck app: no homebrew, no uv,
        // no nvm. If cswap can't be found here, it can't be found on the deck.
        env: { HOME: process.env.HOME, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
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
    wss.close()
  }
}

test.skipIf(!INSTALLED)(
  "the dial paints real account usage under launchd's PATH",
  async () => {
    const svg = await paintedSvg()

    // The error strip says "cswap" and names a reason; the real one never does.
    // Checking this first turns a PATH regression into a legible failure rather
    // than a puzzling mismatch below.
    expect(svg, "painted the error strip instead of usage").not.toContain(
      "did not return JSON",
    )
    expect(svg).toContain("5H WINDOW")

    // A bar track per account, and at least one account marked active.
    expect(svg).toMatch(/<rect x="19"/)
    expect(svg, "no account marked active").toContain('fill="#FFFFFF"')
  },
  30000,
)
