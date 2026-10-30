"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { mplCore, updateV2 } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress } from "@/lib/chain/connection";
import { MINT_DELEGATE } from "@/lib/chain/mint-config";
import { describeTxError } from "@/lib/chain/tx-error";

type RepairState = "in_collection" | "delegate_can_move" | "owner_must_hand_over" | "unknown";
interface RepairItem {
  asset: string;
  kind: "astrochimp" | "property";
  name: string | null;
  state: RepairState;
}
interface Health {
  available: boolean;
  low: boolean;
  balanceSol: number | null;
}

const STATE_LABEL: Record<RepairState, string> = {
  in_collection: "In collection ✓",
  delegate_can_move: "Outside collection - one click to fix",
  owner_must_hand_over: "Outside collection - needs your signature",
  unknown: "Can't inspect - needs a manual look",
};

/**
 * Two parts:
 *  - Mint delegate status: its SOL balance, and whether sales are open
 *    (they close automatically below the operating floor - see
 *    lib/chain/delegate-health.ts).
 *  - Your recorded NFTs and whether each is inside its official collection.
 *    Ones whose update authority is still the delegate are moved by the
 *    server alone. Ones still held under the owner's own authority (the
 *    #54-#63 Astrochimps, minted before the 2026-10-29 fix) need the owner
 *    to sign one hand-over transaction first - it only changes who may
 *    update the NFT to the mint delegate, which then immediately moves it
 *    into the collection. Ownership never changes.
 */
export function NftRepair() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [health, setHealth] = useState<Health | null>(null);
  const [items, setItems] = useState<RepairItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplCore());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  useEffect(() => {
    fetch("/api/mint/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const load = useCallback(async () => {
    if (!walletKey) return;
    const r = await fetch(`/api/nft/repair?wallet=${walletKey}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setItems(d.items ?? []);
  }, [walletKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function fix(item: RepairItem) {
    if (!walletKey) return;
    setBusy(item.asset);
    setMessage(null);
    try {
      if (item.state === "owner_must_hand_over") {
        const bh = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });
        const tx = updateV2(umi, {
          asset: publicKey(item.asset),
          payer: umi.identity,
          authority: umi.identity,
          newUpdateAuthority: { __kind: "Address", fields: [publicKey(MINT_DELEGATE)] },
        })
          .setBlockhash(bh)
          .build(umi);
        const connection = new Connection(chainEndpoint(), "confirmed");
        const signature = await wallet.sendTransaction(toWeb3JsTransaction(tx), connection, { maxRetries: 5 });
        await connection.confirmTransaction(
          { signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
          "confirmed",
        );
      }
      const r = await fetch("/api/nft/repair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: walletKey, asset: item.asset }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "the collection move failed - try again");
      setMessage(`${item.name ?? "NFT"} is now in its collection.`);
    } catch (e) {
      setMessage(describeTxError(e).title);
    } finally {
      setBusy(null);
      void load();
    }
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Mint delegate</span>
          <a href={explorerAddress(MINT_DELEGATE)} target="_blank" rel="noreferrer" className="mono text-xs underline">
            {MINT_DELEGATE.slice(0, 6)}…{MINT_DELEGATE.slice(-6)}
          </a>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Balance</span>
          <span className="font-semibold">{health?.balanceSol == null ? "-" : `${health.balanceSol.toFixed(4)} SOL`}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Sales</span>
          <span className={health?.available ? "text-good" : "text-bad"}>
            {health == null ? "-" : health.available ? "open" : "paused (top up the delegate)"}
          </span>
        </div>
        {health?.available && health.low && (
          <p className="mt-2 rounded-lg border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
            Running low - top it up soon. Sales pause automatically before it can run out.
          </p>
        )}
      </div>

      {!wallet.publicKey ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">Connect the wallet that bought the NFTs.</p>
          <div className="mt-4 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      ) : items == null ? (
        <div className="card h-24 animate-pulse" />
      ) : items.length === 0 ? (
        <p className="card p-4 text-sm text-muted">No NFTs recorded for this wallet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.asset} className="card flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <a href={explorerAddress(item.asset)} target="_blank" rel="noreferrer" className="font-semibold underline">
                  {item.name ?? `${item.asset.slice(0, 8)}…`}
                </a>
                <div className={`text-xs ${item.state === "in_collection" ? "text-good" : "text-muted"}`}>
                  {STATE_LABEL[item.state]}
                </div>
              </div>
              {(item.state === "delegate_can_move" || item.state === "owner_must_hand_over") && (
                <button className="btn btn-primary text-xs" disabled={busy !== null} onClick={() => void fix(item)}>
                  {busy === item.asset ? "Fixing…" : "Fix"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {message && <p className="text-center text-sm text-muted">{message}</p>}
    </div>
  );
}
