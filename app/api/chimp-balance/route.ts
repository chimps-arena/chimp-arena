import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { TokenAccountNotFoundError, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PUBLIC_ENV } from "@/lib/env";
import { CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

/**
 * GET ?wallet=<address> -> { raw, uiAmount }
 * On-chain $CHIMP balance for a wallet. Guests / bad addresses return 0.
 * No ATA (never held $CHIMP) also returns 0 - that's the one case getAccount
 * throwing actually means "zero", and is the only one treated that way.
 *
 * A real RPC failure (timeout, rate limit, provider outage) used to be
 * caught by the same generic handler and ALSO reported as a confident "0" -
 * a wallet that genuinely held real $CHIMP would display 0 for however long
 * the RPC was unhappy, with no way to tell "really zero" apart from
 * "couldn't check". Found live: a real wallet verified (via a second,
 * independent RPC) to hold over 1M $CHIMP was showing 0 on-site. Now only
 * TokenAccountNotFoundError (the specific, legitimate "never held this
 * token" case) returns zero; anything else is a real 503, so the UI can
 * show "couldn't load balance" instead of a confidently wrong number.
 */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || wallet.startsWith("guest_")) {
    return NextResponse.json({ raw: "0", uiAmount: 0 });
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }

  try {
    const ata = getAssociatedTokenAddressSync(new PublicKey(CHIMP_MINT), owner);
    const acc = await getAccount(conn, ata);
    return NextResponse.json(
      {
        raw: acc.amount.toString(),
        uiAmount: Number(acc.amount) / 10 ** CHIMP_DECIMALS,
      },
      { headers: { "cache-control": "public, max-age=20" } },
    );
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      return NextResponse.json(
        { raw: "0", uiAmount: 0 },
        { headers: { "cache-control": "public, max-age=20" } },
      );
    }
    console.error("chimp-balance: RPC lookup failed (not a real zero)", wallet, e);
    return NextResponse.json(
      { error: "could not reach the chain right now - try again shortly" },
      { status: 503 },
    );
  }
}
