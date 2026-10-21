import { NextResponse } from "next/server";
import { CHUNK_SIZE, WORLD_CHUNKS, generateChunk } from "@chimp-arena/shared";

export const runtime = "nodejs";

/**
 * B1 proof-of-wiring route - confirms the Next.js client can resolve and
 * build against the new shared/ workspace package end to end. Safe to
 * delete once J3 (real client integration against the Colyseus room) gives
 * shared/ a real caller in the app.
 */
export async function GET() {
  return NextResponse.json({
    chunkSize: CHUNK_SIZE,
    worldChunks: WORLD_CHUNKS,
    sampleChunk: generateChunk(1234, 1, 0, 0),
  });
}
