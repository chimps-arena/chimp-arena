# Property art

One image per property **type** (reused across every matching card — same
pattern as the reference site's photo grid). Drop these exact filenames here;
`components/property-thumb.tsx` picks them up automatically, no code change
needed. Anything missing falls back to the current geometric placeholder, so
you can land these one at a time.

| File | Property type | Suggested aspect |
| --- | --- | --- |
| `mining_claim.jpg` | Mining Claim | 4:3, landscape |
| `hangar.jpg` | Hangar | 4:3, landscape |
| `vault.jpg` | Vault | 4:3, landscape |
| `greenhouse.jpg` | Greenhouse | 4:3, landscape |
| `dock.jpg` | Dock | 4:3, landscape |

## Prompts (matching the house art style — same warm amber / cyan neon,
## cinematic sci-fi look as the logo, character, and scene art already in
## `public/brand/` and `public/scenes/`)

Shared style suffix — append to every prompt below:
> cinematic sci-fi concept art, Astrochimpz space-colony aesthetic, warm amber
> and cyan neon lighting, detailed environment, wide establishing shot, no
> text, no watermark, no people, 4:3 aspect ratio

- **mining_claim.jpg** — "a rugged asteroid mining claim with drilling rigs and glowing ore veins, dusty rock surface, sparks flying"
- **hangar.jpg** — "a starship hangar bay with a parked shuttle, mechanical gantries, glowing floor lights"
- **vault.jpg** — "a secure vault chamber door, reinforced metal, glowing security panel, deep underground"
- **greenhouse.jpg** — "a domed greenhouse on an alien surface, glowing bioluminescent plants, glass panels"
- **dock.jpg** — "a space station docking pier with ships berthed, walkways, starfield background"

Later: swap to one unique image per property (`public/properties/<property-id>.jpg`)
once there's real per-location art — `PropertyThumb` would need a one-line
change to try that path first.
