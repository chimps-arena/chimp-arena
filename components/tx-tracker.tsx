"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Connection } from "@solana/web3.js";
import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from "lucide-react";
import { chainEndpoint, explorerTx } from "@/lib/chain/connection";

type TxState = "pending" | "confirmed" | "failed";

interface TrackedTx {
  id: string;
  signature: string;
  label: string;
  state: TxState;
}

interface TxTrackerState {
  /** Register a transaction for the floating panel to watch and poll. */
  track: (signature: string, label: string) => void;
}

const Ctx = createContext<TxTrackerState | null>(null);

/**
 * Global "where did my transaction go" panel (roadmap #80). Tracks any
 * signature handed to it via track() regardless of which wallet context
 * sent it, polling confirmation status with its own Connection so this
 * works outside /mint and /market's SolanaProvider too.
 */
export function TxTrackerProvider({ children }: { children: React.ReactNode }) {
  const [txs, setTxs] = useState<TrackedTx[]>([]);
  const connRef = useRef<Connection | null>(null);
  const seq = useRef(0);

  const getConn = useCallback(() => {
    if (!connRef.current) connRef.current = new Connection(chainEndpoint(), "confirmed");
    return connRef.current;
  }, []);

  const track = useCallback(
    (signature: string, label: string) => {
      const id = `${Date.now()}-${seq.current++}`;
      const entry: TrackedTx = { id, signature, label, state: "pending" };
      setTxs((prev) => [entry, ...prev].slice(0, 8));

      const conn = getConn();
      let cancelled = false;
      (async () => {
        try {
          const result = await conn.confirmTransaction(signature, "confirmed");
          if (cancelled) return;
          const finalState: TxState = result.value.err ? "failed" : "confirmed";
          setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, state: finalState } : t)));
        } catch {
          if (!cancelled) {
            const failed: TxState = "failed";
            setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, state: failed } : t)));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    },
    [getConn],
  );

  const dismiss = useCallback((id: string) => {
    setTxs((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<TxTrackerState>(() => ({ track }), [track]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {txs.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
          {txs.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 rounded-xl border p-3 text-sm shadow-lg"
              style={{
                borderColor: "color-mix(in srgb, var(--border) 80%, transparent)",
                background: "color-mix(in srgb, var(--surface) 92%, transparent)",
                backdropFilter: "blur(12px)",
              }}
            >
              <StatusIcon state={t.state} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t.label}</div>
                <div className="text-xs text-muted">
                  {t.state === "pending"
                    ? "Confirming…"
                    : t.state === "confirmed"
                      ? "Confirmed"
                      : "Failed"}
                </div>
              </div>
              <a
                href={explorerTx(t.signature)}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-foreground"
                title="View on Solana Explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-muted hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

function StatusIcon({ state }: { state: TxState }) {
  if (state === "pending") return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-2" />;
  if (state === "confirmed") return <CheckCircle2 className="h-5 w-5 shrink-0 text-good" />;
  return <XCircle className="h-5 w-5 shrink-0 text-bad" />;
}

export function useTxTracker(): TxTrackerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTxTracker must be used inside <TxTrackerProvider>");
  return ctx;
}
