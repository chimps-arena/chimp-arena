/**
 * Server-only. Whether the mint delegate wallet can afford its part of a
 * sale, checked BEFORE a buyer is asked to pay - so a drained delegate
 * means "temporarily unavailable" up front, never "payment went through,
 * minting didn't" after the fact (which is exactly what happened to two
 * land purchases on 2026-10-29).
 *
 * Since buyers now pay their own NFT rent, the delegate's per-sale cost is
 * only the network fee for moving the asset into its collection. What it
 * still has to cover in full is the occasional free milestone bonus
 * Astrochimp (a whole asset's rent), so that sets the floor.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { chainEndpoint } from "@/lib/chain/connection";
import { MINT_DELEGATE } from "@/lib/chain/mint-config";

/** Below this, refuse new sales: ~1 milestone bonus mint plus fees. */
export const DELEGATE_MIN_OPERATING_SOL = 0.005;
/** Below this, still selling, but warn so it gets topped up in time. */
export const DELEGATE_LOW_WARNING_SOL = 0.05;

export interface DelegateHealth {
  /** False also when the balance couldn't be read - never sell blind. */
  available: boolean;
  low: boolean;
  balanceSol: number | null;
}

export async function delegateHealth(): Promise<DelegateHealth> {
  if (!MINT_DELEGATE) return { available: false, low: true, balanceSol: null };
  try {
    const lamports = await new Connection(chainEndpoint(), "confirmed").getBalance(new PublicKey(MINT_DELEGATE));
    const balanceSol = lamports / 1e9;
    const health = {
      available: balanceSol >= DELEGATE_MIN_OPERATING_SOL,
      low: balanceSol < DELEGATE_LOW_WARNING_SOL,
      balanceSol,
    };
    if (health.low) {
      console.warn(
        `mint delegate ${MINT_DELEGATE} is low on SOL: ${balanceSol} (sales stop below ${DELEGATE_MIN_OPERATING_SOL}) - top it up`,
      );
    }
    return health;
  } catch (e) {
    console.error("mint delegate balance check failed", e);
    return { available: false, low: true, balanceSol: null };
  }
}
