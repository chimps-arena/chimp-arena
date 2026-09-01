# CHIMP Arena — token economy

Status: **v1 model locked — see [TOKEN-POLICY.md](TOKEN-POLICY.md).** That file
is the authority; this one details mechanics within it. The shipped app
([ARCHITECTURE.md](ARCHITECTURE.md)) has none of the on-chain layer yet.

> **v1 is spend-only.** Players acquire `$CHIMP` by swapping SOL/USDC and spend
> it on Chimps / land / items. **There is no play-to-earn in v1.** Every section
> below about a *weekly claim*, *emission curve* or *reward pool* (§3, parts of
> §6–8, §13's curve) is **PARKED** for a possible future rewards season — kept
> for reference, not built.

---

## 1. Core model — one token, spend-only

| Thing | What it is | Transferable? |
| --- | --- | --- |
| **XP** | All-time rank / progression. Drives levels, crews, leaderboards, streaks. The anti-cheat boundary. **Does not convert to anything.** | **No.** Never leaves the database. |
| **`$CHIMP`** | The only token. A **spend-only utility currency** — acquired by swapping SOL/USDC, spent on NFTs, land, items, marketplace fees. | Yes — SPL token in the player's wallet. |

There is **no second token**. Asteroids are a premium *land tier*, not a currency.

`$CHIMP` is **never minted for players.** The full supply is pre-minted and
allocated (see §13 / TOKEN-POLICY.md). Players get `$CHIMP` only by buying it.
This removes emission risk entirely: sinks can't be outrun by a faucet that
doesn't exist.

---

## 2. `$CHIMP` mint parameters

- **Classic SPL Token** (not Token-2022) — widest DEX / marketplace / wallet
  compatibility. Fees are taken at the application layer, not via a transfer-fee
  extension.
- **Decimals:** 6 (USDC convention).
- **Freeze authority:** `null` — the protocol must never be able to freeze holder
  balances.
- **Mint + treasury authority:** a **Squads multisig** from day one. Emission
  happens by funding the distributor vault, never by minting per claim.

---

## 3. Acquiring `$CHIMP` (v1)

Players buy `$CHIMP` with an **in-app swap** (Jupiter): SOL or USDC → `$CHIMP`,
with slippage / price-impact warnings and a post-swap balance refresh. A link
out to a DEX is the fallback. No claim, no faucet.

Depth for that swap comes from the pool — see §"Liquidity". Because the pool is
the on-ramp, its depth is a launch-blocking concern, not a nice-to-have.

---

## 3b. PARKED — the weekly claim (future rewards season only)

> Not built in v1. Retained so a future season doesn't start from a blank page.

Everything economic would converge here. Once a week the player opens one screen
and signs **one transaction**:

```
Claim 340 CHIMP   (120 play rewards + 220 land yield)
Pay    12 CHIMP   property tax on 3 parcels        [x]
─────────────────
Net   +328 CHIMP                          [ Sign ]
```

### Play rewards
1. Server freezes the week's `weekly_scores` (per-wallet XP earned that week).
2. Splits a **fixed weekly `$CHIMP` pool** pro-rata by that XP.
3. Builds a Merkle tree, publishes the root, funds the distributor vault from
   treasury, exposes `GET /api/rewards/proof?wallet=`.
4. Player calls `claim(index, amount, proof)` on the **Jito merkle-distributor**
   (off-the-shelf, audited). A claim-status PDA prevents double claims.

Unclaimed allocations stay claimable for **8 weeks**, then `clawback` to treasury.

### Land yield + property tax
Computed off-chain per epoch (see §6), settled **in the same claim transaction**
via an extra transfer instruction. Address Lookup Table if the tx exceeds size
limits; hard cap of 2 transactions.

---

## 4. Asset layers (Solana NFTs, non-custodial)

| Asset | Standard | Role |
| --- | --- | --- |
| **Chimp** | Metaplex Core | Identity NFT. **You must hold one to own land.** Priced in `$CHIMP`. Supply-capped tiers. Unlocks a custom leaderboard avatar + cosmetic flair. |
| **Land deed** — planet parcel or asteroid claim | Compressed NFT (Bubblegum) | On-chain proof of a map tile. Carries attributes: richness, hazard, adjacency bonus, tier. |
| **Structure** — mining rig, habitat, refinery, turret | Off-chain state (P5), on-chain program state later | Placed on a deed; produces yield per epoch. |

### Asteroids
Named procedurally (`ASTER-4471`), each subdivided into a few claim slots.
Rarer and richer than planet parcels — higher `$CHIMP` yield, higher tax, and
exposure to crew claim battles.

---

## 5. Sale mechanics

- **Chimp:** Metaplex **Core Candy Machine** with `tokenPayment` (pay in
  `$CHIMP`), `mintLimit` (per-wallet cap), and `startDate` guards. Zero custom
  code.
- **Land deed:** server holds tree-delegate authority on the Bubblegum tree.
  `POST /api/land/buy { x, y }` checks the Supabase registry that the parcel is
  unsold, builds `[ transfer $CHIMP buyer→treasury, bubblegum mint ]`, partially
  signs, returns it. Player signs once. A Helius DAS webhook confirms and flips
  the registry row. Double-sell is blocked by a server-side row lock plus the
  indexer being source of truth.

---

## 6. Yield & property tax (off-chain at launch)

Kept in Supabase as game state — consistent with XP and anti-cheat already being
server-trusted. The cNFT deed is the real on-chain ownership; yield is just added
to the weekly claimable amount.

- **Yield per epoch** = `f(structures, structure levels, parcel richness, tier)`,
  paid from a vault the treasury tops up on schedule (same discipline as the
  reward pool — the program never mints).
- **Property tax per epoch** = `g(parcel count, tier)`. First month tax-free.
  Surfaced as a checkbox inside the weekly claim, not a separate chore.
- **Yield cap:** unclaimed yield stops accruing past N epochs (anti-idle-bot).
- **Reclaim:** if tax is delinquent past a threshold, the deed returns to the
  treasury tree (permissionless trigger).

A custom `chimp-territory` Anchor program (~7 instructions) replaces this with a
trustless version — **P6+ only**, gated on an audit.

---

## 7. Economic sustainability

**v1: net-spend-positive by construction.** There is no faucet, so no
emission-vs-sink balancing problem. Every `$CHIMP` a player holds was bought;
every sink (mint fees, land, structures, tax, marketplace fee) removes it from
their wallet toward treasury / burn. The health metric is simply *treasury and
burn accrual over time*.

**Revenue** (funds the project — TOKEN-POLICY.md):
- **Primary sales** — Chimp mints, land, asteroid slots, structures. Main early
  revenue.
- **3% in-app secondary-trade fee** → 2% Astro Corp · 0.5% burn · 0.5% crew.
- Nothing from selling emitted tokens.

The parked reward-season model (§3b) *would* reintroduce a faucet, and *then* a
spreadsheet model (players × daily emission vs. sinks) is a hard gate before it
ships. Not before.

---

## 8. Anti-sybil

- Fixed reward pool → botting dilutes the botter.
- Per-wallet weekly claim cap.
- Minimum weekly activity threshold before an allocation is generated.
- Wallet-age check before first claim.
- Capital barriers: Chimp NFT cost, property tax, per-Chimp land cap.
- Crew vouching as a light proof-of-human.

---

## 9. On-chain surface — custom vs off-the-shelf

| Capability | Mechanism | Custom code |
| --- | --- | --- |
| `$CHIMP` token | Classic SPL Token | none |
| Weekly claim | Jito `merkle-distributor` | none |
| Chimp sale | Core Candy Machine + guards | none |
| Land deeds | Bubblegum + server-authorized mint | none |
| Yield + tax | Off-chain (Supabase) | none |
| Trustless yield/tax/structures | `chimp-territory` Anchor program, ~7 ix | **1 program — P6+** |

**Launch has zero custom on-chain programs.** One program to audit, later, only
if decentralization is worth it.

Program upgrade authority (when the Anchor program exists): dev keypair during
development → Squads multisig → timelock/immutable before mainnet.

---

## 10. Auth & wallet model

> **LOCKED (#68): wallet-only.** Connecting a wallet + signing a message *is*
> the account — no email, no signup step, no embedded-wallet provider. Multiple
> wallets are supported via `@solana/wallet-adapter-react` (#13): Phantom,
> Solflare, Backpack and any Wallet Standard wallet, auto-detected.

The transaction pattern is uniform:

```
client → POST /api/<action>        server builds unsigned VersionedTransaction,
                                    fee payer set, server instructions + partial
                                    signature attached, tx simulated
client → wallet.signTransaction     one prompt
client → sendRawTransaction → confirm
indexer → reconciles Supabase from the confirmed tx
```

- **Fee-payer relay:** the treasury is the fee payer and co-signer; users never
  need SOL. Devnet faucet button as the stopgap.
- **RPC:** Helius (its DAS API is required to read compressed land NFTs anyway).
- Server re-checks on every submit: wallet in the tx == wallet in the session.
- The server's co-signing key is a **low-privilege minter** (can mint cNFTs into
  the tree; cannot mint `$CHIMP`), stored route-handler-only like
  `SUPABASE_SERVICE_ROLE_KEY`.

---

## 11. Swap & on-ramp

- **Swap:** Jupiter integration for in-app `$CHIMP` ⇄ SOL / USDC, with
  slippage / price-impact warnings. This is the **primary way players get
  `$CHIMP`** in v1, not a convenience.
- **Marketplace (#17): build a minimal in-app escrow program** for secondary
  trading of Chimps / land / structures. The in-app market **must be the best
  venue** or the 3% fee earns nothing — back it with Metaplex Core enforced
  royalties and the deepest liquidity for Chimps / land. Custom Anchor program,
  needs an audit (roadmap #53).
- **Fiat on-ramp (OPEN — TOKEN-POLICY.md):** MoonPay / Transak, or SOL-only.
  Not required before mainnet.

---

## 11b. Liquidity policy

The pool is the on-ramp for `$CHIMP`, so its depth is central.

- **Initial seed:** 10% of supply (100M `$CHIMP`) + paired SOL/USDC. This is a
  **floor, not a cap.**
- **Protocol-owned liquidity:** a slice of primary-sale revenue (SOL/USDC from
  Chimp mints, land, asteroid slots) plus treasury `$CHIMP` is added to the pool
  as **permanently locked LP**. Liquidity deepens as the game earns and can't be
  pulled.
- **Depth target:** treasury tops up toward **pool depth ≥ 15% of circulating
  supply** at all times (`TARGET_POOL_DEPTH_OF_CIRCULATING` in `economy.ts`).
- **Unlock sequencing:** founder vest, treasury LP adds, community and
  partnership distributions are scheduled so no single month floods circulating
  supply. No cliff stacking. Every bucket publishes its schedule before TGE.

---

## 12. Risk / legal

- **`$CHIMP` is a spend-only utility currency, not an investment.** All public
  copy says so — no yield language, no "number go up". This is the single
  biggest reduction in regulatory and reputational surface vs. a P2E model.
- A company (Astro Corp) taking a cut of user-to-user trades has
  money-transmission implications in some jurisdictions — on the counsel list.
- Stay on **devnet with no fiat on-ramp** through the build phase.
- Frame any future land yield as an in-game resource, never a return or dividend.
- Legal counsel review is a hard gate before mainnet (roadmap #62).
- cNFT "land" that costs money is still the riskiest asset — it ships last and
  stays optional. Any *yield* on it is parked with the reward season.
- **Model stability is itself a risk.** The v1 model is locked in
  TOKEN-POLICY.md and does not reopen without a dated founder sign-off.

---

## 13. Parameters — Season 1 (APPROVED 2026-08-30)

> Roadmap Group D (#19–21). Live in code: `lib/game/economy.ts` (supply,
> emission curve, anti-sybil) + `lib/game/sinks.ts` (mint / land / structure
> / marketplace costs). All tunable — devnet values.
> **Still open: #18** — an emission-vs-sinks spreadsheet to confirm the weekly
> faucet ≤ weekly sink capacity before mainnet.

### Supply & allocation (founder plan, 2026-09-01 — TOKEN-POLICY.md)

`$CHIMP` fixed max supply: **1,000,000,000** (1e9, 6 decimals). Full supply
pre-minted; no player emission in v1.

| Bucket | Share | Amount | Terms |
| --- | --- | --- | --- |
| Founders / team | 20% | 200,000,000 | 12-mo cliff, 36-mo linear vest |
| Treasury | 25% | 250,000,000 | ops + progressive POL; published schedule |
| Ecosystem rewards | 20% | 200,000,000 | **PARKED** — no job under spend-only; founder decision pending |
| Community & partnerships | 15% | 150,000,000 | scheduled distribution |
| Liquidity | 10% | 100,000,000 | initial seed; LP locked; POL (§11b) |
| Corporation reserve / operations | 10% | 100,000,000 | legal, dev, marketing, infrastructure |

### PARKED — weekly reward pool + emission curve

> Future rewards season only. Not built in v1. Sized to a 150M budget; if the
> parked 200M "Ecosystem rewards" bucket funds a season, the curve is re-sized
> then.

Geometric taper, halving-ish every 13 weeks:

| Weeks | Weekly pool |
| --- | --- |
| 1–13 | 5,300,000 `$CHIMP` |
| 14–26 | 3,180,000 |
| 27–39 | 1,900,000 |
| 40–52 | 1,150,000 |

Each week's pool is split **pro-rata by XP earned that week** (`weekly_scores`).
`lib/game/economy.ts::WEEKLY_CHIMP_POOL` currently hard-codes `250_000` as a
placeholder — replace with a `weekOf(date)` lookup against this table at P2.

### Sinks (#20)

| Sink | Cost | Burn split |
| --- | --- | --- |
| Chimp mint — Common / Rare / Legendary | 5,000 / 25,000 / 100,000 | 100% → treasury |
| Chimp supply caps | 10,000 / 2,000 / 200 | — |
| Planet parcel | 2,000 × richness(1–3×) | 100% → treasury |
| Asteroid claim slot | 15,000 base | 100% → treasury |
| Structure — place (rig / habitat / refinery / turret) | 1,000 / 800 / 3,000 / 2,500 | 50% burn / 50% treasury |
| Structure — upgrade to level L | base × 1.8^(L−1) | 50% burn / 50% treasury |
| Weekly claim fee (only if land yield included) | flat 50 `$CHIMP` | 100% burn |
| Property tax / week — planet / asteroid | 2% / 3% of purchase price | 100% → treasury |
| Tax grace period | first 4 weeks after purchase | — |
| Marketplace fee (seller) | **3%** | 2% Astro Corp / 0.5% burn / 0.5% crew treasury |

Reclaim: a parcel ≥ 6 weeks delinquent on tax returns to the treasury tree.

### Anti-sybil (#21)

| Control | Value |
| --- | --- |
| Per-wallet weekly claim cap | min(pro-rata share, 3% of that week's pool) |
| Min activity for an allocation | ≥ 3 mission runs across ≥ 2 distinct UTC days that week |
| Wallet-age gate (first claim only) | wallet's oldest signature ≥ 7 days old (relaxed on devnet) |
| Land cap per Chimp | 5 planet parcels + 2 asteroid slots |
| Crew join requirement | ≥ 100 XP, or a vouch from a member with > 500 XP |
