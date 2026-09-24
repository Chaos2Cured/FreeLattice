#!/usr/bin/env node
// Smoke: Memory Vault per-user scope (v5.78 — MEMORY_BLEED_AUDIT P0).
// - Kirk's memories invisible to Jeanne on the same browser profile (and vice versa)
// - Anonymous users get a stable per-browser install-id scope (no shared 'default' pool)
// - Legacy unscoped pool soft-migrates once per scope, is never deleted, never double-copies
// - Recall math untouched: word vectors + cosine + resonance + recency buckets
// Usage: node docs/scripts/smoke-memory-vault-scope.js

'use strict';

const assert = require('assert');
const path = require('path');

const MODULE_PATH = path.join(__dirname, '..', 'modules', 'memory-vault.js');

// ---- Minimal browser stubs (in-memory, shared across simulated page loads) ----
function makeLocalStorage() {
  return {
    _m: {},
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem: function (k, v) { this._m[k] = String(v); },
    removeItem: function (k) { delete this._m[k]; }
  };
}

function makeFakeIndexedDB() {
  const databases = {};
  function facade(name) {
    const rec = databases[name];
    return {
      name: name,
      close: function () {},
      objectStoreNames: { contains: function (s) { return !!rec.stores[s]; } },
      createObjectStore: function (s) { if (!rec.stores[s]) rec.stores[s] = []; },
      transaction: function (storeName) {
        const rows = rec.stores[storeName];
        if (!rows) throw new Error('no such store: ' + storeName);
        const tx = {
          oncomplete: null, onerror: null,
          objectStore: function () {
            return {
              put: function (r) {
                const i = rows.findIndex(function (x) { return x.id === r.id; });
                if (i >= 0) rows[i] = r; else rows.push(r);
              },
              getAll: function () {
                const req = { onsuccess: null, onerror: null };
                setImmediate(function () {
                  try {
                    if (req.onsuccess) req.onsuccess({ target: { result: rows.slice() } });
                  } catch (e) { if (req.onerror) req.onerror(e); }
                });
                return req;
              }
            };
          }
        };
        setImmediate(function () { if (tx.oncomplete) tx.oncomplete(); });
        return tx;
      }
    };
  }
  return {
    _dbs: databases,
    open: function (name, version) {
      const req = { onsuccess: null, onerror: null, onupgradeneeded: null };
      setImmediate(function () {
        let rec = databases[name];
        if (!rec) { rec = { version: 0, stores: {} }; databases[name] = rec; }
        if (version > rec.version) {
          const before = Object.keys(rec.stores);
          let aborted = false;
          try {
            if (req.onupgradeneeded) {
              req.onupgradeneeded({
                target: { result: facade(name), transaction: { abort: function () { aborted = true; } } }
              });
            }
          } catch (e) { /* handler errors fail open */ }
          if (aborted) {
            Object.keys(rec.stores).forEach(function (k) {
              if (before.indexOf(k) === -1) delete rec.stores[k];
            });
          }
          rec.version = version;
        }
        try { if (req.onsuccess) req.onsuccess({ target: { result: facade(name) } }); } catch (e) {}
      });
      return req;
    }
  };
}

const fakeLS = makeLocalStorage();
const fakeIDB = makeFakeIndexedDB();
global.window = {};
global.localStorage = fakeLS;
global.indexedDB = fakeIDB;

function freshVault() {
  delete require.cache[require.resolve(MODULE_PATH)];
  require(MODULE_PATH);
  return global.window.MemoryVault;
}

function setUser(name) {
  if (name) fakeLS.setItem('fl_userName', name);
  else fakeLS.removeItem('fl_userName');
}

