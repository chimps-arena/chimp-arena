/**
 * Central environment access with fail-loud validation.
 *
 * Server-only secrets are read lazily so that importing this module in a
 * client bundle never throws (the getters just aren't called there).
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Copy .env.local.example to .env.local and fill it in (see SETUP.md).`,
    );
  }
  return value;
}

/* ----- Public (inlined into the browser bundle at build time) ----- */

export const PUBLIC_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  solanaCluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as
    | "devnet"
    | "testnet"
    | "mainnet-beta",
  solanaRpc: process.env.NEXT_PUBLIC_SOLANA_RPC ?? "",
  tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "CHIMP",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "CHIMP Arena",
};

export function assertPublicEnv() {
  required("NEXT_PUBLIC_SUPABASE_URL", PUBLIC_ENV.supabaseUrl);
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", PUBLIC_ENV.supabaseAnonKey);
}

/* ----- Server-only secrets ----- */

export function serverEnv() {
  return {
    supabaseUrl: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    serviceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    jwtSecret: required("JWT_SECRET", process.env.JWT_SECRET),
  };
}
