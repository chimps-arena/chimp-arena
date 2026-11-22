"use client";

/**
 * Astro-News: the in-world newspaper. A kiosk in the Core with a big screen
 * looping the latest Breaking News clip and the current issue's cover;
 * press E there to read the whole issue page by page.
 *
 * Content is data: public/astroworld/news/index.json lists the issue's
 * pages and the clip. No index (or a broken one) means no kiosk, so an issue
 * can be pulled by deleting that one file.
 */

import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { endTalk, registerInteractable, type NpcSpec } from "./npcs";

const NEWS_DIR = "/astroworld/news/";

export interface NewsIndex {
  issue: string;
  date: string;
  pages: { file: string; title: string }[];
  breaking?: { video: string; poster?: string; headline: string };
}

export async function fetchNews(): Promise<NewsIndex | null> {
  try {
    const res = await fetch(`${NEWS_DIR}index.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as NewsIndex;
    return Array.isArray(j.pages) && j.pages.length > 0 ? j : null;
  } catch {
    return null;
  }
}

/** Kiosk spot in the Core: mirrors the Rover Showroom across the plaza. */
export const KIOSK = { x: -26, z: -14 };
const KIOSK_SPEC: NpcSpec = {
  key: "news-kiosk",
  characterId: "",
  role: "Astro-News · the official galactic news network",
  title: "Astro-News",
  kind: "news",
  route: { kind: "post", at: [KIOSK.x, KIOSK.z + 3.2], face: 0 },
  speed: 0,
  phase: 0,
};

const frameMat = new THREE.MeshStandardMaterial({ color: "#2a2638", metalness: 0.7, roughness: 0.3 });
const box = new THREE.BoxGeometry(1, 1, 1);

function useVideoTexture(src: string | undefined) {
  const [tex, setTex] = useState<THREE.VideoTexture | null>(null);
  useEffect(() => {
    if (!src) return;
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    const t = new THREE.VideoTexture(v);
    t.colorSpace = THREE.SRGBColorSpace;
    const start = () => {
      void v.play().catch(() => {});
      setTex(t);
    };
    v.addEventListener("loadeddata", start, { once: true });
    v.load();
    return () => {
      v.pause();
      v.removeAttribute("src");
      v.load();
      t.dispose();
    };
  }, [src]);
  return tex;
}

function useImageTexture(src: string | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader()
      .loadAsync(src)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        loaded = t;
        if (live) setTex(t);
      })
      .catch(() => {});
    return () => {
      live = false;
      loaded?.dispose();
    };
  }, [src]);
  return tex;
}

/** The kiosk in the world. Registers itself so E opens the reader. */
export function NewsKiosk({ news }: { news: NewsIndex }) {
  useEffect(() => registerInteractable(KIOSK_SPEC, KIOSK.x, KIOSK.z + 3.2), []);
  const video = useVideoTexture(news.breaking ? NEWS_DIR + news.breaking.video : undefined);
  const cover = useImageTexture(NEWS_DIR + news.pages[0].file);
  return (
    <group position={[KIOSK.x, 0, KIOSK.z]} rotation={[0, Math.PI / 8, 0]}>
      {/* base + posts */}
      <mesh geometry={box} material={frameMat} position={[0, 0.15, 0]} scale={[7.5, 0.3, 3]} />
      <mesh geometry={box} material={frameMat} position={[-1.6, 2.4, -0.6]} scale={[0.25, 4.5, 0.25]} />
      <mesh geometry={box} material={frameMat} position={[1.6, 2.4, -0.6]} scale={[0.25, 4.5, 0.25]} />
      {/* breaking-news screen */}
      <mesh geometry={box} material={frameMat} position={[0, 3.3, -0.62]} scale={[3.5, 3.5, 0.12]} />
      <mesh position={[0, 3.3, -0.55]}>
        <planeGeometry args={[3.2, 3.2]} />
        {video ? <meshBasicMaterial key="video" map={video} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#120c2a" />}
      </mesh>
      <mesh position={[0, 5.2, -0.55]}>
        <planeGeometry args={[3.5, 0.32]} />
        <meshBasicMaterial color="#dc2626" toneMapped={false} />
      </mesh>
      {/* the issue's cover on a stand beside the screen */}
      <group position={[2.9, 1.9, 0]} rotation={[-0.15, -0.35, 0]}>
        <mesh geometry={box} material={frameMat} position={[0, 0, -0.05]} scale={[1.9, 2.5, 0.08]} />
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[1.75, 2.33]} />
          {cover ? <meshBasicMaterial key="cover" map={cover} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#1a1238" />}
        </mesh>
      </group>
      <pointLight position={[0, 4, 2]} color="#c084fc" intensity={30} distance={12} />
      <Html position={[0, 5.75, -0.5]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-red-500/70 bg-black/75 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-red-400">
          Astro-News · Breaking
          <div className="text-[9px] font-normal normal-case text-white/70">Press E here to read issue {news.issue}</div>
        </div>
      </Html>
    </group>
  );
}

/** The reader: one page at a time, arrows or ←/→ to turn, Esc to close. */
export function NewsReader({ news }: { news: NewsIndex }) {
  const [page, setPage] = useState(0);
  const n = news.pages.length;
  const go = useMemo(() => (d: number) => setPage((p) => Math.min(n - 1, Math.max(0, p + d))), [n]);

  useEffect(() => {
    document.exitPointerLock?.();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTalk();
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") go(1);
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") go(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go]);

  // Warm the next page so turning is instant.
  useEffect(() => {
    const next = news.pages[page + 1];
    if (next) new Image().src = NEWS_DIR + next.file;
  }, [page, news.pages]);

  const p = news.pages[page];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="flex h-full max-h-full w-full max-w-3xl flex-col">
        <div className="mb-2 flex items-center justify-between gap-2 text-white">
          <div>
            <div className="text-sm font-black uppercase tracking-wider text-fuchsia-300">Astro-News · Issue {news.issue}</div>
            <div className="text-[11px] text-white/60">
              {news.date} · {p.title} · page {page + 1} of {n}
            </div>
          </div>
          <button type="button" onClick={endTalk} className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Close <span className="text-white/50">(Esc)</span>
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NEWS_DIR + p.file} alt={`Astro-News issue ${news.issue}, ${p.title}`} className="mx-auto h-full w-auto max-w-full rounded-lg object-contain shadow-2xl" />
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={page === 0}
            aria-label="Previous page"
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-2xl text-white disabled:opacity-20"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page === n - 1}
            aria-label="Next page"
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-2xl text-white disabled:opacity-20"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
