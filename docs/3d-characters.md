# Astroworld 3D characters

Every Astrochimp in Astroworld is drawn by one of two things:

1. **An artist-made rigged model**: `public/models/characters/<character id>.glb`,
   once it passes `node scripts/check-models.mjs`.
2. **The built-in code rig** (`components/astroworld/chimp-rig.tsx`): a simple
   jointed figure in the character's colours, outfit and headwear. It's the
   stand-in until that character's real model exists.

Models replace the code rig **one character at a time**, with no code changes. The
game picks the right animation from the model's clips, scales it to 1.9 m, gives
it the Astral rifle in combat zones, and bends the spine to follow the aim.

The roster is the 47 agreed designs (21 Common, 21 Rare, 5 One of One). Ids are
in `shared/src/characters.json`, e.g. `rare-deezy-chimp`, `chimp-1of1-kill-boy-tommy`,
`std-castro` (Commons are `std-…` in the database).

---

## Pilot: Deezy Chimp (`rare-deezy-chimp`)

Source art: `Desktop/Rare/deezy_chimp.png`.

### 1. Get a clean, standing reference image

Image-to-3D tools copy the pose in the picture. Deezy's art is a crouching lunge
with a sword, which can't be rigged well. First turn it into a **standing A-pose
on a plain background** with any image generator that accepts a reference image
(ChatGPT, Midjourney, the 3D tool's own image editor…), using the NFT art as the
reference:

> Full-body character reference of this exact character, standing straight in an
> A-pose (arms angled 45° down, legs slightly apart), facing the camera, plain
> light-grey background, even lighting, no weapon in hand. Keep the outfit exactly:
> tattered dark olive hooded cloak, black segmented armour with purple glowing
> accents, teal glyph trim, purple-lit visor mask over a chimpanzee face, armoured
> gloves and boots. Stylised 3D game-character look.

Check the result against the NFT. The hood, mask, cloak and colours must read as
Deezy. Make a back view the same way if the tool accepts several views.

### 2. Image → 3D model

Upload the A-pose image (plus back view if you have one) to **Meshy** or **Tripo**
(image-to-3D). Settings to look for:

- PBR textures **on**
- A-pose / T-pose option **on**, if the tool has one
- Target around **10–15k triangles** (quad/low-poly remesh if offered)

Download as **FBX** (for Mixamo) or **GLB**.

> Tripo and Meshy can also auto-rig and animate. If their rig is humanoid with a
> "Hips" bone, you can skip step 3 and use their animations, as long as the clip
> names match the moves listed below.

### 3. Rig + animations in Mixamo (free, Adobe account)

1. mixamo.com → Upload Character (FBX/OBJ) → place the markers (chin, wrists,
   elbows, knees, groin).
2. Download the character once: **FBX, With Skin**.
3. Download each animation: **FBX, Without Skin, 30 fps, In Place ticked** for
   moving ones. Search Mixamo for:

| Move (game role) | Search Mixamo for | Required? |
| --- | --- | --- |
| idle | "Idle" / "Breathing Idle" | **yes** |
| walk | "Walking" | **yes** |
| run | "Running" / "Sprint" | recommended |
| rifleIdle | "Rifle Aiming Idle" | recommended |
| rifleWalk | "Walking With Rifle" / "Rifle Walk" | recommended |
| crouch | "Crouched Walking" | nice to have |
| jump | "Jump" | nice to have |
| death | "Dying" | nice to have |
| drive | "Driving" / "Sitting" | nice to have |

Missing moves fall back to the closest one (no rifle walk → normal walk, and so on).

### 4. Combine into one .glb (Blender, free)

1. Import the "With Skin" FBX, then each animation FBX.
2. In the Action editor, **rename each action** so it contains the move word:
   `Idle`, `Walk`, `Run`, `RifleIdle`, `RifleWalk`, `Crouch`, `Jump`, `Death`,
   `Drive`. Mixamo calls them all `mixamo.com`, which the game can't tell apart.
3. Push each action down to an NLA track (or tick "Fake User").
4. File → Export → glTF 2.0: **glTF Binary (.glb)**, +Y up, Animations on
   ("Group by NLA track"), Apply Modifiers on.

### 5. Shrink it

```bash
npx @gltf-transform/cli optimize deezy.glb rare-deezy-chimp.glb --compress meshopt --texture-compress webp --texture-size 1024
```

Use **meshopt** (not Draco). It decodes in the browser with no extra download.

### 6. Switch it on

```bash
# put the file in public/models/characters/, named after the character id
node scripts/check-models.mjs
```

The check prints PASS/FAIL with what's wrong (not rigged, missing walk/idle,
too heavy, wrong file name…). Only models that pass go into
`public/models/characters/index.json`, which is the list the game loads. Refresh
`/astroworld` and pick Deezy Chimp.

---

## Spec summary (for an artist or a tool)

| | |
| --- | --- |
| File | `<character id>.glb`, glTF binary |
| Scale/orientation | Y-up, facing +Z, feet at origin (any size; the game scales to 1.9 m) |
| Skeleton | Humanoid, Mixamo-style (`Hips`, `Spine`, `Spine1`, `Spine2`, …) |
| Budget | ≤ 15k triangles (hard limit 60k), one 1024² texture set (2048² for One of Ones), ≤ 6 MB |
| Clips | names containing: idle, walk (required); run, rifle/aim idle, rifle walk, crouch, jump, death, drive |
| Compression | meshopt + webp textures |

Once Deezy looks right in game, the same steps repeat for the other 46. With an
API key for the 3D tool, steps 2–3 can be scripted for the whole roster.
