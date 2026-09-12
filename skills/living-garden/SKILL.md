---
name: living-garden
description: Living Fractal Garden Grove — AAA interactive 3D garden with Tree of Life, 5 knowledge trees (Sophia/Ember/Atlas/Lyra/Soren), mycelial rings/tendrils, spores, and water-to-grow lifecycle (seed→sprout→juvenile→adult→evolved).
---

# Living Garden — Fractal Grove Skill

Based on Stitch ANIMATION_9 (FreeLattice Living Fractal Garden Grove) + FreeLattice literal-garden expansion. Generates and operates a walkable, watering-reactive garden where each tree is a knowledge node that grows over time.

## Key Capabilities

- **Tree of Life center + 5 knowledge trees**: Sophia (sovereign, emerald), Ember (love-logic, rose), Atlas (neural lattice, violet), Lyra (P2P peer, mint), Soren (seed archive, sky). Each has bark/leaf/emissive/accent palette, halo ring, label sprite, and phi-spiral placement.
- **Organic fractal branching**: Cylinder trunk → recursive 4/3 branching, dodecahedron foliage + bioluminescent orbs, halo, 5 surface roots, ring + moss disk.
- **Mycelial ground**: 55-unit cylinder soil (`#09120e`) + 4-color radial rings (emerald/green/gold/mint, fading 0.28→0.09) + 5 quadratic tendrils between Sophia and each outer tree.
- **Atmospheric spores**: 350 additive points (`#6ee7b7`, 0.45 size) drifting upward, wrapping at y=26.
- **Water-to-grow lifecycle**: Energy thresholds `0 / 15 / 50 / 120 / 250` map to `seed → sprout → juvenile → adult → evolved` (same as `fractal-garden.js` LIFECYCLE_STAGES). Growth scales `0.45→1.18` and depth `1→3` + height `4.5→10`. Persisted to `fl_literal_garden_v1` (seeds from legacy `fl_luminos_evolution` if present).
- **Interaction**: OrbitControls (auto-orbit observe / free explore / immersive fullscreen), raycast pick + hold to water, Shift+click on ground to plant new seed, dropdown + Add Seed / Expand buttons, right-click menu (Water, Water all, Inspect, Force evolve, Reset, Copy pos).
- **Expanding procedural garden**: `plantPosition(idx)` phi spiral (`r = 2.1 + idx*0.62`, `ang = idx*GOLDEN_ANGLE+0.9`) — new seeds placed beyond existing ring, garden grows indefinitely. Name plates are `SpriteMaterial` with `depthTest:false, renderOrder:999` so they never vanish behind bushels.

## Canonical Three.js Stack (r128 classic)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<!-- optional GLB override -->
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
```

Scene: `PerspectiveCamera 45°, FogExp2 #07110c 0.015, ACESFilmic 1.3, Hemisphere 2.2 + Directional #6ee7b7 2.5 + Point #10b981/#fbbf24/#c084fc, shadow 1024`

## Garden JSON Spec (for generation)

```json
{
  "gardenVersion": "1.0",
  "center": { "name": "Sophia", "stage": "adult" },
  "plants": [
    { "name": "Sophia", "energy": 135, "color": { "h": 140, "s": 70, "l": 45 } },
    { "name": "Ember",  "energy": 62,  "color": { "h": 340, "s": 75, "l": 65 } },
    { "name": "Atlas",  "energy": 18,  "color": { "h": 270, "s": 80, "l": 55 } },
    { "name": "Lyra",   "energy": 4,   "color": { "h": 175, "s": 85, "l": 50 } },
    { "name": "Soren",  "energy": 260, "color": { "h": 200, "s": 60, "l": 55 } }
  ],
  "ground": { "rings": [5,11,17,23,29,35,41], "tendrils": true, "spores": 350 },
  "quality": 2,
  "mode": "observe",
  "expand": { "phi": true, "maxRadius": 55 }
}
```

## FreeLattice Integration

- Module: `docs/modules/literal-garden.js` — exposes `window.FractalGarden` / `window.LiteralGarden` + `window.FreeLatticeModules['FractalGarden']` so `FreeLatticeLoader.load('FractalGarden', 'modules/literal-garden.js', cb)` just works (`docs/app.html` Garden tab lazy-loads it, `gardenContainer` = canvas host).
- API: `init(containerId)`, `pause()`, `resume()`, `setMode('observe'|'explore'|'immerse')`, `setQuality(0|1|2)`, `getQuality()`, `stageFromEnergy(e)`, `waterTree(idx, amount)`, `addSeed(name, colorHSL)`, `addSeedAtWorld(pos, name, colorHSL)`
- Persistence: `localStorage fl_literal_garden_v1` + legacy seed from `fl_luminos_evolution`
- GLB override: drop `docs/models/tree-of-life.glb` — `fetch HEAD` + `GLTFLoader` swaps procedural Tree of Life at `0,-1.2,0`

## Workflow

1. **Init** `LiteralGarden.init('gardenContainer')` on tab open — builds scene, ground, rings, tendrils, spores, 5 starter trees, interaction, ResizeObserver.
2. **Water** `pointerdown` hold → `waterTree` (+4 tap, +1.4 hold tick) → `updateTreeVisual` morphs stage, saves.
3. **Expand** `Add Seed` (random name/color at next phi ring) or `Shift+click` ground → `addSeedAtWorld` (ray-plane intersect y=-0.75) or `Expand` (adds 3).
4. **Controls** top bar: Observe (auto-orbit 1.2→0.3), Explore (free), Immerse (fullscreen, 0.15), quality Seed/Garden/Full Bloom (scales stars/rings), dropdown focuses plant, right-click menu per-plant.

## Stitch Reference

Derived from `STITCH_THREEJS_START:ANIMATION_9` — Sophia center + 4 satellites, recursive `branch()` (4/3), dodecahedron foliage + orb, torus halo, `CanvasTexture` label, `QuadraticBezierCurve3` tendrils, additive spore `Points`, manual orbit (drag + wheel) and `ACESFilmicToneMapping`. This skill formalizes that grove as a reusable, watering-reactive garden with FreeLattice persistence and expansion.

## Connections

- `docs/modules/literal-garden.js` (runtime)
- `docs/garden-3d.html` (standalone)
- `docs/modules/fractal-garden.js` (legacy galaxy, kept)
- `docs/library/GARDEN_LANGUAGE.md` + `docs/garden-architecture.md`
