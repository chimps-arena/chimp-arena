/**
 * Shared Colyseus app config - imported by both the real server (index.ts)
 * and the integration test (MiningRoom.test.ts), so a test genuinely boots
 * the same room registration a real deploy would.
 */
import config from "@colyseus/tools";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MiningRoom } from "./rooms/MiningRoom";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { HubRoom, hubStats } from "./rooms/HubRoom";

// Event-loop delay: the best single signal that the server is overloaded
// (every room tick and network message waits behind it).
const LOOP_RESOLUTION_MS = 10;
const loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
loopDelay.enable();
let lastCpu = process.cpuUsage();
let lastCpuAt = process.hrtime.bigint();

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("mining", MiningRoom);
    // "lane" keeps load-test bots in their own instances: players never send
    // it, so they're never matched into a test room (and vice versa).
    gameServer.define("hub", HubRoom).filterBy(["lane"]);
  },
  initializeTransport: () => new WebSocketTransport(),
  initializeExpress: (app) => {
    // Load balancer / uptime check (Fly.io hits this before routing players here).
    // Also reports load (CPU since the previous call, memory, event-loop delay,
    // rooms and players) for scripts/hub-load.mjs. No player data.
    app.get("/health", (_req, res) => {
      const now = process.hrtime.bigint();
      const cpu = process.cpuUsage(lastCpu);
      const wallUs = Number(now - lastCpuAt) / 1000;
      lastCpu = process.cpuUsage();
      lastCpuAt = now;
      // The histogram includes the sampling interval itself; report only the lag beyond it.
      const ms = (ns: number) => Math.max(0, Math.round((ns / 1e6 - LOOP_RESOLUTION_MS) * 10) / 10);
      res.json({
        ok: true,
        uptime: Math.round(process.uptime()),
        hub: hubStats(),
        cpuPct: wallUs > 0 ? Math.round(((cpu.user + cpu.system) / wallUs) * 1000) / 10 : 0,
        rssMb: Math.round(process.memoryUsage().rss / 1e6),
        loopDelayMs: { p50: ms(loopDelay.percentile(50)), p99: ms(loopDelay.percentile(99)), max: ms(loopDelay.max) },
      });
      loopDelay.reset();
    });
  },
});
