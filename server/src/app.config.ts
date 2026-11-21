/**
 * Shared Colyseus app config - imported by both the real server (index.ts)
 * and the integration test (MiningRoom.test.ts), so a test genuinely boots
 * the same room registration a real deploy would.
 */
import config from "@colyseus/tools";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MiningRoom } from "./rooms/MiningRoom";
import { HubRoom } from "./rooms/HubRoom";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("mining", MiningRoom);
    gameServer.define("hub", HubRoom);
  },
  initializeTransport: () => new WebSocketTransport(),
});
