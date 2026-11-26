# Meshy prompts for Astroworld buildings

There are 12 property types still waiting on proper 3D models. This sheet has a
prompt for each, plus the settings and checks that make a model drop straight
into the game. The Meshy vault (`MATERIALS/Meshy_AI_the_vault_lowpoly_….glb`)
is the reference. It worked first time, so match its look and size.

## The recipe (do this for every building)

1. **Text to 3D**, with the low-poly / game-asset style (the same as the vault).
2. Paste **the building's prompt + the style line** below. If there's a
   negative-prompt box, paste the negative line there.
3. Generate the previews and pick the one that **reads clearly from far away**:
   a strong silhouette beats fine detail. Players see these from 30–100 m.
4. Texture it (refine). If Meshy asks for a texture prompt, reuse the style line.
5. If there's a polycount or remesh option, aim for **about 10,000 triangles**
   (fine anywhere from 5k to 20k).
6. Download the **GLB** and drop it in `MATERIALS` named after the type, such
   as `foundry.glb` or `cantina.glb`. Then tell Claude, and it goes in game the
   same day.

**If text keeps giving messy results:** make a picture first with Meshy's text-to-image or
any image generator: *one isolated building, plain white background,
three-quarter view from slightly above, whole building visible*. Then run
**Image to 3D** on that picture. Buildings usually come out cleaner this way.
Don't use the property-card paintings in `public/properties/`; they're whole
scenes, and Meshy would try to model everything in them.

### Style line (add to every prompt)

> low poly game asset, single sci-fi building on a space colony, dark gunmetal
> riveted metal panels, warm amber window lights and thin cyan light strips,
> chunky readable shapes, flat base, centered, isolated, no ground, no terrain

### Negative line (if there's a box for it)

> ground plane, terrain, rocks around base, landscape, multiple buildings,
> people, characters, text, logos, floating parts, thin wires, transparent glass

### Checks before sending

- **One building**, sitting flat on its base: no ground slab, no scenery.
- **Footprint roughly square**, no wider than about 1.5 × its depth. Lots are
  about 12 m across, and the game scales the model to fit.
- **No hollow interiors.** Players walk around buildings, not into them (yet).
- Nothing thin and dangling (antennas are fine if they're chunky).
- GLB under ~15 MB from Meshy. The game compresses it down to ~100–200 KB.

## The 12 prompts

Game size is how big the building ends up in game. Meshy doesn't need it, but
it tells you the proportions to aim for.

### Built in code today (most wanted)

**foundry** (~12 m wide, ~13 m tall, the tallest of these)
> an industrial ore foundry: two squat cylindrical smelting furnaces joined by
> thick bent pipes, a short smokestack, a glowing orange molten-metal pour spout
> into a round crucible at the front, catwalk railing around the top

**observatory** (~12 m wide, ~12 m tall)
> a lunar observatory: a round rotating dome with its shutter slot half open and
> a telescope barrel poking out, sitting on a short cylindrical base with a
> small door and a ring of amber windows

**lab** (~11 m wide, ~7 m tall)
> a research laboratory module: a long low rectangular block with a rounded
> roof, a row of cyan-lit porthole windows, two stubby sample tanks on the side,
> a small sensor dish on the roof

**club** (~12 m wide, ~8 m tall)
> a nightclub venue: a chunky windowless block with a curved front, a big
> glowing entrance arch, a pink and cyan neon strip running round the roof edge,
> two speaker towers either side of the door

**cantina** (~12 m wide, ~6 m tall)
> a space cantina bar: a wide circular metal roof canopy held up by four thick
> solid support pillars standing on the ground, a round open-sided bar counter
> under the roof, bottle shelves in the middle, bar stools around the counter,
> warm amber lamps under the roof

**loft** (~10 m wide, ~12 m tall)
> a stacked habitation loft: three boxy living modules stacked slightly offset
> like blocks, tall amber-lit windows on each, an outside ladder, a small roof
> terrace railing on top

### Using stand-in models today (wanted eventually)

**station** (~11 m wide, ~8 m tall)
> a rover service station: a flat canopy roof on pillars over two fuel pumps, a
> small kiosk building at the back, a hose reel, amber lights under the canopy

**dome** (~12 m wide, ~8 m tall)
> a pressurized habitat dome: a large hemisphere made of hexagonal metal-framed
> panels glowing orange from inside, an airlock tunnel sticking out at the front

**field** (~12 m wide, ~4 m tall, keep it low)
> a staked survey plot: a low square metal frame fence with four corner posts,
> a survey beacon post in the middle with a small cyan light, a little equipment
> case beside it

**quarry** (~12 m wide, ~9 m tall)
> an open-pit quarry rig: a stepped square pit edge, a tall A-frame crane with a
> hanging bucket, an ore conveyor belt rising out of the pit to a hopper

**box** (~12 m wide, ~7 m tall)
> a small arena viewing box: stepped amphitheater seating in a half-circle,
> built into a curved armored hull wall, a covered roof over the top row

**scrapheap** (~12 m wide, ~6 m tall)
> a salvage scrapyard pile: a heap of broken hull plates, a dented container, an
> old engine and twisted girders, a small magnetic crane arm over it

## Naming and hand-off

| Type | File name in MATERIALS |
| --- | --- |
| foundry | `foundry.glb` |
| observatory | `observatory.glb` |
| lab | `lab.glb` |
| club | `club.glb` |
| cantina | `cantina.glb` |
| loft | `loft.glb` |
| station | `station.glb` |
| dome | `dome.glb` |
| field | `field.glb` |
| quarry | `quarry.glb` |
| box | `box.glb` |
| scrapheap | `scrapheap.glb` |

Two or three variants of the same type are welcome (`foundry-2.glb`). The game
spreads variants across lots so districts don't look copy-pasted.
