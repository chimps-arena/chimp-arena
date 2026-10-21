/**
 * B1 stub - proves the server workspace actually resolves and builds
 * against @chimp-arena/shared end to end. The real Colyseus MiningRoom
 * (B3: player schema, join/leave, movement validation, chunk loading)
 * replaces this once B2's shared/ core is reviewed and merged.
 */
import { CHUNK_SIZE, WORLD_CHUNKS, generateChunk } from "@chimp-arena/shared";

console.log(`chimp-arena server stub - world is ${WORLD_CHUNKS}x${WORLD_CHUNKS} chunks of ${CHUNK_SIZE}m`);
console.log("sample chunk (seed=1234, genVersion=1, 0,0):", generateChunk(1234, 1, 0, 0));
