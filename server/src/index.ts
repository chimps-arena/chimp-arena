import { listen } from "@colyseus/tools";
import appConfig from "./app.config";
import { startWorldCovers } from "./world-covers";

const port = Number(process.env.PORT ?? 2567);

startWorldCovers();
listen(appConfig, port).then(() => {
  console.log(`chimp-arena game server (mining + Astroworld) listening on :${port}`);
});
