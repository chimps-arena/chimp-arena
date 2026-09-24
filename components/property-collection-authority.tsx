"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  addCollectionPlugin,
  approveCollectionPluginAuthority,
  fetchCollection,
} from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import {
  ASTRO_CORP_WALLET,
  MINT_DELEGATE,
  PROPERTIES_COLLECTION,
} from "@/lib/chain/property-mint-config";

type StepPhase = "idle" | "working" | "error";

/**
 * Same two-step, Astro-Corp-only setup as components/collection-authority.tsx
 * (Astrochimps), applied to the Properties collection. Reuses the SAME mint
 * delegate rather than a second one - a delegate can be granted access to
 * multiple collections independently, and one wallet to fund/manage is
 * simpler than two.
 */
export function PropertyCollectionAuthority() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const isAstroCorpWallet = walletKey === ASTRO_CORP_WALLET;

  const [loadingState, setLoadingState] = useState(true);
  const [royaltiesLocked, setRoyaltiesLocked] = useState(false);
  const [delegateGranted, setDelegateGranted] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingState(true);
    setFetchError(null);
    try {
      const collection = await fetchCollection(umi, publicKey(PROPERTIES_COLLECTION));
      setRoyaltiesLocked(collection.royalties?.authority.type === "None");
      setDelegateGranted(
        (collection.updateDelegate?.additionalDelegates ?? []).some(
          (d) => d.toString() === MINT_DELEGATE,
        ),
      );
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Could not load collection state");
    } finally {
      setLoadingState(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const [lockPhase, setLockPhase] = useState<StepPhase>("idle");
  const [lockError, setLockError] = useState<string | null>(null);
  async function lockRoyalties() {
    setLockPhase("working");
    setLockError(null);
    try {
      await approveCollectionPluginAuthority(umi, {
        collection: publicKey(PROPERTIES_COLLECTION),
        plugin: { type: "Royalties" },
        newAuthority: { type: "None" },
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
      setLockPhase("idle");
      await refresh();
    } catch (e) {
      setLockError(e instanceof Error ? e.message : "Could not lock the royalty");
      setLockPhase("error");
    }
  }

  const [delegatePhase, setDelegatePhase] = useState<StepPhase>("idle");
  const [delegateError, setDelegateError] = useState<string | null>(null);
  async function grantDelegate() {
    setDelegatePhase("working");
    setDelegateError(null);
    try {
      await addCollectionPlugin(umi, {
        collection: publicKey(PROPERTIES_COLLECTION),
        plugin: { type: "UpdateDelegate", additionalDelegates: [publicKey(MINT_DELEGATE)] },
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
      setDelegatePhase("idle");
      await refresh();
    } catch (e) {
      setDelegateError(e instanceof Error ? e.message : "Could not grant the delegate");
      setDelegatePhase("error");
    }
  }

  if (!mounted) return <div className="card h-40 animate-pulse p-6" />;

  if (!PROPERTIES_COLLECTION) {
    return (
      <div className="card p-6 text-sm text-muted">
        No collection yet - run /admin/create-property-collection first.
      </div>
    );
  }

  if (!wallet.publicKey) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">
          Connect the Astro Corp wallet — both steps here need to be signed by
          it specifically, since there&apos;s no delegate yet to hand this off
          to.
        </p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!isAstroCorpWallet && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          Connected wallet ({walletKey?.slice(0, 4)}…{walletKey?.slice(-4)})
          isn&apos;t Astro Corp ({ASTRO_CORP_WALLET.slice(0, 4)}…
          {ASTRO_CORP_WALLET.slice(-4)}). Both actions below will fail unless
          Astro Corp is the one connected.
        </p>
      )}
      {SOLANA_CLUSTER !== "mainnet-beta" && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          Not on mainnet — this would act on {SOLANA_CLUSTER}.
        </p>
      )}
      {fetchError && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {fetchError}
        </p>
      )}

      {/* step 1 */}
      <div className="card flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">1. Lock the royalty</h2>
          {loadingState ? (
            <span className="text-xs text-muted">checking…</span>
          ) : royaltiesLocked ? (
            <span className="chip text-good">Locked</span>
          ) : (
            <span className="chip text-muted">Not locked</span>
          )}
        </div>
        <p className="text-sm text-muted">
          Sets the Royalties plugin&apos;s own authority to{" "}
          <span className="mono">None</span> — permanently immutable. After
          this, the 3% to Astro Corp on property resales can never be changed
          by anyone again, including Astro Corp itself. Do this{" "}
          <strong className="text-foreground">before</strong> step 2, so the
          delegate below can never reach it.
        </p>
        {royaltiesLocked ? null : (
          <button
            className="btn btn-primary"
            disabled={!isAstroCorpWallet || lockPhase === "working"}
            onClick={() => void lockRoyalties()}
          >
            {lockPhase === "working" ? "Locking… approve in your wallet" : "Lock royalty forever"}
          </button>
        )}
        {lockError && <p className="text-sm text-bad">{lockError}</p>}
      </div>

      {/* step 2 */}
      <div className="card flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">2. Grant the mint delegate</h2>
          {loadingState ? (
            <span className="text-xs text-muted">checking…</span>
          ) : delegateGranted ? (
            <span className="chip text-good">Granted</span>
          ) : (
            <span className="chip text-muted">Not granted</span>
          )}
        </div>
        <p className="text-sm text-muted">
          Lets the same server-held mint delegate already used for Astrochimps
          add new properties to this collection, so purchases don&apos;t need
          Astro Corp to co-sign every one. With the royalty already locked in
          step 1, it has no path to touch it.
        </p>
        <p className="mono text-xs text-muted">
          Delegate:{" "}
          <a
            href={explorerAddress(MINT_DELEGATE)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {MINT_DELEGATE || "(not generated — run scripts/gen-mint-delegate.mjs)"}
          </a>
        </p>
        {!royaltiesLocked && (
          <p className="text-xs text-muted">Lock the royalty in step 1 first.</p>
        )}
        {delegateGranted ? null : (
          <button
            className="btn btn-primary"
            disabled={!isAstroCorpWallet || !royaltiesLocked || !MINT_DELEGATE || delegatePhase === "working"}
            onClick={() => void grantDelegate()}
          >
            {delegatePhase === "working" ? "Granting… approve in your wallet" : "Grant mint delegate"}
          </button>
        )}
        {delegateError && <p className="text-sm text-bad">{delegateError}</p>}
      </div>

      {royaltiesLocked && delegateGranted && (
        <div className="rounded-xl border border-good/40 bg-good/10 p-4 text-sm text-good">
          Both steps done. Property mints can now join the collection with
          the royalty permanently locked in.
        </div>
      )}
    </div>
  );
}
