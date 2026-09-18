# CHIMP Arena — build roadmap

Full path from the current MVP to a live on-chain economy. See
[ECONOMY.md](ECONOMY.md) for the design rationale.

**81 items** (6 dropped when #68 locked to wallet-only).
Done: 33 · Decisions locked: 8 of 9 (only #76 open, deferred to P6) · Build remaining: ~37.
Repo: github.com/chimps-arena/chimp-arena

Status key: ☐ todo · ◐ in progress · ☑ done · ⊘ blocked (needs external action)

---

## A. Foundation & unblock — 6

| # | Item | Status |
| --- | --- | --- |
| 1 | Create the Supabase project | ☑ project `kisegtuyqddqhdmxhwuy`, new-format API keys |
| 2 | Run DB setup — [`supabase/setup.sql`](supabase/setup.sql) (one-shot: schema + both migrations) | ☑ `verify:db` all green |
| 3 | Fill the 3 Supabase keys in `.env.local`, then `npm run verify:db` | ☑ publishable + secret keys in `.env.local` |
| 4 | `git init` + first commit | ☑ Git 2.55 installed, repo on `main`, `.gitattributes` (LF), secrets excluded |
| 5 | Fix the 3 `react-hooks/set-state-in-effect` lint errors | ☑ |
| 6 | End-to-end smoke test: connect → play → XP → leaderboard | ◐ server + `/api/leaderboard` verified vs live DB; wallet/play flow needs manual run |

> Prep done: [`supabase/setup.sql`](supabase/setup.sql) (paste once), [`scripts/verify-supabase.mjs`](scripts/verify-supabase.mjs) via `npm run verify:db` (checks every table/view/function). The moment keys land in `.env.local`, `verify:db` confirms #2 + #7 + #8 in one shot.

## B. Pre-token hardening — 4

| # | Item | Status |
| --- | --- | --- |
| 7 | `add_player_xp()` atomic Postgres function (replaces read-modify-write) | ☑ [0001](supabase/migrations/0001_atomic_xp.sql) + submit route; verified vs live DB |
| 8 | `weekly_scores` snapshot table + aggregation logic | ☑ [0002](supabase/migrations/0002_weekly_scores.sql); verified vs live DB |
| 9 | Tighten mission anti-cheat beyond the heuristic bounds | ☑ elapsed caps on runner/dodge, 100ms reaction floor, 0–900s stale-token guard, 15m start token |
| 10 | Handle-editing UI (currently auto `chimp_<first4><last4>`) | ☑ `PATCH /api/me` + inline `HandleEditor` on dashboard, case-insensitive uniqueness |

## C. Decisions to lock — 7

| # | Decision | Locked |
| --- | --- | --- |
| 11 | Off-chain yield/tax **vs** custom Anchor program | ☑ **Off-chain in Supabase** at launch; Anchor program is a later upgrade |
| 12 | Fee-payer relay **vs** users bring their own SOL | ☑ **Fee-payer relay** (treasury pays gas) |
| 13 | Multi-wallet via wallet-adapter **vs** Phantom-only | ☑ **Multi-wallet** (`@solana/wallet-adapter-react`) |
| 14 | Unclaimed rewards: 8-week clawback **vs** stack forever | ☑ **8-week window**, then clawback to treasury |
| 15 | `$CHIMP` mint + treasury authority in a Squads multisig from day one | ☑ **Squads from day one** |
| 16 | Retroactive XP→CHIMP at P2 **vs** "Season 1 starts now" | ☑ **Season 1 starts now** — no back-pay (optional founder grant) |
| 17 | Marketplace: integrate Tensor/ME **vs** build escrow | ☑ **Build a minimal in-app escrow** — custom program, needs audit (Group K) |
| 68 | Auth model | ☑ **Wallet-only** — no email/embedded wallet; Group M collapsed |
| 76 | Fiat on-ramp **vs** earn-only | ☐ (P6 — deferred) |

## D. Economic modeling — 4

| # | Item | Status |
| --- | --- | --- |
| 18 | Emission-vs-sinks spreadsheet model | ☐ owner — validate before mainnet |
| 19 | Fixed weekly pool size + emission curve | ☑ approved; `weeklyPool()` + `ALLOCATION` in `economy.ts` |
| 20 | All sink parameters (mint prices, tax %, upgrade costs, claim fee, burn %) | ☑ approved; `lib/game/sinks.ts` |
| 21 | Anti-sybil parameters (per-wallet cap, min activity, wallet-age, crew vouch) | ☑ approved; constants in `economy.ts` (enforcement wiring is part of #34) |

## E. P1 — CHIMP appears (read-only UI) — 3

| # | Item | Status |
| --- | --- | --- |
| 22 | Reframe the XP bar → "This week: N CHIMP pending" | ☑ dashboard "This week" stat + projected `$CHIMP`; `/api/me` returns `week` from `weekly_xp_live` |
| 23 | `$CHIMP` balance chip in `nav-bar.tsx` | ☑ `0 CHIMP` chip (real balance lands at P2/G) |
| 24 | Onboarding copy: "XP = rank, CHIMP = earn & spend" | ☑ line under the XP bar |

## F. Wallet integration refactor — 6

| # | Item | Status |
| --- | --- | --- |
| 25 | Add `@solana/wallet-adapter-react`, migrate off `window.phantom` | ☑ `SolanaProvider` (Connection + Wallet + Modal), `lib/phantom.ts` deleted |
| 26 | Keep sign-in-with-signature, sourced from the adapter | ☑ `wallet-connect.tsx` uses `useWallet().signMessage`; modal picks any Wallet-Standard wallet |
| 27 | Shared helper: server builds unsigned tx → client signs once → confirm | ☑ `lib/chain/tx.ts` `signAndSend()` + `lib/chain/connection.ts` |
| 28 | Fee-payer relay (server as fee payer + co-signer) | ◐ deferred to Group G — needs the treasury keypair from Squads (#32) |
| 29 | Devnet SOL faucet button (stopgap) | ☑ `DevnetFaucet` on the dashboard (devnet only) |
| 30 | Tx simulation, blockhash rebuild-retry, session-wallet == JWT-wallet check | ☑ sim + retry in `signAndSend`; `WalletSessionGuard` banner on mismatch |

## G. P2 — CHIMP as a spend-only currency — 5

> Reworked per [TOKEN-POLICY.md](TOKEN-POLICY.md): v1 is **spend-only**. No
> weekly claim, no emission, no distributor. CHIMP is bought (swap) and spent.

| # | Item | Status |
| --- | --- | --- |
| 31 | Deploy `$CHIMP` SPL mint (devnet, 6 decimals, no freeze authority), full supply pre-minted to treasury | ☐ authority resolved (#32) — mint itself not yet deployed |
| 32 | Mint + treasury authority | ☑ devnet keypair generated ([scripts/gen-mint-authority.mjs](scripts/gen-mint-authority.mjs)), secret in `.env.local` (`CHIMP_MINT_AUTHORITY_SECRET`). Public address: `FDQGkgAyRHqidTGCfegoApyTw5s4TcvBqZfYDMRzri9s`. **Move to a Squads vault before mainnet.** |
| 33 | `lib/chain/` — mint address, Helius connection, token balance reads | ◐ `connection.ts` done (Group F); `tx.ts` removed with the wallet-adapter revert, rebuild when the mint/claim tx needs it; mint address pending #31 |
| 34 | In-app **swap widget** — Jupiter SOL/USDC → `$CHIMP`, slippage/impact UI, balance refresh | ☐ |
| 35 | Real `$CHIMP` balance in nav chip + a wallet/inventory view | ☐ |
| 35b | Basic NFT mint test — pay 1,000 `$CHIMP` → NFT to buyer, 1,000 `$CHIMP` → Astro Corp wallet (founder request) | ☐ needs: #31 (mint deployed), Astro Corp wallet address, placeholder art ok |

### G-parked — future rewards season (do not build)
Migration [0003](supabase/migrations/0003_weekly_rewards.sql), `POST /api/rewards/freeze`,
`GET /api/rewards/proof`, `weeklyPool()`/`allocationFor()` in `economy.ts`,
`daily_bonuses` → `weekly_xp_live` fold-in — all retained, inert, gated on a
sink-discipline review + founder sign-off.

## H. P3 — Chimp NFT — 4

| # | Item | Status |
| --- | --- | --- |
| 38 | Configure Core Candy Machine + guards (`tokenPayment`, `mintLimit`, `startDate`) | ☐ |
| 39 | `app/chimps/` mint page | ☐ |
| 40 | `app/api/chimps/mint/` — build batched tx | ☐ |
| 41 | Chimp-ownership gate helper in `lib/game/config.ts` + cosmetic unlocks | ☐ |

## I. P4 — Land / map — 6

| # | Item | Status |
| --- | --- | --- |
| 42 | Create Bubblegum merkle tree, server as tree delegate | ☐ |
| 43 | Map UI (`app/map/`) | ☐ |
| 44 | `app/api/land/buy` — unsold check + transfer+mint tx + co-sign | ☐ |
| 45 | Supabase parcel registry + attribute model (richness, hazard, adjacency, tier) | ☐ |
| 46 | Helius DAS indexer / webhook → ownership reconcile | ☐ |
| 47 | Property tax: first month free, then a standalone pay-tax tx (no weekly claim in v1) | ☐ |

## J. P5 — Structures & yield — 5

| # | Item | Status |
| --- | --- | --- |
| 48 | Structure config (types, costs, yield rates) in `lib/game/` | ☐ |
| 49 | Structure place/upgrade UI (`app/map/[deed]/`) | ☐ |
| 50 | Off-chain per-epoch yield accrual | ☐ |
| 51 | *(parked with rewards season)* fold rewards + yield + tax into one weekly tx | ☐ parked |
| 52 | Yield cap + tax-delinquent parcel reclaim | ☐ |

## K. P6 — Open economy + mainnet — 11

| # | Item | Status |
| --- | --- | --- |
| 53 | Minimal in-app escrow marketplace program (custom, per decision #17) + audit | ☐ |
| 54 | `$CHIMP` liquidity pool (Raydium / Orca) + protocol-owned-liquidity policy (ECONOMY.md §11b) | ☐ |
| 55 | Crew treasury feature | ☐ |
| 56 | Territory + treasury leaderboard boards | ☐ |
| 57 | *(if decentralizing)* `chimp-territory` Anchor program, ~7 instructions | ☐ |
| 58 | Security audit | ☐ |
| 59 | Migrate mint devnet → mainnet | ☐ |
| 60 | Seed liquidity | ☐ |
| 61 | Tokenomics lock / vesting schedule | ☐ |
| 62 | Legal counsel review before mainnet | ☐ |
| 63 | `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` + Vercel deploy | ☐ |

## L. Docs — 4

| # | Item | Status |
| --- | --- | --- |
| 64 | `ECONOMY.md` | ☑ |
| 65 | `ROADMAP.md` | ☑ |
| 66 | Update `ARCHITECTURE.md` with the on-chain layer | ☐ |
| 67 | Update `SETUP.md` with wallet-adapter / Helius / Squads setup | ☐ |

## M. Account & wallet onboarding — 1 (collapsed)

> #68 locked = **wallet-only**. #69–72, #74–75 (embedded-wallet provider) are
> dropped. Only the settings polish remains.

| # | Item | Status |
| --- | --- | --- |
| 73 | Account settings: connected wallet, disconnect, (later) handle already covered by #10 | ☐ |

## N. Swap & on-ramp — 1 decision + 3

| # | Item | Status |
| --- | --- | --- |
| 76 | **Decide:** ship a fiat on-ramp (MoonPay / Transak / Coinbase) or earn-only | ☐ decision |
| 77 | Jupiter swap integration — in-app `$CHIMP` ⇄ SOL / USDC | ☐ |
| 78 | Slippage + price-impact UI with warnings | ☐ |
| 79 | Post-swap / post-tx balance refresh across the app | ☐ |

## O. Web3 UX hardening — 8

| # | Item | Status |
| --- | --- | --- |
| 80 | Global transaction tracker UI (pending / confirmed / failed + explorer links) | ☐ |
| 81 | Error taxonomy: rejected, expired blockhash, insufficient SOL / CHIMP, RPC down, slippage | ☐ |
| 82 | Wrong-network / cluster-mismatch guard | ☐ |
| 83 | Associated Token Account creation — bundled into the tx, rent paid by relay | ☐ |
| 84 | Wallet listeners: account-change, disconnect, reconnect | ☐ |
| 85 | Mobile: Mobile Wallet Adapter + Phantom deeplink | ☐ |
| 86 | Portfolio page: `$CHIMP`, Chimps, land, pending claim, accrued yield | ☐ |
| 87 | Session-expiry → silent re-auth prompt | ☐ |
| 88 | Add Solflare + Backpack adapters explicitly, re-test the picker (Wallet Standard covers them today only if installed) — pre-mainnet | ☐ |

---

## Critical path

1. **Unblock (A):** Supabase project + keys, git, smoke test. *Blocks everything.*
2. **First milestone — CHIMP in a wallet:** A → B7–8 → E → F25–27 → all of G.
3. **First sink:** H.
4. **Land:** I → J.
5. **Open economy + mainnet:** K, plus M / N / O for a seamless end-to-end UX.

## What's needed from the project owner right now

- Create the Supabase project and paste the 3 keys into `.env.local` (#1–3).
- Install Git (#4).
- Lock decisions #11–#17 (recommendations in the table above).
- Answer #68 and #76 before Group F / M / N.

---

## Founder roadmap crosswalk

The founders' public 4-phase roadmap, mapped to the groups above.

| Founder phase | = groups here | Notes / discrepancies to resolve |
| --- | --- | --- |
| **P1 · Token Launch** — "$CHIMP live on Solana, Raydium liquidity, community forms" (shown **COMPLETE**) | Group G (mint + swap) + #54 (Raydium pool) | **RESOLVED (2026-09-15):** a mainnet `$CHIMP` mint already exists — `21ZDgkJ9ULqLoGyHMskAfwVwrx6oixWzxxENu59HHoBV`, 1B fixed supply, 9 decimals, mint + freeze authority both revoked. The app integrates it (not devnet, not something we deploy). No Raydium pool yet — that part of "complete" is still aspirational. |
| **P2 · NFT Characters** — "Astrochimp NFTs: tradable, upgradeable, on-chain stats" (**IN PROGRESS**) | Group H (Chimp NFT) + parts of J (upgradeable / stats) | Test mint shipped (`/mint`, Metaplex Core, pays Astro Corp). "Upgradeable + on-chain stats" is more than the identity NFT — still needs scoping. |
| **P3 · Astroworld** — "social hub, player interaction, on-chain trading" | Group K #53 (in-app marketplace) + **new: social layer** (profiles, chat, presence) | **In progress, ahead of schedule.** The property market shipped early (`/market`) — 36 listings, real photos, on-chain `$CHIMP` payment + ASTRODEED memo, server-verified claim. Social layer (chat/presence) still unscoped. |
| **P4 · Full Game Universe** — "galactic exploration, Gold, Raids, Territory defence" | Groups I + J (land, structures, asteroid claim battles) + **new: PvE/PvP combat** | **"Gold" RESOLVED (2026-09-18):** a non-token off-chain resource (`players.gold`), earned per mission run, spent later on boosts — never redeemable to `$CHIMP`. Shipped alongside the rank ladder (Cadet→Governor, `lib/game/ranks.ts`). Raids / territory defence still unscoped. |

### Open questions for the founders
1. ~~Does a mainnet `$CHIMP` token already exist?~~ **Resolved** — yes, see above.
2. ~~"Gold" — second currency or in-game resource?~~ **Resolved** — non-token resource, shipped.
3. Confirm scope for **Astroworld** (social features) and **Raids / Territory defence** (combat) — these are new groups, currently unscoped.

### Phase A status (station hub / Gold / rank ladder / Safu Bank)
Shipped: Gold resource + award pipeline, rank ladder wired to real level + property-ownership data, property market (a founder-driven addition that landed ahead of the station-hub UI). Still open: a proper station-hub navigation shell (The Deck / Safu Bank / Outfitters as distinct destinations, not just dashboard cards), and a dedicated Safu Bank page showing `$CHIMP` + Gold together with any transaction history.

---

## Track V — Voxel World (Minecraft-like), Option A

> **DECIDED (2026-09-14): Option A** — a first-party, in-browser voxel game
> (not a modded Minecraft server). This is its own long-horizon track with
> its own resourcing and timeline. **It does not block or draw from Phase A**
> or any group above; nothing here starts until Phase A ships and this is
> separately staffed.

**Why Option A:** stays a first-party web app under full control, integrates
natively with the wallet/economy already built. Trade-off accepted: a
from-scratch clone will be judged against 15 years of Minecraft polish, so it
needs its own honest timeline rather than riding the current sprint cadence.

**What it actually requires:** a different rendering stack (React Three
Fiber fits the existing Next.js app; the hard part is a chunked greedy-mesher
for performant voxel rendering in a browser), a terrain/chunk-streaming
system, a block/crafting content pipeline, and — the real bottleneck — a
specialist with genuine WebGL/Three.js performance experience. This is not
general web dev work; treat it as a separate hire or contractor engagement.

**Staged plan:**
1. **Technical spike (1–2 weeks, before any further commitment).** Prove
   browser voxel rendering performance in isolation: a small React Three
   Fiber prototype, a handful of chunks, greedy meshing, frame-rate on a
   mid-range phone. This is the de-risking step — if it can't hold a solid
   frame rate on mobile here, the whole track needs rethinking before more
   is spent on it.
2. **Diorama MVP.** A small, bounded per-plot build space (e.g. a 16×16×16
   block cube), not an open explorable world. Ties into an owned parcel from
   the property market (Track P, once that exists). This is the realistic
   "Minecraft-like" entry point.
3. **Persistent, explorable, shared world.** Sandbox/Decentraland scale —
   a different company phase, revisit only once the diorama MVP has proven
   the loop is fun and there's traction/funding to justify dedicated
   engineering investment.

**Gate before step 1 starts:** Phase A shipped, and a named person (hire or
contractor) with WebGL/voxel experience is engaged. Until then this stays
documented intent, not a task in progress.
