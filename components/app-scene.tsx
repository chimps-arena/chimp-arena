"use client";

import { usePathname } from "next/navigation";
import { SceneBg } from "@/components/scene-bg";

/**
 * One route-aware scene background, mounted once in the root layout.
 * Only entry/marketing routes get one — working screens stay clean.
 */
const SCENES: Record<
  string,
  { src: string; objectPosition?: string; opacity?: number }
> = {
  "/": { src: "/scenes/lookout-flag.jpg", objectPosition: "center 22%", opacity: 0.85 },
  "/mint": { src: "/scenes/coin-splash.png", objectPosition: "center 18%", opacity: 0.7 },
  "/crews": { src: "/scenes/crew-city.png", objectPosition: "center 35%", opacity: 0.55 },
};

export function AppScene() {
  const pathname = usePathname();
  const scene = SCENES[pathname];
  if (!scene) return null;
  return <SceneBg key={pathname} {...scene} />;
}
