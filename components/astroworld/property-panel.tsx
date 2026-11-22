"use client";

/**
 * What you see when you walk up to a property and press E: its NFT art, who
 * owns it (or that it's for sale, and the price), what it produces or sells,
 * and a link to the Property Market. Read-only in the game: buying happens
 * on the market page, where the wallet flow lives.
 */

import { useEffect } from "react";
import type { Placement } from "@chimp-arena/shared";
import type { WorldProperty } from "./buildings";
import { ITEMS, PRODUCT_BY_TYPE } from "./items";
import { TOOLS, WEAPON_IDS, WEAPONS } from "./gear";
import { atLot, endTalk, registerInteractable, type NpcSpec } from "./npcs";

/** Property types that are shops: their products are things you'll buy there. */
const SHOPS = new Set(["cantina", "stall", "club", "armory", "box"]);
const MINING = new Set(["mining_claim", "quarry"]);

const typeLabel = (t: string) => t.replace(/_/g, " ");

/** Make every property usable with E from the front of its lot. */
export function registerProperties(props: WorldProperty[], places: Map<string, Placement>): () => void {
  const offs: (() => void)[] = [];
  for (const p of props) {
    const place = places.get(p.id);
    if (!place) continue;
    const [x, z] = atLot(place, [0, 8.5]);
    const spec: NpcSpec = {
      key: `prop:${p.id}`,
      characterId: "",
      role: `${typeLabel(p.type)} · ${p.zone}`,
      title: p.name,
      kind: "property",
      property: p,
      range: 6.5,
      route: { kind: "post", at: [x, z], face: place.ry },
      speed: 0,
      phase: 0,
    };
    offs.push(registerInteractable(spec, x, z));
    if (p.type === "dock") {
      // The ship hovering over the dock: board it from the lot.
      offs.push(
        registerInteractable(
          {
            key: `dock:${p.id}`,
            characterId: "",
            role: `Dock · ${p.name}`,
            title: "the docked ship",
            kind: "port",
            portId: `dock:${p.id}`,
            range: 9,
            route: { kind: "post", at: [place.x, place.z], face: place.ry },
            speed: 0,
            phase: 0,
          },
          place.x,
          place.z,
        ),
      );
    }
  }
  return () => offs.forEach((off) => off());
}

function goods(p: WorldProperty): { heading: string; items: string[] } | null {
  if (p.type === "armory") return { heading: "Weapons for sale (coming soon)", items: WEAPON_IDS.map((id) => `${WEAPONS[id].name} · ${WEAPONS[id].tier}`) };
  const products = PRODUCT_BY_TYPE[p.type];
  const names = products ? [...new Set(products.map((id) => ITEMS[id].name))] : [];
  if (MINING.has(p.type)) names.push(...Object.values(TOOLS).map((t) => `${t.name} (${t.tier.replace("Mining · ", "")})`));
  if (names.length === 0) return null;
  return { heading: SHOPS.has(p.type) ? "On the menu (coming soon)" : "Produces", items: names };
}

export function PropertyPanel({ property: p }: { property: WorldProperty }) {
  useEffect(() => {
    document.exitPointerLock?.();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTalk();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const g = goods(p);
  // Astrocorp landmarks (Astroburger) aren't on the market.
  const landmark = p.id.startsWith("landmark-");
  return (
    <div className="absolute inset-x-0 bottom-16 z-30 flex justify-center px-3">
      <div className="flex w-full max-w-2xl gap-4 rounded-xl border border-amber-400/50 bg-black/85 p-4 text-white shadow-2xl backdrop-blur">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="hidden h-44 w-44 shrink-0 rounded-lg border border-white/15 object-cover sm:block" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{p.name}</div>
              <div className="text-[11px] uppercase tracking-wider text-amber-300">
                {typeLabel(p.type)} · {p.zone}
              </div>
            </div>
            <button type="button" onClick={endTalk} className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
              Close <span className="text-white/50">(Esc)</span>
            </button>
          </div>

          <div className="mt-2 text-sm">
            {landmark ? (
              <span className="text-fuchsia-300">Astrocorp landmark · open to everyone</span>
            ) : p.forSale ? (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">For sale · {p.priceChimp.toLocaleString()} $CHIMP</span>
            ) : (
              <span className="text-amber-200">Owned by {p.ownerHandle}</span>
            )}
          </div>

          {g && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wider text-white/50">{g.heading}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {g.items.map((name) => (
                  <span key={name} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!landmark && (
          <a
            href="/market"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-amber-300"
          >
            {p.forSale ? "Buy it on the Property Market ↗" : "See it on the Property Market ↗"}
          </a>
          )}
        </div>
      </div>
    </div>
  );
}
