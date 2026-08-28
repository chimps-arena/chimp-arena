# CHIMP Arena — architecture

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS v4 + a small set of `.card` / `.btn` utilities in `globals.css` |
| Data | Supabase Postgres |
| Realtime | Supabase Realtime (`postgres_changes` on `players` + `mission_runs`) |
| Auth | Phantom wallet signature → HS256 JWT in an httpOnly cookie |

## Directory map

```
app/
  page.tsx                     landing / connect
  dashboard/                    Mission Control
  crews/                        crew selection + standings
  leaderboard/                  live global + crew boards
  missions/{reaction,trivia,astro-run,debris-field}/   mini-game pages
  api/
    auth/{nonce,verify,logout}/ wallet sign-in
    me/                         current player + today's mission status
    crew/                       join a crew (once)
    missions/                   today's mission set
    missions/[slug]/start/      issue a signed start token
    missions/[slug]/submit/     validate score, award XP (once/day)
    leaderboard/                ranked players + crew totals
components/
  session-provider.tsx         client context around /api/me
  nav-bar.tsx, wallet-connect.tsx
  xp-bar.tsx, crew-badge.tsx, mission-card.tsx
  leaderboard-tables.tsx       realtime-subscribed board
  games/game-shell.tsx         start → play → submit → result lifecycle
  games/{reaction-game,trivia-game,astro-run,debris-field}.tsx
lib/
  env.ts                       validated env access
  types.ts
  format.ts, game/xp.ts        level curve = 250 * (L-1)^2
  game/config.ts               CREWS, MISSION_DEFS, seeded shuffle, MISSION_RULES
  game/trivia.ts               question bank (server-only — holds answer keys)
  game/status.ts               builds "today" mission status from mission_runs
  auth/jwt.ts                  jose sign/verify (session + short-lived tokens)
  auth/session.ts             cookie read/write helpers
  auth/solana-verify.ts       ed25519 signature check (tweetnacl + bs58)
  supabase/server.ts          service-role client (route handlers only)
  supabase/browser.ts         anon client (realtime only)
middleware.ts                  gate /dashboard, /missions/*, /crews
supabase/schema.sql            tables, RLS, realtime publication
```

Crews, mission definitions and trivia questions are **code, not data** — edit
`lib/game/*` to change them. Only per-player state (`players`, `mission_runs`)
is in the database.

## Auth flow

1. `wallet-connect.tsx` calls `phantom.connect()` then `POST /api/auth/nonce`
   with the address.
2. The server returns a human-readable `message` containing a random nonce, plus
   a 5-minute signed `challengeToken` that embeds `{ wallet, nonce }`. No DB row.
3. Phantom signs the message (`signMessage`, gasless). The base58 signature +
   `challengeToken` go to `POST /api/auth/verify`.
4. The server rebuilds the exact message from the token's nonce and verifies the
   ed25519 signature against the wallet pubkey (`tweetnacl`).
5. On success it upserts the `players` row (first sign-in only — existing handle
   / xp / crew are preserved) and sets `chimp_session`, a 30-day HS256 JWT, as an
   httpOnly cookie.
6. `middleware.ts` verifies that cookie for protected routes; `SessionProvider`
   exposes the player to the client via `GET /api/me`.

## XP & anti-cheat

Every mini-game run is bracketed by two server calls:

- `POST /api/missions/[slug]/start` → a short-lived signed **start token** that
  pins `{ wallet, slug, sat }` (`sat` = start time). For **trivia** the token
  also carries the answer key, so the client is never sent correct answers.
- `POST /api/missions/[slug]/submit` → verifies the token, checks
  `wallet`/`slug` match, computes `elapsedSec = now - sat`, and runs the
  mission's `validate(score, elapsedSec)` from `MISSION_RULES`:
  - **reaction** — 5 rounds, each 90–2000 ms, run ≥ 3 s.
  - **trivia** — 0–5 correct, scored server-side against the token's key.
  - **astro-run** — `score ≤ elapsedSec * 55 + 50` (bounds the runner's max
    distance rate).
  - **debris-field** — `score ≤ elapsedSec * 80 + 50` (bounds the belt's max
    scroll rate).
- Accepted score → `MISSION_RULES[slug].xp(...)` → inserted into `mission_runs`.
  The `unique (wallet, mission_slug, day)` index is the **one-reward-per-UTC-day**
  gate: a duplicate insert (`23505`) returns `xpAwarded: 0` but still lets the
  raw score improve for bragging rights.

## Realtime leaderboard

`leaderboard-tables.tsx` subscribes with the anon client to `postgres_changes`
on `players` (any) and `mission_runs` (insert), debounces 400 ms, and refetches
`GET /api/leaderboard`. A 20 s poll is the fallback when the socket is down; the
Live/Polling pill reflects which is active.

## Known limitations (MVP)

- **XP update is read-modify-write** in the submit handler. Fine for one player
  at a time; under heavy concurrency from a single wallet a write could be lost.
  Move to a Postgres `add_player_xp(wallet, amount)` function for atomicity.
- **Anti-cheat is heuristic**, not proof. A determined user scripting the submit
  endpoint within the plausibility bounds can inflate scores. Acceptable for an
  adoption-phase MVP with no monetary stakes; tighten before rewards attach.
- **Crew changes are locked** after the first pick (by design, to keep crew
  scores meaningful). Add a cooldown in `app/api/crew/route.ts` if you want
  switching.
- **No handle editing UI** yet — handles default to `chimp_<first4><last4>`.
- Session JWT can't be revoked before its 30-day expiry (stateless).
