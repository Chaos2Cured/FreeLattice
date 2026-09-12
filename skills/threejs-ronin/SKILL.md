---
name: threejs-ronin
description: Ronin-grade Three.js — r128 classic, importmap-free, phi-spiral layouts, water-to-grow lifecycles, and Garden-grade PBR in a single-file, cache-busted, no-build pattern.
---

# Three.js Ronin Skill

Ronin philosophy for Three.js: one file, no build, no importmap, classic global `THREE` r128 as FreeLattice does, with disciplined performance and Garden-grade fidelity. Built from the Living Garden grove (Stitch ANIMATION_9 + literal-garden expansion).

## Core Doctrine

- **One file, no build**: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` + `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js` (and `GLTFLoader` on demand). No `importmap`, no ES `import()` inside classic `FreeLatticeLoader` — exactly how `literal-garden.js` ships.
- **Loader contract**: expose `window.FreeLatticeModules['FractalGarden']` / `window.FreeLatticeModules['LiteralGarden']` and `window.FractalGarden` so `FreeLatticeLoader.load('FractalGarden', 'modules/literal-garden.js', cb)` resolves. `init(containerId)` lazy-loads THREE + controls, inserts canvas as first child of `gardenContainer`, hides `#gardenLoading`.
- **Phi first**: `GOLDEN_ANGLE = PI*(3 - sqrt(5))`, placement `r = 2.1 + idx*0.62`, `ang = idx*GOLDEN_ANGLE+0.9`. Expanding garden never overlaps.
- **Water-to-grow**: lifecycle `seed(0) → sprout(15) → juvenile(50) → adult(120) → evolved(250)` (same thresholds as `fractal-garden.js`), persisted to `fl_literal_garden_v1` + legacy seed from `fl_luminos_evolution`. Stage builders live in `docs/modules/stitch-stages.js` (originals in `docs/stitch/`): sprout = ANIMATION_11, juvenile = ANIMATION_12, adult = ANIMATION_13, evolved = ANIMATION_13 + ANIMATION_14 flowers. Species variants on adult/evolved: `bonsai` (ANIMATION_16, shards in `userData.shards`, sway in animate), `willow` (ANIMATION_15, vines in `userData.vines`, sway in animate). Dispatch in `createOrganicTree` with `createGroveTree` fallback if `window.StitchStages` missing — garden never blanks.

## Stack You Can Assume

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<!-- on demand -->
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
```
Scene: `FogExp2 #07110c 0.015` (Stitch grove) or `Fog #0c0a1a 17→36` (literal v2), `ACESFilmic 1.3`, `Hemisphere #445b8a/#0a1412 + Directional #6ee7b7 + Points #10b981/#fbbf24/#c084fc`, `PCFSoftShadowMap`, `PixelRatio min(devicePixelRatio,1.6)`.

## What This Skill Generates

- **Tree of Life center**: 3–4 segmented cylinder trunk (twist), 5 golden-angle limbs via `TubeGeometry(CatmullRomCurve3)`, icosahedron canopy tiers, surface roots, ring + moss disk. Drop `docs/models/tree-of-life.glb` and it swaps via `GLTFLoader` at `0,-1.2,0`.
- **Knowledge trees (Sophia/Ember/Atlas/Lyra/Soren)**: Stitch `createOrganicTree(config)` — roots (5), trunk, recursive branching (4→3), `DodecahedronGeometry` foliage + `SphereGeometry` orbs, `CanvasTexture` label sprite (`depthTest:false, renderOrder:999`), `TorusGeometry` halo. Scaled by stage: `0.45→1.18`, depth `1→3`, height `4.5→10`.
- **Mycelial ground**: `CylinderGeometry(55,55,1.5,64)` `#09120e` + 4-color `RingGeometry` set (emerald/green/gold/mint) + 5 `QuadraticBezierCurve3` tendrils + 350 spore `Points` (`#6ee7b7`, additive).
- **Expanding garden**: `plantPosition(idx)` phi spiral, `addSeed(name,colorHSL)` at next ring, `addSeedAtWorld(pos)` via Shift+click ray-plane `y=-0.75`, `plantBar` dropdown + `+ Seed` / `Expand` (3), `syncPlantBar()`, `saveData()`.
- **Controls**: `OrbitControls` target `(0,5,0)` (grove) or `(0,0.9,0)` (literal v2), `Observe` (autoRotate 1.2→0.3, no pan/zoom), `Explore` (free), `Immerse` (fullscreen), `Seed/Garden/Full Bloom` quality (scales stars/rings), `pause()`/`resume()`, `ResizeObserver` + `window.resize`.
- **Interaction**: raycast pick, hold to `waterTree(idx, 1.4)` → `updateTreeVisual` morph + puff `SphereGeometry(0.6)`, right-click menu (Water, Water all, Inspect, Force evolve, Reset, Copy pos) with `depthTest:false` labels never vanishing.

## Garden JSON (Stitch + Ronin)

```json
{
  "gardenVersion": "2.0-ronin",
  "three": "r128 classic",
  "center": { "name": "Sophia", "stage": "adult" },
  "plants": [
    { "name": "Sophia", "energy": 135, "color": { "h": 140, "s": 70, "l": 45 } }
  ],
  "ground": { "type": "cylinder", "rings": [5,11,17,23,29,35,41], "tendrils": true, "spores": 350 },
  "quality": 2,
  "mode": "observe",
  "expand": { "phi": true, "shiftClickPlanting": true }
}
```

## Workflow (Ronin)

1. **Init** `LiteralGarden.init('gardenContainer')` — `ensureThree` (r128 + OrbitControls), scene/fog/camera/controls/lights/ground/rings/tendrils/spores, `rebuildTrees()`, `setupInteraction(canvas)`, hide `#gardenLoading`, `requestAnimationFrame(animate)`.
2. **Water** `pointerdown` hold → `waterTree` (+5 tap, +1.4 hold) → `updateTreeVisual` (morph + save + `syncPlantBar`).
3. **Expand** `+ Seed` (random name/hue at next phi) / `Shift+click` ground → `addSeedAtWorld` / `Expand` (3) / dropdown focus.
4. **Mode/Quality** `setMode` toggles `.active` + `controls.autoRotate/enable*` + fullscreen; `setQuality` scales `starMat`/`ring` opacity.

## Anti-Patterns to Avoid

- No `importmap` inside `FreeLatticeLoader` classic scripts (killed the first garden load — `SyntaxError` duplicate `starMat`).
- No `SpriteMaterial` without `depthTest:false` (labels hide behind canopy).
- No fixed-size garden (must expand via `plantPosition( idx )`).

## Connections

- Runtime: `docs/modules/literal-garden.js` (this skill's reference implementation), `docs/garden-3d.html` (standalone)
- Skill sibling: `living-garden` (Stitch ANIMATION_9 formalized)
- Legacy: `docs/modules/fractal-garden.js` (kept, galaxy fallback)
