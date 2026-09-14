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
import type { Property } from "@/lib/types";

type Phase = "idle" | "confirm" | "paying" | "claiming" | "error";

export function PropertyMarket() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [properties, setProperties] = useState<Property[] | null>(null);
  const [active, setActive] = useState<Property | null>(null);
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

  async function buy(property: Property) {
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
      setActive(null);
      setPhase("idle");
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

  return (
    <div className="flex flex-col gap-8">
      {[...byZone.entries()].map(([zone, list]) =>
        list.length === 0 ? null : (
          <section key={zone}>
            <h2 className="text-lg font-bold">{zone}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const mine = p.ownerWallet === wallet.publicKey?.toBase58();
                const sold = !!p.ownerWallet;
                return (
                  <div key={p.id} className="card flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-xs text-muted">
                          {PROPERTY_TYPE_LABEL[p.type] ?? p.type}
                        </div>
                      </div>
                      <span
                        className={`chip shrink-0 ${
                          mine
                            ? "text-good"
                            : sold
                              ? "text-muted"
                              : "text-accent"
                        }`}
                        style={{
                          borderColor: mine
                            ? "color-mix(in srgb, var(--good) 40%, transparent)"
                            : sold
                              ? undefined
                              : "color-mix(in srgb, var(--accent) 40%, transparent)",
                        }}
                      >
                        {mine ? "Yours" : sold ? "Held" : "Listed"}
                      </span>
                    </div>
                    <div className="mono text-sm font-semibold">
                      {p.priceChimp.toLocaleString()} $CHIMP
                    </div>
                    {!sold && (
                      <button
                        className="btn btn-primary mt-1 text-sm"
                        onClick={() => {
                          setActive(p);
                          setPhase("confirm");
                          setError(null);
                        }}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}

      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 className="text-lg font-bold">{active.name}</h3>
            <p className="mt-1 text-sm text-muted">
              {PROPERTY_TYPE_LABEL[active.type] ?? active.type} · {active.zone}
            </p>

            {phase === "confirm" && (
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
                    onClick={() => buy(active)}
                  >
                    Confirm &amp; sign
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setActive(null)}
                  >
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
                  onClick={() => setActive(null)}
                >
                  Close
                </button>
              </>
            )}
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
