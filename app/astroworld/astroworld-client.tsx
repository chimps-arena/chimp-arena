"use client";

import dynamic from "next/dynamic";
import { useSession } from "@/components/session-provider";

const Placeholder = () => <div className="h-[calc(100dvh-140px)] min-h-[460px] animate-pulse rounded-xl bg-white/5" />;

// WebGL + websockets: client-only, and kept out of every other page's bundle.
const HubScene = dynamic(() => import("@/components/astroworld/hub-scene").then((m) => m.HubScene), {
  ssr: false,
  loading: Placeholder,
});

export function AstroworldClient() {
  const { me, loading } = useSession();
  // Wait for the session so we join once, under the player's handle, instead
  // of joining anonymously and then reconnecting when the name arrives.
  if (loading) return <Placeholder />;
  return <HubScene playerName={me?.player?.handle} loggedIn={!!me?.player} />;
}
