# CHIMP — token policy (v1)

**Status: LOCKED 2026-09-01.** This is the model. It does not change without a
dated founder sign-off appended below. [ECONOMY.md](ECONOMY.md) describes
mechanics *within* this model; where the two disagree, this file wins.

Why this exists: the model was reopened five times in three weeks. Each churn
cost build time and cost confidence. This page ends that.

---

## The model

**CHIMP is a single, spend-only utility currency.**

- Players **acquire** CHIMP by swapping SOL / USDC → CHIMP (in-app, via Jupiter).
  They do **not** earn it by playing.
- Players **spend** CHIMP on Chimps, land, structures, and items.
- **XP stays** exactly as it is: non-transferable rank. Drives levels, crews,
  leaderboards and streaks. It never converts to CHIMP or anything else.
- **No play-to-earn in v1.** No weekly pool, no emission, no claim.
- SOL's only role in-game is buying CHIMP. Items are priced in **CHIMP only** —
  no dual pricing.

**Revenue (Astro Corp):**
- Primary sales — Chimp mints, land, asteroid slots, structures — the main early
  revenue.
- A **3% fee on in-app secondary trades** (split: 2% Astro Corp · 0.5% burn ·
  0.5% crew treasury).
- No revenue comes from selling emitted tokens, because none are emitted.

---

## Guardrails (the "what could go wrong" list, closed)

1. **Play-to-earn stays parked.** It is a *possible future season*, not a v1
   feature. It ships only after a written sink-discipline review shows sinks
   would exceed the proposed faucet. Until then, no emission code runs in
   production.
2. **CHIMP is a currency, not an investment.** All public copy — pitch, site,
   docs — says so plainly. No "number go up", no yield language, no returns.
3. **Liquidity is protocol-owned and grows.** The 10% seed is a floor. Treasury
   commits to progressive liquidity provisioning from treasury CHIMP + SOL/USDC
   collected from primary sales, targeting **pool depth ≥ 15% of circulating
   supply** at all times. LP tokens are locked. See ECONOMY.md §"Liquidity".
4. **Unlocks are sequenced.** Founder vest, treasury LP adds, community and
   partnership distributions are scheduled so no single month floods circulating
   supply. No cliff stacking. Every bucket has a published schedule before TGE.
5. **Founder allocation vests long.** Non-negotiable: 12-month cliff, then
   36-month linear vest. (20% is on the high side for a game studio post-2024 —
   flagged for founder review; the long vest is not optional either way.)
6. **The in-app marketplace must be the best venue,** or the 3% fee earns
   nothing (players route around it on Tensor / Magic Eden). Enforce via Metaplex
   Core enforced royalties and by making in-app the deepest liquidity for Chimps
   and land.
7. **"GameFi" expectation is managed now.** Community messaging frames CHIMP
   Arena as *a game with an on-chain economy*, not *a game you earn a living from*.
8. **Devnet until counsel clears mainnet.** No fiat on-ramp, no liquid token,
   until legal review passes ([ROADMAP.md](ROADMAP.md) #62).

---

## Open — needs a founder decision (does NOT block the v1 build)

- **The 20% "Ecosystem rewards" allocation bucket has no job under a spend-only
  model.** Resolve one of:
  - **(A, recommended)** repurpose → 12% Liquidity reinforcement + 8% Treasury;
  - **(B)** ring-fence for a *dated, scoped* future rewards season (name the date).
  Leaving a large undefined bucket reads as insider overhang.
- **Founder allocation 20% vs 15%** — confirm 20%, or trim to 15% and move 5% to
  Liquidity. Vest terms are fixed regardless (guardrail 5).
- **Fiat on-ramp** (MoonPay / Transak) — yes or earn-your-CHIMP-with-SOL only.
  Not needed before mainnet.

---

## Allocation (founder plan, 2026-09-01)

`$CHIMP` fixed max supply: **1,000,000,000** · 6 decimals · classic SPL Token ·
freeze authority `null`.

| Bucket | Share | Amount | Terms |
| --- | --- | --- | --- |
| Founders / team | 20% | 200,000,000 | 12-mo cliff, 36-mo linear vest |
| Treasury | 25% | 250,000,000 | ops + progressive LP; published spend schedule |
| Ecosystem rewards | 20% | 200,000,000 | **PARKED** — see Open decisions |
| Community & partnerships | 15% | 150,000,000 | distributed over time, scheduled |
| Liquidity | 10% | 100,000,000 | initial seed; POL, LP locked |
| Corporation reserve / operations | 10% | 100,000,000 | legal, development, marketing, infrastructure |

---

## Sign-off

| Date | Who | Change |
| --- | --- | --- |
| 2026-09-01 | (pending) | v1 spend-only model locked |
