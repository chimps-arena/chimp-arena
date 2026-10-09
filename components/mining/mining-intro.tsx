"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { ToolShop } from "@/components/mining/tool-shop";
import { TOOLS } from "@/lib/game/mining";
import type { MiningStatus } from "@/lib/types";

export function MiningIntro({
  status,
  onChange,
}: {
  status: MiningStatus | null;
  onChange: () => void | Promise<void>;
}) {
  const wallet = useWallet();

  if (!status) {
    return <div className="card h-24 animate-pulse" />;
  }

  if (!status.realWallet) {
    return (
      <div className="card p-5 text-center">
        <p className="text-sm text-muted">Mining needs a real wallet, not a guest session.</p>
      </div>
    );
  }

  const tool = TOOLS[status.toolTier] ?? TOOLS[0];

  return (
    <div className="card flex flex-col gap-4 p-5">
      {!wallet.publicKey && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
          }}
        >
          <WalletMultiButton />
          <span className="text-xs text-foreground">
            Being logged in to the site isn&apos;t the same as this - connect
            your wallet here too to pay for permits or tools.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted">Current tool</div>
          <div className="text-lg font-bold">{tool.name}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Permits ready</div>
          <div className="text-lg font-bold">
            {status.permits.unstarted}
            {status.permits.resumable ? " · run in progress" : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Today</div>
          <div className="text-lg font-bold">
            {status.permits.startedToday} / {status.permits.dailyCap}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Permit price</div>
          <div className="text-lg font-bold">{status.permitPriceChimp} $CHIMP</div>
        </div>
      </div>
      <ToolShop currentTier={status.toolTier} onUpgraded={onChange} />
    </div>
  );
}
