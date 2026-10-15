# OUTBREAK: Last Stand

Cold-War Outbreak-style **3rd-person zombie survival** in a large persistent world, with RPG
leveling and base building. Built for **phone / tablet + desktop**, single HTML file, Three.js.

## The world

A 620 × 620 heightfield valley at night — analytic terrain (`terrainH`) drives the ground mesh,
props, characters, roads and decals, so nothing ever floats or sinks.

| District | Landmark |
|---|---|
| ⛳ Safehouse (0, 18) | Landing pad, blue flag, crates — build your base here |
| 🏘 Klimov Village | 16 houses, fences, campfire, street lamps, wells |
| ✈ Krasnov Airfield | Runway, hangar, wrecked airliner, watchtowers |
| ☢ Reactor Sector | Twin cooling towers, control block, pipe runs, green glow |
| ⛏ Prospector Quarry | Silos, conveyor, excavator, boulder field |
| 🛡 FOB Delta Outpost | Sandbag rings, tents, watchtowers, flag |
| ⛵ Mill Lake Docks | Pier over the lake basin, boathouse, crates |

Roads radiate from the safehouse to every district and a ring road links them all.
Fog, stars, a moon and lamp pools sell the night setting.

## Survivors & infected

- **Player** — 33-part rigged soldier: helmet, goggles, plate carrier with pouches, backpack,
  boots, two-segment arms that blend between low-ready and shouldered aim, and a rifle with
  a muzzle flash. Hip/knee walk cycle, torso counter-rotation, reload animation.
- **Zombies** — hunched rig with a spine bend, tilted skull, open jaw, glowing eyes, reaching
  clawed arms, torn clothing, blood patches. Four tiers: walker, runner, armoured brute,
  purple-glowing elite with an aura.

## Building: a base you can actually live in

Eight blocks plus two tools, all snapping together on a **4 m grid**:

| Block | Cost | Behaviour |
|---|---|---|
| 🧱 Wall | 50 | 4 m section with posts — chains into straight runs |
| ⬛ Floor | 40 | Walkable 4×4 platform at the level you're standing on |
| 🪜 Stairs | 60 | Ramp up one level, always oriented low-edge toward you |
| 🚪 Door | 70 | Opens/closes with **E** or the **USE** button |
| 🗡 Spike / 🔫 Turret / ⛑ Medic / 📦 Ammo | 75–150 | As before |
| ⛏ Remove | — | Demolish what you built, refunds 50% |
| 🆘 Rescue | — | Teleports you out if you brick yourself in |

**Snapping** — every piece lands on the 4 m grid, inherits the rotation of a neighbouring wall
so runs line up, slides to the nearest free cell instead of stacking, and takes the level you are
standing on, so you can walk up stairs and keep building upward.

**Doors** — the important one. A door is a framed panel with a hinge that swings open; while
closed it blocks movement, while open you walk straight through it. Fitting a door onto one of
your own walls **replaces that wall in place**, so the wall you bricked yourself in with always
has a way out. Closed doors are destructible, so the horde can break through if you leave one shut.

**Never trapped** — if you push into geometry and stop moving for 2.4 s, the game moves you to
the nearest open ground and tells you why. Press **F** (or 🆘 Rescue) any time to trigger it
manually.

## Fixes in this pass

- **Hands away from the gun** — the IK solver had three defects: the elbow bend was applied with the
  wrong sign, the bend angle mixed up the interior elbow angle with the rotation, and `L2` (0.36)
  didn't match the forearm mesh (0.34). A wrist rotation was also being applied to the elbow group,
  which bent the whole arm chain instead of just the hand. With the bend angle correct, bone lengths
  matched to the geometry and the wrist moved to its own node, both palms now land on the weapon
  exactly — measured `0.000` right-palm→grip and `0.000` left-palm→handguard while idle, and
  `0.000` left-palm→magazine during a reload (0.024 during recoil kick, which is intentional).
  The grip is also centred in front of the chest now, so the arms hold it like a real two-handed
  rifle grip instead of tucked at the hip.
- **Build menu hid the placement** — the panel was bottom-centre, exactly where the ghost preview
  and the placed wall appear. It is now anchored bottom-left (desktop, above the stat bars) and as a
  3-column grid above the BUILD/SKILL buttons (phone), translucent, with the centre of the screen
  left clear. The ghost is pushed to 7.5 m and now has a green placement beam so the exact spot is
  visible at a glance.
- **Minimap arrow pointed backwards** — it was rotated by `atan2(-sin yaw, -cos yaw)` (i.e. `yaw + π`).
  The player triangle is drawn pointing up (`0,-6`), which must be rotated by `-yaw` to match the
  facing direction `(-sin yaw, -cos yaw)`.

## Earlier fixes

- **Gun floated above the head** — the rifle was parented to the torso at chest-local `y=1.24`
  (world 2.24). It is now built around the pistol grip, parented to the torso at grip height, and
  both arms are driven by a two-bone IK solver (`solveArm`) so the right palm sits exactly on the
  grip and the left hand lands on the handguard — or on the magazine during a reload. Arms were
  also lengthened to a human 0.36/0.36 proportion, and the shoulder pads stay on the torso.
- **No way to place blocks** — build mode is now a compact panel: five icon cards with costs
  (unaffordable ones dim), a full-width **PLACE** button labelled with the current block, and a
  hint line. Works with the button, by tapping the world, or with `E`. Ghost preview sits 6.5m
  ahead and refuses water / out-of-bounds spots.
- **HUD too large** — pills, bars, chips, killfeed, toast, crosshair and minimap all scaled down
  (~25–30% smaller), with a phone layout that keeps stats/minimap in a top band and controls at
  the bottom, and the toast moved clear of the objective card.

## Earlier fixes

- Character floated upward every frame — the walk bob was **added** to `position.y` instead of
  replacing it. Y is now `terrainH(x,z) + jumpHeight` with a clean jump/gravity arc.
- Giant head/helmets — `.scale.set()` after `sph()/cyl()` wiped the primitive radius.
- Camera pointed away from the player (wrong sign on the look target) and clipped into the model.
- Black ground — `vertexColors` path; replaced with a baked 1024² world map (biome blobs,
  slope rock, shoreline sand, grain).
- Invisible pads/roads/anomaly rings — decal triangles wound face-down and back-face culled.
- Floating pad plates — discs replaced with terrain-hugging decals + polygon offset.

Performance: static props merged per material, trees/rocks/fences instanced, horde capped at 16,
adaptive resolution when FPS drops. Verified 0 page errors on desktop (1440×900) and
phone (390×844) with SwiftShader.

## Play

Press **Play**. 🖱️ WASD move · drag/pointer-lock aim · hold click = fire · `R` reload ·
`E` interact · `B` build · `K` skills · `P` pause.
📱 Left stick move · drag right side aim · FIRE hold · USE to seal anomalies / hold exfil.

Seal 3 anomalies, then hold the green exfil pad for 60s. Level, skills, scrap, base and
wave progress auto-save to this device every 10s.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/Endbr1ngerFL/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/Endbr1ngerFL/PlayGround)

- 🎮 [Open the project](https://omgithub.com/Endbr1ngerFL/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=Endbr1ngerFL%2FPlayGround).
- 💻 [Explore the source](https://github.com/Endbr1ngerFL/PlayGround).
- 🛠️ [Check build runs](https://github.com/Endbr1ngerFL/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/Endbr1ngerFL/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/Endbr1ngerFL).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
