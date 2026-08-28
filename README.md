# 🐵 CHIMP Arena

A lean GameFi platform that builds community culture around **$CHIMP** through
missions, rivalry and crew competition. Adoption first, monetization later.

## Features

- **Mission Control dashboard** — player profile, crew, XP + level progress,
  today's missions at a glance.
- **Daily mini-games** — Reflex Check (reaction), Jungle Intel (trivia), Astro
  Run (canvas endless runner) and Debris Field (asteroid-belt dodger). One XP
  reward per mission per UTC day.
- **XP & crews** — every point of individual XP is added to your crew's score.
  Four crews compete.
- **Live leaderboards** — global player ranking and crew standings, updated in
  real time via Supabase Realtime.
- **Phantom wallet auth** — connect + sign a gasless message; the wallet address
  is your identity. No passwords.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # then fill it in — see SETUP.md
npm run dev
```

Full instructions (Supabase project, schema, keys): **[SETUP.md](SETUP.md)**.
How it works and MVP limitations: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase
(Postgres + Realtime) · @solana/web3.js + Phantom · jose · tweetnacl

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

> XP has no monetary value. Nothing here is financial advice.
