# CHIMP Arena — setup

MVP GameFi platform for the $CHIMP community: daily mini-games → individual XP →
crew scores → live leaderboards. Phantom wallet-signature auth. Next.js +
Supabase.

## 1. Prerequisites

- Node.js 20+ (`node -v`)
- A free [Supabase](https://supabase.com) project
- The [Phantom](https://phantom.com/download) browser extension for testing
- (optional) `git` for version control — not installed on this machine yet

## 2. Install dependencies

```bash
cd chimp-arena
npm install
```

## 3. Create the database

1. In your Supabase project: **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Then run each file in [`supabase/migrations/`](supabase/migrations/) in order
   (`0001_…`, `0002_…`). They add the atomic XP function and the weekly score
   snapshots. All are safe to re-run.
4. (optional) Run [`supabase/seed_demo.sql`](supabase/seed_demo.sql) to put a few
   fake players on the leaderboard while you test.

Realtime is enabled by `schema.sql` (it adds `players` and `mission_runs` to the
`supabase_realtime` publication). Nothing else to toggle.

## 4. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Key | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key (**server-only, keep secret**) |
| `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` for now |
| `NEXT_PUBLIC_TOKEN_SYMBOL` | `CHIMP` |

`.env.local` is gitignored and never committed.

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000, click **Connect Phantom**, approve the connection,
and **sign the message** (free, gasless — it only proves you own the wallet).
Then pick a crew and play the daily missions.

## 6. Deploy (later)

Deploy to Vercel: import the repo, add the same environment variables in the
project settings, ship. Set `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` when you
go live.

---

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how auth, XP and anti-cheat work,
and the known limitations of the MVP.
