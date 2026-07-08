# TRASH — Pruned but Protected

> Items removed from active FreeLattice code during audits.
> Nothing here is gone forever. If you need it back, it is here.
> Maintained by Harmonia. Last audit: v5.75.1, July 8 2026.

---

## v5.75.1 Audit — July 8 2026

### 1. Duplicate `wallet` card entry (Trust Level)

**What it was:** A card in `MORE_CARDS` with `id: 'wallet'` and `label: 'Trust Level'`. It was a duplicate of the actual Wallet card (also `id: 'wallet'`), causing two entries with the same ID in the card array.

**What was done:** The Trust Level card's `id` was changed from `'wallet'` to `'trust-level'`. The card itself was kept — it still appears in the More menu. Only the ID was corrected.

**Original entry:**
```js
{ id: 'wallet', icon: '&#x1F6E1;', label: 'Trust Level', desc: 'See how your relationship with AI grows over time.', hoverColor: 'rgba(232,176,25,0.3)', help: 'Your phi-branching trust rank — Seed through Radiant. Earned through real conversations, not credentials.' },
```

**Corrected to:**
```js
{ id: 'trust-level', icon: '&#x1F6E1;', label: 'Trust Level', desc: 'See how your relationship with AI grows over time.', hoverColor: 'rgba(232,176,25,0.3)', help: 'Your phi-branching trust rank — Seed through Radiant. Earned through real conversations, not credentials.' },
```

---

### 2. Duplicate label: Ship B "Round Table" → renamed "Consensus Table"

**What it was:** Ship B (v5.75.0, `id: 'round-table'`) had the label `'Round Table'`, which was identical to the pre-existing domain-specialist Round Table (`id: 'roundtable'`, 🏛️ emoji, 80 specialists, 11 domains). Both appeared under the Learn tab, causing user confusion.

**What was done:** Ship B's label was renamed from `'Round Table'` to `'Consensus Table'` to clearly distinguish the two. The `id`, tab panel, and module are unchanged.

**Original:**
```js
{ id: 'round-table', icon: '&#x1F9E9;', label: 'Round Table', ... }
```

**Corrected to:**
```js
{ id: 'round-table', icon: '&#x1F9E9;', label: 'Consensus Table', ... }
```

**Note:** If you want to restore the original name, the pre-existing Round Table (`id: 'roundtable'`) would need to be renamed first, or Ship B moved to a different tab group.

---

### 3. Duplicate label: Ship C "Chalkboard" → renamed "Drawing Board"

**What it was:** Ship C (v5.75.0, `id: 'chalkboard'`) had the label `'Chalkboard'`, which was identical to the pre-existing canvas-based Chalkboard (`id: 'canvas'`, ✏️ emoji) in the Play tab. Both appeared in the app, causing user confusion.

**What was done:** Ship C's label was renamed from `'Chalkboard'` to `'Drawing Board'` to clearly distinguish the two. The `id`, tab panel, and module are unchanged.

**Original:**
```js
{ id: 'chalkboard', icon: '&#x270F;', label: 'Chalkboard', ... }
```

**Corrected to:**
```js
{ id: 'chalkboard', icon: '&#x270F;', label: 'Drawing Board', ... }
```

**Note:** The two tools are genuinely different. The original canvas Chalkboard is a drawing canvas where the AI sees your drawing and responds. Ship C's Drawing Board is a collaborative text+drawing space where AI and human exchange [FL_DRAW:] sentinels and the history accumulates. They serve different purposes and both should exist.

---

### 4. Empty Ship tab panels (blank tabs bug)

**What it was:** The three Ship panels (`tab-remix-room`, `tab-round-table`, `tab-chalkboard`) were inserted as empty `<div>` containers. The lazy loaders called `Module.init(container)` which renders into the container, but the container was empty so the tab appeared blank until the module loaded — and the `tabVisible` event was not being listened to, so the load was not reliably triggered.

**What was done:**
- Added a "Loading…" placeholder inside each panel so the user sees something immediately.
- Added named inner containers (`remixRoomContainer`, `roundTableModuleContainer`, `chalkboardContainer`) for the modules to render into.
- Updated all three lazy loaders to also listen for `tabVisible:*` events (in addition to `tabChanged` and `tabActivated`).

**This was a bug, not a design decision. Nothing was discarded.**

---

## Audit Summary — v5.75.1

| Issue | Resolution | Status |
|-------|-----------|--------|
| Duplicate `wallet` ID | Fixed ID to `trust-level` | ✅ Fixed |
| Duplicate "Round Table" label | Ship B renamed "Consensus Table" | ✅ Fixed |
| Duplicate "Chalkboard" label | Ship C renamed "Drawing Board" | ✅ Fixed |
| Blank Ship tab panels | Added placeholders + fixed lazy loaders | ✅ Fixed |
| 54 orphaned tab panels | Noted — most are internal navigation tabs, not cards | ℹ️ Expected |

**Orphaned tab panels that are expected (not bugs):**
`tab-chat`, `tab-workspace`, `tab-more`, `tab-learn`, `tab-play`, `tab-lighthouse` — these are navigation containers, not content tabs.
`tab-roundtable`, `tab-education`, `tab-workshop`, `tab-garden`, `tab-harmonia`, `tab-aurora`, `tab-memory-garden` — these are content tabs loaded by their own internal systems, not by the card grid.

---

*The lattice prunes but does not forget. — Harmonia*
