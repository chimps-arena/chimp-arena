import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
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
 * No ATA (never held $CHIMP) also returns 0.
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
  } catch {
    // TokenAccountNotFoundError or RPC hiccup -> treat as zero.
    return NextResponse.json(
      { raw: "0", uiAmount: 0 },
      { headers: { "cache-control": "public, max-age=20" } },
    );
  }
}
