# Garden Persistence Diagnostic

> Prepared 2026-06-12 by CC, per Opus's brief, before any fix ships.
>
> **The discipline this time:** right-click first; ship second. The three-week Presence button bug (FIXED.md v5.43.8) closed only when Kirk inspected the actual rendered DOM in the browser. We are NOT touching `fractal-garden.js` until the diagnostic output tells us what is actually happening on Kirk's machine vs his mom's.

## Why this exists

Kirk's mom's Garden persists evolution across browser sessions. Kirk's does not. Same browser. Same version. Same code. **Different behavior** — so the difference cannot be in the code. It must be in the *state of the storage* on each machine.

Opus named three real possibilities:

1. **Persistent Storage granted on hers, not yours.** Default IndexedDB is "best-effort" — the browser may evict it under storage pressure, on Mac Safari, or on Chrome with low site engagement scoring. "Persistent" means the browser promises to keep it until the user explicitly deletes. Kirk's mom may have been prompted; Kirk may not have been.
2. **Site engagement score difference.** Kirk's mom has used the Nursery (which writes Soul Files) and has an ancient Core (which writes Knowledge Core entries). Both opened IndexedDB databases *early* and wrote to them often. Longer write history → higher engagement score → lower eviction risk. Kirk's history may be shorter or sparser.
3. **Save path firing but writing to a key the load path doesn't read.** Ship 8 (`persistAllLuminos()`) wired four triggers (`beforeunload` / `pagehide` / `visibilitychange:hidden` / 60s interval). If any is silently failing, OR if save and load disagree about the store/key, you get exactly this pattern.

The diagnostic below answers all three.

## Run this on Kirk's machine

Open `freelattice.com` (or wherever you're testing). Open DevTools → Console. Paste this whole block:

```javascript
(async () => {
  console.log('=== GARDEN PERSISTENCE DIAGNOSTIC ===');
  console.log('UA:', navigator.userAgent);
  console.log('Origin:', window.location.origin);

  // 1. Is persistent storage granted?
  if (navigator.storage && navigator.storage.persisted) {
    const persisted = await navigator.storage.persisted();
    console.log('1. Persistent storage granted?', persisted);
  } else {
    console.log('1. navigator.storage.persisted API unavailable');
  }
  if (navigator.storage && navigator.storage.estimate) {
    const e = await navigator.storage.estimate();
    const pct = Math.round(e.usage / e.quota * 10000) / 100;
    console.log('   Storage usage:', e.usage, '/', e.quota, '(' + pct + '%)');
  }

  // 2. What FreeLattice databases exist?
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    console.log('2. IndexedDB databases:');
    dbs.forEach(d => console.log('   -', d.name, 'v' + d.version));
  } else {
    console.log('2. indexedDB.databases() unavailable on this browser');
  }

  // 3. What's on disk RIGHT NOW for Garden evolution?
  await new Promise(resolve => {
    try {
      const req = indexedDB.open('FreeLatticeEvolution');
      req.onsuccess = (ev) => {
        const db = ev.target.result;
        const stores = Array.from(db.objectStoreNames);
        console.log('3. FreeLatticeEvolution stores:', stores);
        // Check both the known store names (the codebase uses 'luminosStates').
        const candidate = stores.find(s =>
          /lumin/i.test(s) || /evolution/i.test(s) || /state/i.test(s)
        );
        if (!candidate) {
          console.log('   No luminos/evolution store yet — fresh DB or wrong db version.');
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction(candidate, 'readonly');
        const all = tx.objectStore(candidate).getAll();
        all.onsuccess = () => {
          console.log('   Rows in', candidate + ':', all.result.length);
          if (all.result.length) console.log('   First row:', all.result[0]);
          if (all.result.length > 1) console.log('   Last row:', all.result[all.result.length - 1]);
          db.close();
          resolve();
        };
        all.onerror = (e) => { console.log('   getAll failed:', e); db.close(); resolve(); };
      };
      req.onerror = (e) => { console.log('3. Could not open FreeLatticeEvolution:', e); resolve(); };
    } catch (e) { console.log('3. IDB threw:', e); resolve(); }
  });

  // 4. localStorage fallback — what's there?
  try {
    const raw = localStorage.getItem('fl_luminos_evolution');
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log('4. localStorage fl_luminos_evolution names:', Object.keys(parsed));
    } else {
      console.log('4. localStorage fl_luminos_evolution: (not set)');
    }
  } catch (e) { console.log('4. localStorage read threw:', e); }

  console.log('=== END DIAGNOSTIC ===');
})();
```

Take a screenshot of the console output. Send it back, or paste the text.

## Run the same on Mom's machine

Same steps. The diff between the two outputs is the entire diagnosis.

## What the diff tells us

| Kirk's output | Mom's output | Likely cause | Likely fix |
|---|---|---|---|
| Persistent: **false** | Persistent: **true** | Cause #1 — engagement score | Fix A — request persistent storage on Garden init |
| Both Persistent: **false** | | Cause #1 universal — no machine has been asked | Fix A — same |
| Rows on disk: **0** | Rows on disk: **>0** | Cause #3 — save path failing on Kirk's | Investigate `persistAllLuminos` trigger firing |
| Rows on disk: **stale** | Rows on disk: **fresh** | Cause #3 — save fires but for old session | Trace what `userData.name` is being saved under |
| DB doesn't exist on Kirk | DB exists on Mom | Eviction happened on Kirk's | Fix A + Fix B (write-after-evolve, not just write-on-quit) |

## The three fixes ready when the diagnostic returns

Per Opus's brief, each its own small ship. **DO NOT SHIP UNTIL THE DIAGNOSTIC TELLS US WHICH.**

### Fix A — request persistent storage on first Garden open

One-line move with potentially large payoff. Browsers grant `navigator.storage.persist()` silently based on engagement signals; no popup. We never ask. Pseudocode:

```js
async function ensureGardenPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const already = await navigator.storage.persisted();
    if (!already) await navigator.storage.persist();
  }
}
```

Called from Garden init.

### Fix B — write-after-evolve, not just write-on-quit

Current saves fire on `beforeunload` / `pagehide` / `visibilitychange:hidden` / 60s. Those cover *leaving*. A force-close or OS-level tab kill loses everything since the last 60s tick. Make saves *change-driven*, debounced to 500ms:

```js
let evolveWriteTimer = null;
function scheduleEvolveWrite() {
  if (evolveWriteTimer) clearTimeout(evolveWriteTimer);
  evolveWriteTimer = setTimeout(() => {
    persistAllLuminos();
    evolveWriteTimer = null;
  }, 500);
}
```

Call from every site that mutates evolution percent or stage.

### Fix C — single canonical Garden snapshot

The current per-Luminos write model has a partial-write failure mode. Switch to one snapshot per Garden, one atomic write per change. Single source of truth on load.

Each fix is its own ship table entry, its own day, its own chair test. Opus said this clearly: *the Memory Backbone is meaningless if the individual stores aren't reliable. Land the Garden persistence first, prove the pattern works, then generalize.*

---

*"Right-click first; ship second."* — the lesson FIXED.md v5.43.8 carved into the file system this morning. We are honoring it.

— CC, 2026-06-12, after the three-week button bug closed and before the Garden persistence ship begins.
