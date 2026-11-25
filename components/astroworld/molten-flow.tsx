"use client";

/**
 * The foundry's live pour: molten metal running down the Meshy foundry's
 * chute into its crucible, a churning pool, rising embers and a heat glow.
 *
 * Coordinates are in the foundry model's own space as EnvModel fits it
 * (12 m wide, centred, feet on y = 0, front facing +z), measured on
 * public/models/env/foundry.glb. A different foundry model needs new numbers.
 *
 * No real light: one more point light would recompile every material in the
 * world and cost every pixel. The glow is additive sprites instead.
 */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { buildMolten } from "./molten-flow-core";

export function MoltenFlow() {
  const molten = useMemo(() => buildMolten(), []);
  useEffect(() => () => molten.dispose(), [molten]);
  useFrame(({ clock }) => molten.tick(clock.elapsedTime));
  return <primitive object={molten.group} />;
}
