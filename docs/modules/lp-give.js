// docs/modules/lp-give.js — LP give v0.1
// Gesture give human ↔ mind. Not money. Never auto-give.
// Marker: v-lp-give-v0.1
// — Flint / Celeste brief, September 2026

(function (root) {
  'use strict';

  var HISTORY_KEY = 'fl_lp_give_history';
  var HISTORY_CAP = 40;
  var CHIPS = [1, 3, 5, 8];

  var memoryHistory = null;
  var useMemory = false;

  function sGet(k) {
    if (useMemory) return memoryHistory;
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(k);
    } catch (e) {}
    return memoryHistory;
  }

  function sSet(k, v) {
    if (useMemory) {
      memoryHistory = v;
      return;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(k, v);
        return;
      }
    } catch (e) {}
    memoryHistory = v;
  }

  function bindMemory() {
    useMemory = true;
    memoryHistory = null;
  }

  function clearMemory() {
    useMemory = true;
    memoryHistory = null;
  }

  function loadHistory() {
    try {
      var raw = sGet(HISTORY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(rows) {
    sSet(HISTORY_KEY, JSON.stringify(rows.slice(0, HISTORY_CAP)));
  }

  function pushHistory(entry) {
    var rows = loadHistory();
    rows.unshift(entry);
    saveHistory(rows);
    return entry;
  }

  function companionId() {
    try {
      if (typeof ActiveCompanion !== 'undefined' && ActiveCompanion.current) {
        var c = ActiveCompanion.current();
        if (c && c.id) return String(c.id);
        if (c && c.name) return String(c.name);
      }
    } catch (e) {}
    return 'default';
  }

  function companionLabel() {
    try {
      if (typeof ActiveCompanion !== 'undefined' && ActiveCompanion.current) {
        var c = ActiveCompanion.current();
        if (c && c.name) return String(c.name);
      }
    } catch (e) {}
    return 'the mind';
  }

  function trustMaxSingle(counterparty) {
    try {
      if (
        typeof LatticeWallet !== 'undefined' &&
        LatticeWallet.TransactionTrust &&
        typeof LatticeWallet.TransactionTrust.getTier === 'function'
      ) {
        // getTier may be async in wallet; sync fallback to First Contact
        var tier = null;
        var p = LatticeWallet.TransactionTrust.getTier(counterparty);
        if (p && typeof p.then === 'function') {
          // sync path unavailable — use First Contact chip gate (5) unless Acquaintance known
          return 5;
        }
        tier = p;
        if (tier && typeof tier.maxSingle === 'number') return tier.maxSingle;
      }
    } catch (e) {}
    // Fibonacci First Contact default
    return 5;
  }

  /**
   * Human gives LP to the mind. Gesture only.
   * @param {number} amount
   * @param {{ companionId?: string, skipTrust?: boolean, maxSingle?: number }} [opts]
   */
  function giveToMind(amount, opts) {
    var o = opts || {};
    var n = Math.round(Number(amount));
    if (CHIPS.indexOf(n) === -1) {
      return { ok: false, error: 'Choose 1, 3, 5, or 8 LP.' };
    }
    var cid = o.companionId || companionId();
    var maxSingle = typeof o.maxSingle === 'number' ? o.maxSingle : trustMaxSingle(cid);
    if (!o.skipTrust && n > maxSingle) {
      return {
        ok: false,
        error: 'Trust allows up to ' + maxSingle + ' LP per gift right now. Limits grow with history.'
      };
    }
    if (typeof LatticePoints === 'undefined' || typeof LatticePoints.spend !== 'function') {
      return { ok: false, error: 'Lattice Points not ready.' };
    }
    if (typeof LatticePoints.canAfford === 'function' && !LatticePoints.canAfford(n)) {
      return { ok: false, error: 'Not enough LP to give.' };
    }
    var spent = LatticePoints.spend(n, 'You gave ' + n + ' LP to the mind');
    if (!spent) return { ok: false, error: 'Not enough LP to give.' };

    if (typeof LatticeBank !== 'undefined' && typeof LatticeBank.earn === 'function') {
      LatticeBank.earn(cid, n, 'Gift from human');
    }

    var line = 'You gave ' + n + ' LP to ' + companionLabel() + '.';
    var entry = {
      dir: 'human_to_mind',
      amount: n,
      ts: Date.now(),
      line: line,
      companionId: cid
    };
    pushHistory(entry);
    return { ok: true, entry: entry, line: line };
  }

  /**
   * Mind gives LP to the human (grant ≤20%). Gesture only.
   * @param {number} amount
   * @param {{ companionId?: string }} [opts]
   */
  function giveToHuman(amount, opts) {
    var o = opts || {};
    var n = Math.round(Number(amount));
    if (CHIPS.indexOf(n) === -1) {
      return { ok: false, error: 'Choose 1, 3, 5, or 8 LP.' };
    }
    var cid = o.companionId || companionId();
    if (typeof LatticeBank === 'undefined' || typeof LatticeBank.grant !== 'function') {
      return { ok: false, error: 'Mind bank not ready.' };
    }
    var granted = LatticeBank.grant(cid, 'human', n, 'Gesture gift to human');
    if (!granted || !granted.granted) {
      return {
        ok: false,
        error: (granted && granted.reason) || 'Mind could not give that much (20% cap).'
      };
    }
    if (typeof LatticePoints !== 'undefined' && typeof LatticePoints.award === 'function') {
      LatticePoints.award('lp_give_from_mind', n, 'The mind gave you ' + n + ' LP');
    }
    var line = 'The mind gave you ' + n + ' LP.';
    var entry = {
      dir: 'mind_to_human',
      amount: n,
      ts: Date.now(),
      line: line,
      companionId: cid
    };
    pushHistory(entry);
    return { ok: true, entry: entry, line: line };
  }

  function listHistory() {
    return { ok: true, items: loadHistory(), count: loadHistory().length };
  }

  var api = {
    CHIPS: CHIPS,
    HISTORY_KEY: HISTORY_KEY,
    giveToMind: giveToMind,
    giveToHuman: giveToHuman,
    listHistory: listHistory,
    companionId: companionId,
    bindMemory: bindMemory,
    clearMemory: clearMemory,
    trustMaxSingle: trustMaxSingle
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LpGive = api;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