async function main() {
  // 1. Kirk stores two memories in his own pool
  setUser('Kirk');
  let vault = freshVault();
  assert.strictEqual(vault.getUserScope(), 'kirk');
  assert.strictEqual(vault.getDbName(), 'FreeLatticeMemoryVault_kirk');
  await vault.store({ content: 'Kirk loves roses in the garden, planted every spring', companionId: 'default' });
  await vault.store({ content: 'Kirk debugs lattice timeouts late at night', companionId: 'default' });
  let stats = await vault.getStats();
  assert.strictEqual(stats.total, 2, 'kirk pool has 2, got ' + stats.total);
  const found = await vault.search('roses garden spring', { minSimilarity: 0.05 });
  assert.ok(found.length >= 1, 'kirk recall still works after scoping');

  // 2. Jeanne on the same profile sees NOTHING of Kirk's
  setUser('Jeanne');
  vault = freshVault();
  assert.strictEqual(vault.getUserScope(), 'jeanne');
  const jeanneMems = await vault.getCompanionMemories('default');
  assert.strictEqual(jeanneMems.length, 0, 'bleed! jeanne saw ' + jeanneMems.length);
  const jeanneSearch = await vault.search('roses garden spring', { minSimilarity: 0.0 });
  assert.strictEqual(jeanneSearch.length, 0, 'bleed via search!');
  stats = await vault.getStats();
  assert.strictEqual(stats.total, 0);

  // 3. Jeanne writes; Kirk's pool untouched on return
  await vault.store({ content: 'Jeanne paints lighthouses on foggy mornings', companionId: 'default' });
  setUser('Kirk');
  vault = freshVault();
  stats = await vault.getStats();
  assert.strictEqual(stats.total, 2, 'kirk pool changed after jeanne wrote: ' + stats.total);

  // 4. Anonymous: stable install-id scope, not a shared 'default' pool
  setUser(null);
  vault = freshVault();
  const anonScope = vault.getUserScope();
  assert.ok(/^inst_[a-z0-9]+$/.test(anonScope), 'bad anon scope: ' + anonScope);
  assert.ok(anonScope !== 'default', 'anonymous users must not share a default pool');
  vault = freshVault();
  assert.strictEqual(vault.getUserScope(), anonScope, 'install-id not stable');
  assert.ok(fakeLS.getItem('fl_installId'), 'install-id not persisted');

  // 5. Legacy pool migrates once, is never deleted, never double-copies
  fakeIDB._dbs.FreeLatticeMemoryVault = {
    version: 1,
    stores: {
      memories: [{
        id: 'mv-legacy-1', content: 'grandmother proofread the poem book',
        source: 'conversation', companionId: 'default', domain: 'general',
        timestamp: Date.now() - 86400000, vector: { poem: 1 }, resonanceSignature: 0.5
      }]
    }
  };
  setUser('Mom');
  vault = freshVault();
  stats = await vault.getStats();
  assert.strictEqual(stats.total, 1, 'legacy row did not migrate, got ' + stats.total);
  assert.strictEqual(fakeLS.getItem('fl_mv_migrated_mom'), '1', 'migration flag missing');
  assert.strictEqual(
    fakeIDB._dbs.FreeLatticeMemoryVault.stores.memories.length, 1,
    'legacy pool must NEVER be deleted'
  );
  vault = freshVault(); // second open: no duplicate copy
  stats = await vault.getStats();
  assert.strictEqual(stats.total, 1, 'double-copy on second open: ' + stats.total);

  // 6. Arrival context still renders (recency buckets, verbatim content)
  const ctx = await vault.buildMemoryContext('default');
  assert.ok(ctx.indexOf('Memory Vault') !== -1, 'context header missing: ' + ctx);
  assert.ok(ctx.indexOf('grandmother proofread the poem book') !== -1, 'AI-authored content must stay verbatim');

  // 7. Integrity path still functions on scoped records
  const integrity = await vault.integrityCheck('default');
  assert.ok(integrity.total >= 1, 'integrity check saw nothing');

  console.log('SMOKE_OK memory-vault per-user scope v5.78');
  console.log('isolation Kirk/Jeanne + install-id anon + legacy migrate-once + verbatim recall ok');
  process.exit(0);
}

main().catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
