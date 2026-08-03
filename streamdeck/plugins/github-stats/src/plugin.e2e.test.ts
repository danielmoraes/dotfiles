import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer, type Server } from "node:http"
import { join } from "node:path"
import { expect, test } from "vite-plus/test"
import { WebSocketServer } from "ws"

// End-to-end via a MOCK STREAM DECK.
//
// Spins up a fake Stream Deck app (a WebSocket server implementing the real
// registration handshake) plus a mock GitHub API (HTTP), launches the actual
// built plugin process, sends it a `willAppear` event, and asserts the plugin
// replies with the correct `setTitle` command. Exercises the whole plugin path
// — argv parsing, WS register, manifest load, action routing, GitHub fetch,
// command emission — without hardware or the Elgato app. The plugin bundle is
// built first by vitest.global-setup.ts.

const PLUGIN_DIR = join(process.cwd(), "com.dmoraes.github-stats.sdPlugin")
const PLUGIN_ENTRY = join(PLUGIN_DIR, "bin", "plugin.js")

/** A Stream Deck + -like device the SDK registers actions against. */
const DEVICE = {
  id: "dev-1",
  name: "Mock Stream Deck +",
  type: 7, // DeviceType.StreamDeckPlus
  size: { columns: 4, rows: 2 },
}

/** Minimal registration info the SDK expects under `-info`. */
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

function portOf(server: WebSocketServer | Server): number {
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address with a port")
  }
  return address.port
}

/** Start a mock GitHub API. Returns { url, close }. */
async function startMockGitHub(routes: (u: URL) => unknown) {
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://localhost")
    const body = routes(u)
    res.writeHead(body ? 200 : 404, { "content-type": "application/json" })
    res.end(JSON.stringify(body ?? { message: "not found" }))
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  return {
    url: `http://127.0.0.1:${portOf(server)}`,
    close: () => server.close(),
  }
}

/**
 * Launch the plugin against a mock Stream Deck, deliver one willAppear, and
 * resolve with the first setTitle title the plugin sends back.
 */
async function runPluginWillAppear({
  actionUUID,
  settings,
}: {
  actionUUID: string
  settings: unknown
}): Promise<string> {
  const pluginUUID = "com.dmoraes.github-stats"
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 })
  await once(wss, "listening")
  const port = portOf(wss)

  let stderr = ""
  let child: ReturnType<typeof spawn> | undefined

  // Attach all listeners BEFORE spawning the plugin, so we can't miss the
  // WebSocket connection or an early exit.
  const result = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`timeout waiting for setTitle. stderr:\n${stderr}`)),
      15000,
    )

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString())
        if (msg.event === "registerPlugin") {
          // Handshake complete. Announce the device, then deliver a willAppear
          // for our action — the same order the real Stream Deck app uses.
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
              action: actionUUID,
              context: "ctx-1",
              device: DEVICE.id,
              payload: {
                controller: "Keypad",
                coordinates: { column: 0, row: 0 },
                isInMultiAction: false,
                settings,
                state: 0,
              },
            }),
          )
          return
        }
        if (msg.event === "setTitle" && msg.context === "ctx-1") {
          clearTimeout(timer)
          resolve(msg.payload?.title)
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
        pluginUUID,
        "-registerEvent",
        "registerPlugin",
        "-info",
        JSON.stringify(registrationInfo(pluginUUID)),
      ],
      { cwd: PLUGIN_DIR, stdio: ["ignore", "pipe", "pipe"] },
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

test("registration handshake + willAppear -> setTitle shows the PR count", async () => {
  const gh = await startMockGitHub((u) =>
    u.pathname === "/search/issues" ? { total_count: 3, items: [] } : null,
  )
  try {
    const title = await runPluginWillAppear({
      actionUUID: "com.dmoraes.github-stats.search-count",
      settings: {
        query: "is:open is:pr review-requested:@me",
        apiBase: gh.url,
        token: "test-token",
      },
    })
    expect(title).toBe("3")
  } finally {
    gh.close()
  }
})

test("CI status action maps a successful run to 'OK'", async () => {
  const gh = await startMockGitHub((u) =>
    u.pathname === "/repos/danielmoraes/dotfiles/actions/runs"
      ? { workflow_runs: [{ status: "completed", conclusion: "success" }] }
      : null,
  )
  try {
    const title = await runPluginWillAppear({
      actionUUID: "com.dmoraes.github-stats.ci-status",
      settings: {
        repo: "danielmoraes/dotfiles",
        branch: "main",
        apiBase: gh.url,
      },
    })
    expect(title).toBe("OK")
  } finally {
    gh.close()
  }
})

test("a failing GitHub API surfaces '!' rather than crashing the plugin", async () => {
  const gh = await startMockGitHub(() => null)
  try {
    const title = await runPluginWillAppear({
      actionUUID: "com.dmoraes.github-stats.search-count",
      settings: { query: "x", apiBase: gh.url },
    })
    expect(title).toBe("!")
  } finally {
    gh.close()
  }
})
