import type { DescribedTxError } from "@/lib/chain/tx-error";

export function TxErrorBanner({ error }: { error: DescribedTxError }) {
  return (
    <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">
      <div className="font-semibold text-bad">{error.title}</div>
      <p className="mt-0.5 text-muted">{error.detail}</p>
    </div>
  );
}
