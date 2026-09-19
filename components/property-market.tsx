"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ASTRO_CORP_WALLET,
  CHIMP_DECIMALS,
  CHIMP_MINT,
  MEMO_PROGRAM_ID,
  PROPERTY_TYPE_LABEL,
  ZONES,
  deedMemo,
} from "@/lib/chain/market-config";
import { MARKETPLACE, resaleMemo } from "@/lib/game/sinks";
import { PropertyThumb } from "@/components/property-thumb";
import type { Property } from "@/lib/types";

type Phase = "idle" | "confirm" | "paying" | "claiming" | "error";
type ModalKind = "buy" | "resale-buy" | null;

// Math.round guards against float noise (0.03 isn't exact in binary FP).
const FEE_PCT = BigInt(Math.round(MARKETPLACE.feeRate * 100));

function badgeLabel(p: Property, mine: boolean): string {
  if (mine) return "Yours";
  if (p.ownerWallet) return p.resalePrice ? "Resale" : "Owned";
  return p.status === "held" ? "Held" : "Listed";
}

export function PropertyMarket() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [properties, setProperties] = useState<Property[] | null>(null);
  const [active, setActive] = useState<Property | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/market", { cache: "no-store" });
    const data = await res.json();
    setProperties(data.properties ?? []);
  }, []);

  useEffect(() => {
    // load() awaits fetch before setState, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const byZone = useMemo(() => {
    const map = new Map<string, Property[]>();
    for (const zone of ZONES) map.set(zone, []);
    for (const p of properties ?? []) {
      if (!map.has(p.zone)) map.set(p.zone, []);
      map.get(p.zone)!.push(p);
    }
    return map;
  }, [properties]);

  function openBuy(property: Property) {
    setActive(property);
    setModalKind("buy");
    setPhase("confirm");
    setError(null);
  }

  function openResaleBuy(property: Property) {
    setActive(property);
    setModalKind("resale-buy");
    setPhase("confirm");
    setError(null);
  }

  function closeModal() {
    setActive(null);
    setModalKind(null);
    setPhase("idle");
  }

  async function buyPrimary(property: Property) {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    setPhase("paying");
    setError(null);
    try {
      const mint = new PublicKey(CHIMP_MINT);
      const buyerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const astroAta = getAssociatedTokenAddressSync(
        mint,
        new PublicKey(ASTRO_CORP_WALLET),
      );
      const amount =
        BigInt(property.priceChimp) * 10n ** BigInt(CHIMP_DECIMALS);

      const tx = new Transaction().add(
        createTransferInstruction(buyerAta, astroAta, wallet.publicKey, amount),
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(
            deedMemo(property.id, wallet.publicKey.toBase58()),
            "utf8",
          ),
        }),
      );

      const signature = await wallet.sendTransaction(tx, connection);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, ...bh }, "confirmed");

      setPhase("claiming");
      const res = await fetch("/api/market/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          wallet: wallet.publicKey.toBase58(),
          signature,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(
          msg ||
            "Payment sent but the deed wasn't recorded — contact support with the tx signature.",
        );
      }
      closeModal();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
      setPhase("error");
    }
  }

  async function buyResale(property: Property) {
    if (
      !wallet.publicKey ||
      !wallet.sendTransaction ||
      !property.resalePrice ||
      !property.ownerWallet
    )
      return;
    setPhase("paying");
    setError(null);
    try {
      const mint = new PublicKey(CHIMP_MINT);
      const buyerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const sellerAta = getAssociatedTokenAddressSync(
        mint,
        new PublicKey(property.ownerWallet),
      );
      const astroAta = getAssociatedTokenAddressSync(
        mint,
        new PublicKey(ASTRO_CORP_WALLET),
      );
      const total =
        BigInt(property.resalePrice) * 10n ** BigInt(CHIMP_DECIMALS);
      const astroCut = (total * FEE_PCT) / 100n;
      const sellerCut = total - astroCut;

      const tx = new Transaction().add(
        createTransferInstruction(buyerAta, sellerAta, wallet.publicKey, sellerCut),
        createTransferInstruction(buyerAta, astroAta, wallet.publicKey, astroCut),
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(resaleMemo("property", property.id), "utf8"),
        }),
      );

      const signature = await wallet.sendTransaction(tx, connection);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, ...bh }, "confirmed");

      setPhase("claiming");
      const res = await fetch("/api/market/resale/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          wallet: wallet.publicKey.toBase58(),
          signature,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(
          msg ||
            "Payment sent but the deed wasn't recorded — contact support with the tx signature.",
        );
      }
      closeModal();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
      setPhase("error");
    }
  }

  if (!mounted) return <div className="card h-40 animate-pulse p-6" />;

  if (!wallet.publicKey) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">Connect the wallet holding your $CHIMP.</p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (!properties) {
    return <div className="card h-40 animate-pulse p-6" />;
  }

  const myWallet = wallet.publicKey.toBase58();

  return (
    <div className="flex flex-col gap-8">
      {[...byZone.entries()].map(([zone, list]) =>
        list.length === 0 ? null : (
          <section key={zone}>
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl sm:text-2xl">{zone}</h2>
              <span className="mono text-xs text-muted">
                {list.length} plot{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const mine = p.ownerWallet === myWallet;
                const ownedByOther = !!p.ownerWallet && !mine;
                const resaleActive = ownedByOther && !!p.resalePrice;
                const primaryAvailable = !p.ownerWallet && p.status !== "held";
                const label = badgeLabel(p, mine);
                const badgeColor = mine
                  ? "var(--good)"
                  : label === "Resale"
                    ? "var(--accent-2)"
                    : primaryAvailable
                      ? "var(--accent)"
                      : "var(--border)";
                return (
                  <div
                    key={p.id}
                    className="card group flex flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1"
                  >
                    <div className="relative">
                      <PropertyThumb src={p.image} type={p.type} className="h-48 w-full" />
                      <span
                        className="chip absolute right-3 top-3 backdrop-blur-md"
                        style={{
                          background: "rgba(5,6,15,0.55)",
                          color: badgeColor,
                          borderColor: `color-mix(in srgb, ${badgeColor} 45%, transparent)`,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 p-5">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold">
                          {p.name}
                        </div>
                        <div className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                          {PROPERTY_TYPE_LABEL[p.type] ?? p.type}
                        </div>
                        {p.blurb && (
                          <p className="mt-1.5 text-xs text-muted">{p.blurb}</p>
                        )}
                      </div>

                      {(primaryAvailable || resaleActive) && (
                        <div className="flex items-baseline justify-between">
                          <div className="mono text-lg font-semibold text-accent">
                            {(resaleActive ? p.resalePrice! : p.priceChimp).toLocaleString()}{" "}
                            <span className="text-xs font-normal text-muted">
                              $CHIMP
                            </span>
                          </div>
                        </div>
                      )}

                      {primaryAvailable && (
                        <button
                          className="btn btn-primary mt-1 text-sm"
                          onClick={() => openBuy(p)}
                        >
                          Buy
                        </button>
                      )}
                      {resaleActive && (
                        <button
                          className="btn btn-primary mt-1 text-sm"
                          onClick={() => openResaleBuy(p)}
                        >
                          Buy from owner
                        </button>
                      )}
                      {mine && <ResaleControls property={p} onChanged={load} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}

      {active && modalKind && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-sm overflow-hidden p-0">
            <PropertyThumb src={active.image} type={active.type} className="h-40 w-full" />
            <div className="p-6">
              <h3 className="text-lg font-bold">{active.name}</h3>
              <p className="mt-1 text-sm text-muted">
                {PROPERTY_TYPE_LABEL[active.type] ?? active.type} · {active.zone}
              </p>
              {active.blurb && (
                <p className="mt-1 text-sm text-muted">{active.blurb}</p>
              )}

              {phase === "confirm" && modalKind === "buy" && (
                <>
                  <p className="mt-4 text-sm text-muted">
                    <strong className="text-foreground">Mainnet — real tokens.</strong>{" "}
                    You will send {active.priceChimp.toLocaleString()} $CHIMP to
                    Astro Corp and receive the deed to this property. This can’t
                    be undone.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="btn btn-primary flex-1"
                      onClick={() => buyPrimary(active)}
                    >
                      Confirm &amp; sign
                    </button>
                    <button className="btn btn-ghost" onClick={closeModal}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {phase === "confirm" && modalKind === "resale-buy" && active.resalePrice && (
                <>
                  <p className="mt-4 text-sm text-muted">
                    <strong className="text-foreground">Mainnet — real tokens.</strong>{" "}
                    You will send {active.resalePrice.toLocaleString()} $CHIMP —{" "}
                    {(100 - Number(FEE_PCT)).toString()}% to the current owner,{" "}
                    {FEE_PCT.toString()}% to Astro Corp — and receive the deed.
                    This can’t be undone.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="btn btn-primary flex-1"
                      onClick={() => buyResale(active)}
                    >
                      Confirm &amp; sign
                    </button>
                    <button className="btn btn-ghost" onClick={closeModal}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {(phase === "paying" || phase === "claiming") && (
                <button className="btn btn-primary mt-4 w-full" disabled>
                  {phase === "paying"
                    ? "Approve in your wallet…"
                    : "Recording your deed…"}
                </button>
              )}

              {phase === "error" && (
                <>
                  <p className="mt-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
                    {error}
                  </p>
                  <button
                    className="btn btn-ghost mt-3 w-full"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Every purchase is a real on-chain $CHIMP transfer, verified before the
        deed is recorded.
      </p>
    </div>
  );
}

/** Inline list/delist controls shown on a property you own. No payment
 * happens here - it only sets the ask price. Buying is the resale-buy flow
 * above. */
function ResaleControls({
  property,
  onChanged,
}: {
  property: Property;
  onChanged: () => void;
}) {
  const [price, setPrice] = useState(
    property.resalePrice ? String(property.resalePrice) : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(priceChimp: number | null) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/market/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, priceChimp }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Could not update listing");
      }
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (property.resalePrice) {
    return (
      <div className="mt-1 flex flex-col gap-2">
        <div
          className="chip w-fit text-accent-2"
          style={{ borderColor: "color-mix(in srgb, var(--accent-2) 40%, transparent)" }}
        >
          Listed — {property.resalePrice.toLocaleString()} $CHIMP
        </div>
        <button
          className="btn btn-ghost text-sm"
          disabled={busy}
          onClick={() => void submit(null)}
        >
          {busy ? "…" : "Cancel listing"}
        </button>
        {err && <p className="text-xs text-bad">{err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          placeholder="Ask (CHIMP)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          className="btn btn-primary shrink-0 text-sm"
          disabled={busy || !price || Number(price) <= 0}
          onClick={() => void submit(Math.floor(Number(price)))}
        >
          {busy ? "…" : "List"}
        </button>
      </div>
      {err && <p className="text-xs text-bad">{err}</p>}
    </div>
  );
}
