/**
 * Property market constants. MAINNET, real $CHIMP.
 *
 * v1 is primary-sale only: buy a listed property straight from Astro Corp.
 * The purchase is one transaction (SPL transfer + an ASTRODEED memo) that the
 * server verifies before ownership is recorded - see app/api/market/claim.
 */
export { ASTRO_CORP_WALLET, CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/mint-config";

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export function deedMemo(propertyId: string, wallet: string): string {
  return `ASTRODEED:${propertyId}:${wallet}`;
}

export const ZONES = [
  "The Belt",
  "Astroworld Core",
  "Helios Docks",
  "Lunar Rim",
] as const;

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  mining_claim: "Mining Claim",
  hangar: "Hangar",
  vault: "Vault",
  greenhouse: "Greenhouse",
  dock: "Dock",
};
