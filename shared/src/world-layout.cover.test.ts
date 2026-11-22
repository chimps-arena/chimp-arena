import { describe, expect, it } from "vitest";
import { shotBlockedAt, type Cover } from "./world-layout";

const wall: Cover = [10, 0, 2, 5];

describe("shotBlockedAt", () => {
  it("stops a shot at the near wall of a building", () => {
    expect(shotBlockedAt({ x: 0, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, [wall], 100)).toBeCloseTo(8);
  });
  it("lets a shot pass over a low building", () => {
    expect(shotBlockedAt({ x: 0, y: 6, z: 0 }, { x: 1, y: 0, z: 0 }, [wall], 100)).toBe(100);
  });
  it("ignores buildings behind or beside the shooter", () => {
    expect(shotBlockedAt({ x: 0, y: 1.4, z: 0 }, { x: -1, y: 0, z: 0 }, [wall], 100)).toBe(100);
    expect(shotBlockedAt({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 0, z: 1 }, [wall], 100)).toBe(100);
  });
  it("ignores cover beyond the shot's range and cover the shooter stands in", () => {
    expect(shotBlockedAt({ x: 0, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, [wall], 5)).toBe(5);
    expect(shotBlockedAt({ x: 10, y: 1.4, z: 0 }, { x: 1, y: 0, z: 0 }, [wall], 100)).toBe(100);
  });
  it("uses the nearest of several walls", () => {
    expect(shotBlockedAt({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, [wall, [5, 0, 1, 3]], 100)).toBeCloseTo(4);
  });
});
