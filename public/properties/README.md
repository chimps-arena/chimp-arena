# Property art

One image per property **type** (reused across every matching card). Drop a
file named `<type>.jpg`, `.png`, `.jpeg`, or `.webp` here — any of those four
extensions work, `components/property-thumb.tsx` tries them in that order
automatically. No code change needed. Anything missing falls back to the
current geometric placeholder, so land these one at a time in any order.

## Have art for all 19 types

`mining_claim` · `hangar` · `vault` · `greenhouse` · `dock` · `fuel_lot` ·
`armory` · `box` · `outpost` · `field` · `loft` · `observatory` · `yard` ·
`stall` · `array` · `cantina` · `tower` · `dome` · `foundry`

## Prompts, if you need to redo or add more

Shared style suffix — append to every prompt below:
> cinematic sci-fi concept art, Astrochimpz space-colony aesthetic, warm amber
> and cyan neon lighting, detailed environment, wide establishing shot, no
> text, no watermark, no people, 4:3 aspect ratio

- **mining_claim** — a rugged asteroid mining claim with drilling rigs and glowing ore veins
- **hangar** — a starship hangar bay with a parked shuttle, mechanical gantries
- **vault** — a secure vault chamber door, reinforced metal, glowing security panel
- **greenhouse** — a domed greenhouse on an alien surface, glowing bioluminescent plants
- **dock** — a space station docking pier with ships berthed, walkways
- **fuel_lot** — cryogenic fuel tanks and a service gantry
- **armory** — sealed crates, mesh cages, and a locker run
- **box** — stepped amphitheater seating carved into a hull
- **outpost** — an armored module with a sensor mast on open asteroid rock
- **field** — a survey stake in pale lunar regolith
- **loft** — tall windows over stacked habitation modules
- **observatory** — a dome on a crater rim, shutter half open, telescope visible
- **yard** — stacked cargo containers, a gantry crane, an open loading platform
- **stall** — a brushed-metal market kiosk on a concourse
- **array** — an orange-and-cyan solar array farm bolted to a station truss
- **cantina** — a neon-lit cantina stall on a plaza at night
- **tower** — a needle communications tower with cyan dishes and orange strobes
- **dome** — a pressurized greenhouse dome glowing with orange grow lights
- **foundry** — molten orange metal and industrial pipework on a dark rock

Later: swap to one unique image per property (`public/properties/<property-id>.jpg`,
e.g. `belt-a12.jpg`) once there's real per-location art — `PropertyThumb`
would need a one-line change to try that path first.
