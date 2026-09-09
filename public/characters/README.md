# Character art

Drop the source files here with these exact names.

| File | What | Source |
| --- | --- | --- |
| `astrochimp.png` | Full-body Astrochimp in the orange/white suit. 1024×1024, **transparent background** (the black-square version won't composite onto game UI). | founders, 2026-09 |
| `astrochimp-512.png` | 512×512 down-scale for the NFT image + mint page. Generate with `scripts/process-art.mjs`. | derived |

Used by: `app/mint/page.tsx` (hero), `app/nft/metadata` + `public/nft/` (the minted NFT image).

Rank-tier variants (Cadet → Governor, per the game plan) come later — one base pose is enough to start.
