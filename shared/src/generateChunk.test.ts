import { describe, expect, it } from "vitest";
import { generateChunk } from "./generateChunk";

describe("generateChunk determinism (B2 done-when)", () => {
  it("produces identical output for the same seed, genVersion, cx, cy", () => {
    const a = generateChunk(1234, 1, 2, -3);
    const b = generateChunk(1234, 1, 2, -3);
    expect(b).toEqual(a);
  });

  it("produces different output for a different seed", () => {
    const a = generateChunk(1234, 1, 0, 0);
    const b = generateChunk(5678, 1, 0, 0);
    expect(b).not.toEqual(a);
  });

  it("produces different output for a different genVersion", () => {
    const a = generateChunk(1234, 1, 0, 0);
    const b = generateChunk(1234, 2, 0, 0);
    expect(b).not.toEqual(a);
  });

  it("produces different output for different chunk coordinates", () => {
    const a = generateChunk(1234, 1, 0, 0);
    const b = generateChunk(1234, 1, 1, 0);
    expect(b).not.toEqual(a);
  });

  it("keeps every deposit position inside the chunk bounds", () => {
    const chunk = generateChunk(42, 1, 5, 5);
    for (const d of chunk.deposits) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThan(256);
      expect(d.z).toBeGreaterThanOrEqual(0);
      expect(d.z).toBeLessThan(256);
    }
  });
});
