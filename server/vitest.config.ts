import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 10000,
    // Colyseus probes for a PM2 monitoring channel via process.send() when one
    // is present - vitest's default forked-process pool exposes exactly that,
    // and its own IPC protocol chokes trying to parse the unrelated message.
    // The threads pool doesn't expose process.send() at all, so this never fires.
    pool: "threads",
  },
});
