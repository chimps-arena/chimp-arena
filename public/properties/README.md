# Property art

One image per property **type** (reused across every matching card). Drop
these exact filenames here; `components/property-thumb.tsx` picks them up
automatically, no code change needed. Anything missing falls back to the
current geometric placeholder, so land these one at a time in any order.

## Have art for these 5 already
`mining_claim.jpg` · `hangar.jpg` · `vault.jpg` · `greenhouse.jpg` · `dock.jpg`

## Still on the placeholder — 13 more types

| File | Type | Prompt |
| --- | --- | --- |
| `fuel_lot.jpg` | Fuel Lot | cryogenic fuel tanks and a service gantry |
| `armory.jpg` | Armory | sealed crates, mesh cages, and a locker run |
| `box.jpg` | Box | stepped seating carved into a hull, amphitheater-style |
| `outpost.jpg` | Outpost | an armored module with a sensor mast on open rock |
| `field.jpg` | Field | a survey stake in pale lunar regolith |
| `loft.jpg` | Loft | tall windows over stacked habitation modules |
| `observatory.jpg` | Observatory | a dome on a crater rim, shutter half open |
| `yard.jpg` | Yard | stacked cargo containers, a gantry, an open platform |
| `stall.jpg` | Stall | a brushed-metal market kiosk on a concourse |
| `array.jpg` | Array | an orange-and-cyan solar array farm on a truss |
| `cantina.jpg` | Cantina | a neon-lit cantina stall on a plaza |
| `tower.jpg` | Tower | a needle tower with cyan dishes and orange strobes |
| `dome.jpg` | Dome | a pressurized greenhouse dome with orange grow light |
| `foundry.jpg` | Foundry | molten orange metal and industrial pipe on a dark rock |

Shared style suffix — append to every prompt above:
> cinematic sci-fi concept art, Astrochimpz space-colony aesthetic, warm amber
> and cyan neon lighting, detailed environment, wide establishing shot, no
> text, no watermark, no people, 4:3 aspect ratio

Later: swap to one unique image per property (`public/properties/<property-id>.jpg`,
e.g. `belt-a12.jpg`) once there's real per-location art — `PropertyThumb`
would need a one-line change to try that path first.
