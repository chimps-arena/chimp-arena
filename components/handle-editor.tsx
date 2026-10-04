"use client";

import { useMemo, useState } from "react";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  addMemo,
  fetchToken,
  findAssociatedTokenPda,
  mplToolbox,
  transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { HANDLE_RULES, validateHandle } from "@/lib/game/config";
import {
  ASTRO_CORP_WALLET,
  CHIMP_MINT,
  CHIMP_DECIMALS,
  RENAME_PRICE_BASE,
  renameMemo,
} from "@/lib/chain/mint-config";

/**
 * Inline editor for the player's handle. Free during the trial window;
 * after that, a rename has to be paid for (see PATCH /api/me) - the wallet
 * signs a plain $CHIMP transfer itself here, then we send the resulting
 * signature along with the new handle for the server to verify and apply,
 * same pattern as components/chimp-mint.tsx.
 */
export function HandleEditor({
  current,
  freeUntil,
  nextAvailableAt,
  priceChimp,
  onSaved,
}: {
  current: string;
  freeUntil: string;
  nextAvailableAt: string | null;
  priceChimp: number;
  onSaved: () => void | Promise<void>;
}) {
  const wallet = useWallet();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplToolbox());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const locked = nextAvailableAt ? new Date(nextAvailableAt) > new Date() : false;
  const inTrial = new Date(freeUntil) > new Date();

  async function save() {
    const v = validateHandle(value);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (v.handle === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let signature: string | undefined;

      if (!inTrial) {
        if (!wallet.publicKey) {
          throw new Error(`Your free trial has ended. Connect a wallet to pay ${priceChimp} $CHIMP.`);
        }
        const owner = publicKey(wallet.publicKey.toBase58());
        const mint = publicKey(CHIMP_MINT);
        const buyerAta = findAssociatedTokenPda(umi, { mint, owner });
        const astroAta = findAssociatedTokenPda(umi, { mint, owner: publicKey(ASTRO_CORP_WALLET) });

        let held: bigint;
        try {
          held = (await fetchToken(umi, buyerAta)).amount;
        } catch {
          throw new Error("This wallet holds no $CHIMP.");
        }
        if (held < RENAME_PRICE_BASE) {
          throw new Error(
            `Need ${priceChimp.toLocaleString()} $CHIMP to rename. This wallet has ${(
              Number(held) /
              10 ** CHIMP_DECIMALS
            ).toLocaleString()}.`,
          );
        }

        const tx = await transferTokens(umi, {
          source: buyerAta,
          destination: astroAta,
          authority: umi.identity,
          amount: RENAME_PRICE_BASE,
        })
          .add(addMemo(umi, { memo: renameMemo(owner) }))
          .sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
        signature = bs58.encode(tx.signature);
      }

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: v.handle, signature }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setEditing(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-2">
          <span className="text-2xl font-black">{current}</span>
          {!locked && (
            <button
              type="button"
              onClick={() => {
                setValue(current);
                setError(null);
                setEditing(true);
              }}
              className="text-xs text-muted underline underline-offset-2 hover:text-accent"
            >
              edit
            </button>
          )}
        </span>
        {locked && nextAvailableAt && (
          <span className="text-xs text-muted">
            Renaming again on {new Date(nextAvailableAt).toLocaleDateString()}.
          </span>
        )}
        {!locked && !inTrial && (
          <span className="text-xs text-muted">Renaming costs {priceChimp} $CHIMP.</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      {!inTrial && (
        <span className="text-xs text-muted">
          Your free trial has ended. This rename costs {priceChimp} $CHIMP.
        </span>
      )}
      {!inTrial && !wallet.publicKey && (
        <div className="flex items-center gap-2">
          <WalletMultiButton />
          <span className="text-xs text-muted">Connect the wallet holding your $CHIMP.</span>
        </div>
      )}
      <span className="inline-flex items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={HANDLE_RULES.max}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-48 rounded-md border border-border bg-surface-2 px-2 py-1 text-lg font-bold outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (!inTrial && !wallet.publicKey)}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          {saving ? (inTrial ? "Saving…" : "Paying…") : inTrial ? "Save" : `Pay & save`}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn btn-ghost px-3 py-1 text-xs"
        >
          Cancel
        </button>
      </span>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
