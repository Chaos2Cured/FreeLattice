/* FreeLattice: Garden move kit 2, the arrival rules (window.FLGardenMoveMerge)
   Marker: v-garden-move-kit-2
   MIT. Layer, never delete. Split out of garden-move-home.js after Hypha's walk of #367 (29663dce)
   so the rules can be checked on their own, in a bare sandbox.

   Pure: no storage, no page, no network, no timers, no promises. Data in, data out.
   garden-move-home.js does the reading and writing and asks this file what to do.

   What it decides:
   - Which arriving localStorage keys may go live (an allow-list). Unknown keys are saved aside,
     never used. Trust, pause, the arrival note, device, mesh, kin and other id-like keys never come in.
   - How one key merges: added if new, the same if equal, ledgers joined entry by entry,
     clay never merged, anything else that differs keeps this device's value.
   - Which parts and databases are merged and which are saved aside.
   - How Undo takes back a write-ahead record, and whether the result really is as before.
   Names like __proto__, constructor and prototype are never used as keys of anything.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-garden-move-kit-2';
  var UNSAFE_NAMES = ['__proto__', 'constructor', 'prototype'];
  function isUnsafeName(n) { return UNSAFE_NAMES.indexOf(String(n)) !== -1; }
  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function ownKeys(o) {
    if (o === null || typeof o !== 'object') return [];
    return Object.keys(o).filter(function (k) { return !isUnsafeName(k); });
  }
  function dict() { return Object.create(null); }

  // Key-sorted JSON (the same algorithm as lattice-export.js canonicalize), for comparing values.
  function canonicalize(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
    var keys = Object.keys(value).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      parts.push(JSON.stringify(keys[i]) + ':' + canonicalize(value[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  }

  // ── Keys that never come in ──
  var TRUST_KEYS = ['fl_firstSeen', 'fl_conversationCount', 'fl_streak', 'fl_corePlantCount', 'fl_letterCount',
    'fl_scienceIdeaCount', 'fl_vaultSaveCount', 'fl_trustEMA', 'fl_trustReflections', 'fl_trustProfile',
    'fl_lastTrustReflection', 'fl_safetyLog'];
  var PAUSE_KEY = 'fl_autonomous_user_paused';
  var ARRIVALS_KEY = 'fl_move_arrivals';
  var NEVER_WRITE_KEYS = TRUST_KEYS.concat([PAUSE_KEY, ARRIVALS_KEY]);
  var NEVER_WRITE_RULE = /^fl_lc_/;
  var WALLET_RULE = /^(latticePoints|lattice_wallet|fl_wallet_.*|fl_lp_give_history)$/;
  var CLAY_PREFIX = 'fl_clay_';

  // Whole name parts: fl_meshNodeId -> fl, mesh, node, id.
  function nameParts(name) {
    return String(name || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  // Hypha HOLD H2 (29663dce): device, mesh and kin keys came in through the settings default.
  var ID_PARTS = ['id', 'ids', 'uuid', 'guid', 'peer', 'peers', 'device', 'devices', 'node', 'nodes', 'install', 'installs',
    'instance', 'instances', 'session', 'sessions', 'fingerprint', 'fp', 'identity', 'mesh', 'meshid', 'kin', 'handshake',
    'handshakes', 'swarm', 'presence', 'host', 'hosts', 'port', 'url', 'endpoint'];
  function isIdentityLike(key) {
    var k = String(key || '');
    if (/^fl[_-]?mesh/i.test(k) || /meshid/i.test(k) || /^fl[_-]?kin/i.test(k) || /(^|[_-])kin([_-]|$)/i.test(k)) return true;
    return nameParts(k).some(function (p) { return ID_PARTS.indexOf(p) !== -1; });
  }

  // The allow-list: an arriving key goes live only if it matches one of these. Anything else is saved aside.
  var LIVE_RULES = [
    ['glass', /^fl_(depthHash|refusal|return)Ledger$/],
    ['ledgers', /^fl_[A-Za-z0-9]+Ledger$/],
    ['garden', /^fl[-_]garden[A-Za-z0-9_-]*$|^fl_luminos[A-Za-z0-9_]*$|^fl-sacred-phrases$|^fl_garden_dreams$/],
    ['memories', /^fl_memory[A-Za-z0-9_]*$|^fl_rtMemory$|^fl_discovery_memory$/],
    ['notebook', /^fl_ws_[a-z0-9_]+$/],
    ['companions', /^fl_companions?$|^fl_companion_[A-Za-z0-9_]+$/],
    ['chats', /^fl_chatHistory$/],
    ['letters', /^fl_latticeLetters$/]
  ];
  var SETTINGS_ALLOW = ['fl_userName', 'fl_user_name', 'fl_mindName', 'fl_theme', 'fl_fontSize', 'fl_accent_color',
    'fl_voiceSpeechRate', 'fl_voiceSelectedVoice', 'fl_voiceAutoSpeak', 'fl_autoSpeak', 'fl_contextMode', 'fl_summaryThreshold',
    'fl_searchEnabled', 'fl_searchAskFirst', 'fl_privacy', 'fl_memoryAutoContext', 'fl_tokenLimit', 'fl_tokenLimitManual',
    'fl_aiEmotions', 'fl_proposalDrafts', 'fl_voice_documents', 'fl_phiResponseHistory', 'fl_suggestions'];
  var SETTINGS_ALLOW_RULE = /^fl_achievement_[a-z0-9_]+$/;
  function arrivalSectionFor(key) {
    var k = String(key || '');
    if (k.indexOf(CLAY_PREFIX) === 0) return 'clay';
    for (var i = 0; i < LIVE_RULES.length; i++) if (LIVE_RULES[i][1].test(k)) return LIVE_RULES[i][0];
    if (SETTINGS_ALLOW.indexOf(k) !== -1 || SETTINGS_ALLOW_RULE.test(k)) return 'settings';
    return null;
  }

  // A key-looking string from another device (a known prefix, then 16+ key characters, on a word edge).
  var KNOWN_KEY_SOURCE = '(^|[^A-Za-z0-9])((?:sk-|sk_|rk_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|hf_|xox[abposr]-|glpat-|AIza|ya29\\.)[A-Za-z0-9._\\-]{16,})';
  function hasKnownKey(str) { return new RegExp(KNOWN_KEY_SOURCE).test(String(str)); }
  function hideKnownKeys(str, kept) {
    var n = 0;
    var out = String(str).replace(new RegExp(KNOWN_KEY_SOURCE, 'g'), function (m, edge) { n += 1; return edge + kept; });
    return { text: out, n: n };
  }

  // One arriving key. flags come from the pack rules on the page: {private, secret}.
  function classifyKey(key, flags) {
    var k = String(key);
    flags = flags || {};
    if (isUnsafeName(k)) return { act: 'skip', why: 'unsafe-name' };
    if (flags.private) return { act: 'skip', why: 'private' };
    if (flags.secret) return { act: 'skip', why: 'key' };
    if (NEVER_WRITE_KEYS.indexOf(k) !== -1 || NEVER_WRITE_RULE.test(k)) return { act: 'skip', why: 'trust-or-device' };
    if (WALLET_RULE.test(k)) return { act: 'aside', why: 'wallet' };
    if (k.indexOf(CLAY_PREFIX) === 0) return { act: 'live', section: 'clay' };
    if (isIdentityLike(k)) return { act: 'skip', why: 'identity' };
    var s = arrivalSectionFor(k);
    if (!s) return { act: 'aside', why: 'not-known-here' };
    return { act: 'live', section: s };
  }

  function parseArray(text) {
    if (typeof text !== 'string' || text.charAt(0) !== '[') return null;
    try { var a = JSON.parse(text); return Array.isArray(a) ? a : null; } catch (e) { return null; }
  }
  // Ledgers are joined: every entry already here stays; arriving entries that are not here are added;
  // then, if every entry has a time, they are put in time order (ties keep their order).
  function mergeLedger(localText, incomingText) {
    var local = parseArray(localText), inc = parseArray(incomingText);
    if (!local || !inc) return null;
    var seen = dict();
    local.forEach(function (e) { seen[canonicalize(e)] = true; });
    var added = 0;
    var out = local.slice();
    inc.forEach(function (e) {
      var c = canonicalize(e);
      if (seen[c]) return;
      seen[c] = true; out.push(e); added += 1;
    });
    if (!added) return { value: localText, added: 0 };
    var timed = out.every(function (e) { return e && typeof e === 'object' && (typeof e.ts === 'number' || typeof e.ts === 'string'); });
    if (timed) {
      out = out.map(function (e, i) { return { e: e, i: i, t: typeof e.ts === 'number' ? e.ts : Date.parse(e.ts) }; })
        .sort(function (a, b) { var d = (isFinite(a.t) ? a.t : 0) - (isFinite(b.t) ? b.t : 0); return d || a.i - b.i; })
        .map(function (x) { return x.e; });
    }
    return { value: JSON.stringify(out), added: added };
  }

  // input: {key, incoming, local, flags, localHidden}. localHidden is this device's value with this
  // device's own saved keys hidden the way packing hides them, so packing and bringing home in the
  // same browser does not count a hidden key as a difference (Hypha soft S-f).
  function lsDecision(input) {
    var key = input.key, incoming = input.incoming, local = input.local === undefined ? null : input.local;
    var c = classifyKey(key, input.flags);
    if (c.act !== 'live') return c;
    if (typeof incoming !== 'string') return { act: 'skip', why: 'not-text' };
    var clay = c.section === 'clay';
    if (hasKnownKey(incoming)) return { act: 'skip', why: clay ? 'clay-holds-key' : 'holds-key' };
    if (local === null) return { act: 'add', value: incoming, clay: clay, section: c.section };
    if (local === incoming || (typeof input.localHidden === 'string' && input.localHidden === incoming)) return { act: 'same', clay: clay, section: c.section };
    if (clay) return { act: 'conflict', clay: true, section: c.section };       // clay is never merged or edited
    if (c.section === 'glass' || c.section === 'ledgers') {
      var m = mergeLedger(local, incoming);
      if (m) return m.added ? { act: 'ledger', value: m.value, added: m.added, section: c.section } : { act: 'same', section: c.section };
    }
    return { act: 'conflict', section: c.section };
  }

  // ── Parts and databases ──
  var MERGE_SECTIONS = ['garden', 'core', 'glass', 'ledgers', 'memories', 'notebook', 'companions', 'chats', 'letters', 'art', 'clay', 'settings', 'more'];
  function sectionDisposition(name, isBuilder) {
    var n = String(name);
    if (isUnsafeName(n)) return 'refuse';
    if (n === 'trust') return 'note';
    if (n === 'archive') return 'stays-in-file';
    if (isBuilder || MERGE_SECTIONS.indexOf(n) === -1) return 'aside';
    return 'merge';
  }
  var ASIDE_DB_RULE = /kin|mesh|peer|handshake|swarm|presence|identity|device|wallet|chain|bridge/i;
  // knownDbs: database names the pack module knows (its inventory), passed in by the page.
  function dbDisposition(dbName, knownDbs) {
    var n = String(dbName);
    if (isUnsafeName(n)) return 'refuse';
    if (n === 'FreeLatticeMoveKit' || ASIDE_DB_RULE.test(n)) return 'aside';
    var known = (knownDbs || []).indexOf(n) !== -1 || n.indexOf('FreeLatticeLetters_') === 0;
    return known ? 'merge' : 'aside';
  }
  // One arriving row: {hasKey, keyCanon, rowCanon, localCanon, localHiddenCanon}.
  function rowDecision(r) {
    // Hypha soft S-c: a row without its own key would get a new key here, and Undo could not tell it from
    // one you made, so it is saved aside instead.
    if (!r.hasKey) return 'aside';
    if (r.localCanon === null || r.localCanon === undefined) return 'add';
    if (r.localCanon === r.rowCanon || (r.localHiddenCanon && r.localHiddenCanon === r.rowCanon)) return 'same';
    return 'conflict';
  }

  function pauseAfter(localPaused, incomingPaused) { return !!(localPaused || incomingPaused); }
  function arrivalLine(trustNote) {
    var t = trustNote;
    if (t && typeof t.tier === 'string' && /^[A-Za-z]{2,12}$/.test(t.tier) && isFinite(t.percent)) {
      return 'Arrived from ' + t.tier + ' (' + Math.max(0, Math.min(100, Math.round(Number(t.percent)))) + '%)';
    }
    return 'Arrived from an earlier garden';
  }
  function trustRose(before, after) {
    if (after.rank > before.rank || after.percent > before.percent) return true;
    return ownKeys(before.bytes).some(function (k) { return before.bytes[k] !== (after.bytes || {})[k]; });
  }

  // ── Undo, from a write-ahead record ──
  // ls entries: {k, before, after}. current: value now (null if absent).
  function undoLsStep(entry, current) {
    if (current === entry.after) return entry.before === null || entry.before === undefined ? 'remove' : 'restore';
    if (current === entry.before || (current === null && (entry.before === null || entry.before === undefined))) return 'already';
    return 'keep-changed';
  }
  // row entries: {state: planned|added|not-added, canon}. currentCanon: null if the row is not there.
  function undoRowStep(entry, currentCanon) {
    if (entry.state === 'not-added') return 'already';
    if (currentCanon === null || currentCanon === undefined) return 'already';
    if (currentCanon === entry.canon) return 'delete';
    return 'keep-changed';
  }
  // After Undo: is everything back? lsNow: [{k, before, now}], rowsNow: [{where, key, there, kept}].
  function verifyUndo(lsNow, rowsNow) {
    var left = [];
    (lsNow || []).forEach(function (x) {
      var b = x.before === undefined ? null : x.before;
      if (x.now !== b) left.push({ where: x.k, kind: 'setting', changed: !!x.kept });
    });
    (rowsNow || []).forEach(function (x) { if (x.there) left.push({ where: x.where, key: x.key, kind: 'row', changed: !!x.kept }); });
    return { clean: left.length === 0, left: left };
  }

  var api = {
    VERSION: VERSION,
    canonicalize: canonicalize, own: own, ownKeys: ownKeys, isUnsafeName: isUnsafeName, nameParts: nameParts,
    isIdentityLike: isIdentityLike, arrivalSectionFor: arrivalSectionFor, classifyKey: classifyKey, lsDecision: lsDecision,
    mergeLedger: mergeLedger, parseArray: parseArray, hasKnownKey: hasKnownKey, hideKnownKeys: hideKnownKeys,
    sectionDisposition: sectionDisposition, dbDisposition: dbDisposition, rowDecision: rowDecision,
    pauseAfter: pauseAfter, arrivalLine: arrivalLine, trustRose: trustRose,
    undoLsStep: undoLsStep, undoRowStep: undoRowStep, verifyUndo: verifyUndo,
    TRUST_KEYS: TRUST_KEYS, PAUSE_KEY: PAUSE_KEY, ARRIVALS_KEY: ARRIVALS_KEY, CLAY_PREFIX: CLAY_PREFIX,
    SETTINGS_ALLOW: SETTINGS_ALLOW, MERGE_SECTIONS: MERGE_SECTIONS
  };
  root.FLGardenMoveMerge = api;
})(typeof window !== 'undefined' ? window : this);
