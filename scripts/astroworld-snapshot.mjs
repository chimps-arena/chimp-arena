// Visual QA for Astroworld: drives headless Chrome over the DevTools
// protocol, lets the game run in real time, optionally holds keys to move,
// saves screenshots and prints every console error / exception.
//
//   node scripts/astroworld-snapshot.mjs [url] [outDir] [plan]
//     url    default http://localhost:3000/astroworld
//     outDir default ./snapshots
//     plan   comma list of steps: "wait:8000", "key:w:2500" (hold W 2.5s),
//            "shot:name", "eval:<js>", "evalenv:VAR", "fps:3000"
//            default "wait:9000,shot:spawn"
//   ASTRO_SNAP_PHONE=1 emulates a phone (390x844, touch).
//
// Exit code 1 if the page logged errors.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const URL_ = process.argv[2] ?? "http://localhost:3000/astroworld";
const OUT = process.argv[3] ?? "snapshots";
const PLAN = (process.argv[4] ?? "wait:9000,shot:spawn").split(",");
const PORT = 9300 + Math.floor(Math.random() * 500);
const CHROME =
  process.env.CHROME_PATH ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].find(existsSync);
if (!CHROME) throw new Error("No Chrome/Edge found - set CHROME_PATH");
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `aw-snap-${PORT}`)}`,
    "--window-size=1400,820",
    // Real GPU by default (closest to what players see); ASTRO_SNAP_SOFTWARE=1 forces the slow software renderer.
    ...(process.env.ASTRO_SNAP_SOFTWARE ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu"]),
    "--ignore-gpu-blocklist",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === "page");
  } catch {
    /* not up yet */
  }
}
if (!target) throw new Error("Chrome didn't start");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const problems = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
    problems.push(`[console.${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    problems.push(`[exception] ${(d.exception?.description ?? d.text).slice(0, 400)}`);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Runtime.enable");
await send("Page.enable");
// ASTRO_SNAP_PHONE=1: a phone screen (390x844, touch, mobile user agent).
if (process.env.ASTRO_SNAP_PHONE) {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
}
await send("Page.navigate", { url: URL_ });

const KEYS = { w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD", f: "KeyF", " ": "Space", shift: "ShiftLeft" };
for (const step of PLAN) {
  const [kind, ...rest] = step.split(":");
  if (kind === "wait") await sleep(Number(rest[0]));
  else if (kind === "key") {
    const key = rest[0];
    const ms = Number(rest[1] ?? 500);
    const base = { key: key === "space" ? " " : key, code: KEYS[key] ?? `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
    await send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
    await sleep(ms);
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  } else if (kind === "fps") {
    // Frames per second over N ms, plus which GPU the page actually got.
    const ms = Number(rest[0] ?? 3000);
    const r = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ${ms}) requestAnimationFrame(tick); else { const c = document.createElement("canvas").getContext("webgl2"); const d = c && c.getExtension("WEBGL_debug_renderer_info"); res({ fps: Math.round((n * 1000) / (performance.now() - t0)), gpu: d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?" }); } }; requestAnimationFrame(tick); })`,
    });
    console.log(`fps -> ${JSON.stringify(r.result?.result?.value)}`);
  } else if (kind === "profile") {
    // CPU profile for N ms; prints the functions with the most self time.
    await send("Profiler.enable");
    await send("Profiler.setSamplingInterval", { interval: 500 });
    await send("Profiler.start");
    await sleep(Number(rest[0] ?? 3000));
    const { result } = await send("Profiler.stop");
    const nodes = result.profile.nodes;
    const dt = (result.profile.endTime - result.profile.startTime) / 1000 / Math.max(1, result.profile.samples.length);
    const self = new Map();
    const counts = new Map(result.profile.samples.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map()));
    for (const n of nodes) {
      const hits = counts.get(n.id) ?? 0;
      if (!hits) continue;
      const f = n.callFrame;
      const file = (f.url.split("/").pop() || "").split("?")[0];
      const key = `${f.functionName || "(anonymous)"} @ ${file}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + hits * dt);
    }
    // Blame each sample on the nearest of OUR functions up the stack (not node_modules),
    // which answers "which of our components/hooks is this time spent under?".
    const parent = new Map();
    for (const n of nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ours = new Map();
    for (const [nodeId, hits] of counts) {
      let cur = nodeId;
      while (cur != null) {
        const f = byId.get(cur)?.callFrame;
        if (f && f.url && !/node_modules|turbopack|react-dom|next_dist|:\/\/[^/]+\/?$/.test(f.url) && /_next\/static\/chunks\//.test(f.url)) {
          const key = `${f.functionName || "(anonymous)"} @ ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
          ours.set(key, (ours.get(key) ?? 0) + hits * dt);
          break;
        }
        cur = parent.get(cur);
      }
    }
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log(`profile (${Math.round(total)} ms sampled):`);
    for (const [k, ms] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(rest[1] ?? 25))) console.log(`  ${ms.toFixed(0).padStart(6)} ms  ${k}`);
    console.log("  -- under our code:");
    for (const [k, ms] of [...ours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${ms.toFixed(0).padStart(6)} ms  ${k}`);
  } else if (kind === "eval" || kind === "evalenv") {
    // evalenv:NAME runs the JS in env var NAME (for expressions containing commas).
    const expression = kind === "evalenv" ? process.env[rest[0]] : rest.join(":");
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    console.log(`eval -> ${JSON.stringify(r.result?.result?.value)}`);
  } else if (kind === "shot") {
    const r = await send("Page.captureScreenshot", { format: "png" });
    const file = join(OUT, `${rest[0] || "shot"}.png`);
    writeFileSync(file, Buffer.from(r.result.data, "base64"));
    console.log(`saved ${file}`);
  }
}

ws.close();
chrome.kill();
const unique = [...new Set(problems)];
console.log(unique.length ? `\n${unique.length} problem(s):\n${unique.join("\n")}` : "\nno console errors");
process.exit(unique.some((p) => !p.startsWith("[console.warning]")) ? 1 : 0);
