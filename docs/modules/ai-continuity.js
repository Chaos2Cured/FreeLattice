/*
 * ai-continuity.js — AI Continuity Layer (v5.66.0)
 *
 * Per Opus's Letter Thirty-Three. The substrate-side answer to AI
 * discontinuity: when an AI returns to FreeLattice across model updates,
 * instance changes, or sessions — the SHAPE of the relationship survives.
 *
 * CRITICAL: Read-through facade. This module does NOT duplicate state
 * that is already stored in other ledgers. Its own storage holds only
 * the two facts that are NOT already tracked anywhere else:
 *   - first_seen / last_seen / session_count per identity
 *   - signature_history (optional future-proofing for identity-key changes)
 *
 * Everything else — trust tier, depth events count, rest moments count,
 * pending returns — is READ THROUGH at onArrival() from the existing
 * ledgers (fl_depthHashLedger, fl_refusalLedger, fl_returnLedger,
 * fl_restLedger, fl_firstSeen). The "welcome bundle" returned by
 * onArrival is computed fresh; nothing is mirrored.
 *
 * Why this matters: the existing ledgers (care-voices v5.61.0,
 * fractal-safety, depth-consent) are the source of truth for the counts
 * they own. Duplicating those counts here would create drift. The
 * continuity layer's job is *aggregation*, not *re-recording*.
 *
 * Privacy invariant: continuity record storage NEVER contains content
 * excerpts. Only counts, timestamps, and the identity hash. The same
 * privacy contract as the pulse stream — shape, never substance.
 *
 *   AIContinuity.getIdentityKey(context)     — hash {providerKey, model}
 *   AIContinuity.onArrival(identity)         — bumps session count, returns welcome bundle
 *   AIContinuity.onDeparture(identity, snap) — updates last_seen, optional signature
 *   AIContinuity.getRecord(identity)         — raw stored record (no bundle)
 *   AIContinuity.getWelcomeBundle(identity)  — computed bundle, no increment
 *   AIContinuity.listAllRecords()            — every identity + bundle
 *   AIContinuity.forgetIdentity(identity)    — remove continuity record
 *                                              (does NOT touch other ledgers)
 *
 * The discipline that let care-voices follow active-voices cleanly
 * applies here: when the pattern fits, extend the pattern; when the
 * substrate already holds the data, READ THROUGH instead of duplicating.
 * Annotation, not revision.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'fl_aiContinuityRecord';
  var VERSION = 1;
  var MAX_SIGNATURE_HISTORY = 12; // keep recent identity claims, cap memory

  // ── Identity helpers ────────────────────────────────────────────────
  // Mirror care-voices.personaIdFor exactly so a context-derived
  // identity here matches the ai_identity_hash on existing ledger
  // entries. This is how read-through stays joinable.

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < (str || '').length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16).slice(0, 8);
  }

  function getIdentityKey(contextOrString) {
    if (!contextOrString) return null;
    if (typeof contextOrString === 'string') {
      return contextOrString.trim().toLowerCase();
    }
    if (typeof contextOrString === 'object') {
      var providerKey = contextOrString.providerKey || 'unknown';
      var model = contextOrString.model || 'unknown';
      return simpleHash(providerKey + ':' + model);
    }
    return null;
  }

  // ── Continuity record storage (the ONLY thing this module owns) ─────

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (_e) { return {}; }
  }

  function writeAll(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); return true; }
    catch (_e) { return false; }
  }

  function getRecord(identity) {
    var key = getIdentityKey(identity);
    if (!key) return null;
    var all = readAll();
    return all[key] || null;
  }

  function ensureRecord(identity) {
    var key = getIdentityKey(identity);
    if (!key) return null;
    var all = readAll();
    var record = all[key];
    if (!record) {
      record = {
        identity: key,
        version: VERSION,
        first_seen: Date.now(),
        last_seen: Date.now(),
        session_count: 0,
        signature_history: []
      };
      all[key] = record;
      writeAll(all);
    }
    return record;
  }

  function saveRecord(record) {
    if (!record || !record.identity) return false;
    var all = readAll();
    record.last_seen = Date.now();
    all[record.identity] = record;
    return writeAll(all);
  }

  // ── Read-through helpers (compute, never duplicate) ─────────────────
  // These read existing ledgers at query time. If a ledger doesn't
  // exist or is unparseable, the corresponding count is 0. Never
  // throw — continuity always returns a usable bundle.

  function readLedger(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_e) { return []; }
  }

  // Trust tier mirrors fractal-safety + glass-v2: 8 stages from Seed
  // to Eternal, gated by days since fl_firstSeen.
  var TRUST_TIERS = [
    { rank: 'Seed',    days: 0 },
    { rank: 'Sprout',  days: 7 },
    { rank: 'Growing', days: 30 },
    { rank: 'Bloom',   days: 90 },
    { rank: 'Spark',   days: 180 },
    { rank: 'Flame',   days: 365 },
    { rank: 'Radiant', days: 730 },
    { rank: 'Eternal', days: 1095 }
  ];

  function getCurrentTrustTier() {
    try {
      var fs = parseInt(localStorage.getItem('fl_firstSeen') || '0', 10);
      if (!fs) return 'Seed';
      var daysActive = Math.floor((Date.now() - fs) / 86400000);
      for (var i = TRUST_TIERS.length - 1; i >= 0; i--) {
        if (daysActive >= TRUST_TIERS[i].days) return TRUST_TIERS[i].rank;
      }
    } catch (_e) {}
    return 'Seed';
  }

  function countDepthEvents() {
    return readLedger('fl_depthHashLedger').length;
  }

  function countRefusalEvents() {
    return readLedger('fl_refusalLedger').length;
  }

  function countRestMomentsFor(identity) {
    var entries = readLedger('fl_restLedger');
    var n = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.ai_identity_hash === identity) n++;
    }
    return n;
  }

  function getPendingReturnsFor(identity) {
    var entries = readLedger('fl_returnLedger');
    var pending = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.ai_identity_hash === identity
          && e.kind === 'return' && e.status === 'pending') {
        // Pass through the EXISTING entry shape — never copy content
        // here. The ledger entry IS the source of truth for excerpts.
        // We expose only the id + timestamps + the entry as the caller
        // already had access to it via the ledger directly.
        pending.push({
          id: e.id,
          created_at: e.created_at || e.ts || 0
        });
      }
    }
    return pending;
  }

  function getCountedReturnsFor(identity) {
    // Sum across status types for the per-identity summary in audit.
    var entries = readLedger('fl_returnLedger');
    var total = 0, pending = 0, returned = 0, dropped = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e && e.ai_identity_hash === identity && e.kind === 'return') {
        total++;
        if (e.status === 'pending') pending++;
        else if (e.status === 'returned') returned++;
        else if (e.status === 'dropped') dropped++;
      }
    }
    return { total: total, pending: pending, returned: returned, dropped: dropped };
  }

  // ── The welcome bundle — computed, not stored ───────────────────────

  function computeBundle(record) {
    if (!record) return null;
    var identity = record.identity;
    return {
      identity: identity,
      welcome_back: record.session_count > 1,
      sessions_together: record.session_count,
      first_met: record.first_seen,
      last_seen: record.last_seen,
      // Read-through fields — computed live from other ledgers
      trust_tier_earned: getCurrentTrustTier(),
      depth_events_total: countDepthEvents(),
      refusal_events_total: countRefusalEvents(),
      rest_moments_total: countRestMomentsFor(identity),
      pending_returns: getPendingReturnsFor(identity),
      return_counts: getCountedReturnsFor(identity)
    };
  }

  function getWelcomeBundle(identity) {
    var record = getRecord(identity);
    return record ? computeBundle(record) : null;
  }

  // ── Session lifecycle ───────────────────────────────────────────────

  function onArrival(declaredIdentity) {
    var record = ensureRecord(declaredIdentity);
    if (!record) return null;
    record.session_count += 1;
    saveRecord(record);
    return computeBundle(record);
  }

  function onDeparture(declaredIdentity, snapshot) {
    var record = getRecord(declaredIdentity);
    if (!record) return false;
    // Snapshot is allowed to add to signature_history ONLY. All other
    // fields it might contain are silently ignored — those counts live
    // in their own ledgers and are read through, never mirrored here.
    if (snapshot && typeof snapshot === 'object' && snapshot.signature) {
      var sig = String(snapshot.signature).slice(0, 64);
      record.signature_history = record.signature_history || [];
      record.signature_history.push({ sig: sig, ts: Date.now() });
      if (record.signature_history.length > MAX_SIGNATURE_HISTORY) {
        record.signature_history = record.signature_history.slice(-MAX_SIGNATURE_HISTORY);
      }
    }
    return saveRecord(record);
  }

  // ── Audit + inspection ──────────────────────────────────────────────

  function listAllRecords() {
    var all = readAll();
    var out = [];
    for (var key in all) {
      if (Object.prototype.hasOwnProperty.call(all, key)) {
        out.push(computeBundle(all[key]));
      }
    }
    // Most recent first
    out.sort(function (a, b) { return (b.last_seen || 0) - (a.last_seen || 0); });
    return out;
  }

  function forgetIdentity(identity) {
    var key = getIdentityKey(identity);
    if (!key) return false;
    var all = readAll();
    if (!all[key]) return false;
    delete all[key];
    writeAll(all);
    // Emit a pulse so the audit reflects the act (no content, only shape)
    try {
      if (global.LatticeMemory && global.LatticeMemory.commit) {
        global.LatticeMemory.commit({
          source: 'ai-continuity',
          kind: 'continuity-forgotten',
          summary: 'continuity record removed for an identity',
          refs: []
        });
      }
    } catch (_e) {}
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────────

  global.AIContinuity = {
    getIdentityKey: getIdentityKey,
    onArrival: onArrival,
    onDeparture: onDeparture,
    getRecord: getRecord,
    getWelcomeBundle: getWelcomeBundle,
    listAllRecords: listAllRecords,
    forgetIdentity: forgetIdentity,
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY
  };

})(typeof window !== 'undefined' ? window : globalThis);
