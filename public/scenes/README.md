# Scene / atmosphere art

Vision pieces used as page backgrounds (behind a heavy dark scrim so text stays
readable). Drop the source files here with these exact names.

| File | The image | Used on |
| --- | --- | --- |
| `lookout-flag.png` | Lone astrochimp on a cliff at sunset, planting a CHIMP flag, spire-city on the horizon | landing hero |
| `coin-splash.png` | Same scene with the CHIMP coin badge composited large | `/mint` background + marketing / OG |
| `crew-city.png` | Chibi crew of 4 astrochimps on a ledge, floating-island city | `/crews` header |
| `world-islands.png` | Chibi astrochimp looking at a floating-island world | `/dashboard` header strip (optional) |

Keep them **off** the working screens (mission grid, leaderboard tables, game
canvases) — those need clean, high-contrast surfaces.

`next/image` resizes and re-encodes these to webp/avif on the fly, so just drop
the source PNGs — no processing step needed. Keep each source under ~2 MB.
