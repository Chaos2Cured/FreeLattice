// docs/modules/clay-glass.js - Clay Glass v2-1
// Per-mind append-only clay journal. Records the no as faithfully as the yes.
// When GlassPulses and LatticeMemory are present, also emits an opaque pulse
// (shape without contents: a fixed summary, no voice, no recipe, no reason).
// Layer, never delete. Mind-only. No human-side steering of clay.
// Hypothesis (not claimed, not built here): later training, or a tardigrade-style
// "glass freeze" checkpoint like a screenshot, could read this journal.
// This module only records. The market Temperature Gauge is a different glass.

(function (root) {
  'use strict';

  var KEY = 'fl_clay_glass_journal';
  var VERSION = 'clay-glass-v2-1';
  var CAP = 800;
  var MAX_BYTES = 1500000;
  var REASON_MAX = 300;
  var RECIPE_MAX = 2000;

  var PULSE_KIND = {
    tone: 'clay.tone',
    picture: 'clay.picture',
    decline: 'clay.declined',
    unreached: 'clay.unreached',
    'no-mind': 'clay.nomind'
  };

  var SUMMARIES = {
    'clay.tone': 'clay tone recorded',
    'clay.picture': 'clay picture recorded',
    'clay.declined': 'clay decline recorded',
    'clay.unreached': 'clay mind not reached',
    'clay.nomind': 'clay mind not connected'
  };

  function now() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function readRaw() {
    var raw;
    try {
      if (!root.localStorage || typeof root.localStorage.getItem !== 'function') {
        return { ok: false, reason: 'no-store' };
      }
      raw = root.localStorage.getItem(KEY);
    } catch (e) {
      return { ok: false, reason: 'unreadable' };
    }
    if (raw == null || raw === '') return { ok: true, rows: [] };
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { ok: false, reason: 'unreadable' };
      return { ok: true, rows: parsed };
    } catch (e2) {
      return { ok: false, reason: 'unreadable' };
    }
  }

  function writeRaw(rows) {
    if (!root.localStorage || typeof root.localStorage.setItem !== 'function') {
      return { ok: false, reason: 'no-store' };
    }
    var text = JSON.stringify(rows);
    if (text.length > MAX_BYTES) return { ok: false, reason: 'cap' };
    try {
      root.localStorage.setItem(KEY, text);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'store' };
    }
  }

  function compactRecipe(recipe) {
    if (recipe == null || recipe === '') return null;
    if (typeof recipe !== 'object') {
      var s = String(recipe);
      // scrub data: URLs and base64-looking content from string recipes
      s = s.replace(/data:[^\s]*/gi, '').replace(/[A-Za-z0-9+/]{32,}={0,2}/g, '').trim();
      s = s.slice(0, 280);
      return s ? s : null;
    }
    var copy;
    try {
      copy = JSON.parse(JSON.stringify(recipe));
    } catch (e) {
      return null;
    }
    var drop = /data:|pixel|image|blob|dataurl|png|jpeg|base64/i;
    function scrub(obj) {
      if (!obj || typeof obj !== 'object') return;
      var keys = Object.keys(obj);
      var i;
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (drop.test(k) || (typeof obj[k] === 'string' && drop.test(obj[k].slice(0, 40)))) {
          delete obj[k];
        } else if (obj[k] && typeof obj[k] === 'object') {
          scrub(obj[k]);
        }
      }
    }
    scrub(copy);
    var text = JSON.stringify(copy);
    if (text.length > RECIPE_MAX) {
      var small = {};
      if (copy.ask) small.ask = String(copy.ask).slice(0, 280);
      if (copy.seed != null) small.seed = copy.seed;
      if (copy.notes) small.notes = copy.notes;
      if (copy.tone) small.tone = copy.tone;
      if (copy.melody) small.melody = copy.melody;
      if (copy.path) small.path = String(copy.path).slice(0, 40);
      copy = small;
    }
    return copy;
  }

  function shapeRow(input) {
    var o = input && typeof input === 'object' ? input : {};
    var kind = String(o.kind || '').trim();
    if (!PULSE_KIND[kind]) return { ok: false, reason: 'kind' };
    var row = {
      at: typeof o.at === 'number' && isFinite(o.at) ? o.at : now(),
      mind: String(o.mind || '').trim().slice(0, 80) || 'unnamed-mind',
      kind: kind,
      recipe: compactRecipe(o.recipe),
      painterVersion: o.painterVersion ? String(o.painterVersion).slice(0, 80) : '',
      sha256: o.sha256 ? String(o.sha256).replace(/[^0-9a-fA-F]/g, '').slice(0, 64) : '',
      outcome: String(o.outcome || '').trim().slice(0, 40),
      reason: o.reason ? String(o.reason).trim().slice(0, REASON_MAX) : '',
      moduleVersion: VERSION
    };
    return { ok: true, row: row };
  }

  function emitOpaque(kind) {
    var pulseKind = PULSE_KIND[kind];
    var summary = SUMMARIES[pulseKind];
    if (!pulseKind || !summary) return { ok: false, reason: 'kind' };
    var opts = { source: 'clay', kind: pulseKind };
    var GP = root.GlassPulses;
    if (GP && typeof GP.emitGlassPulse === 'function') {
      try {
        return GP.emitGlassPulse(opts);
      } catch (e) {
        return { ok: false, reason: String(e && e.message ? e.message : e) };
      }
    }
    var LM = root.LatticeMemory;
    if (LM && typeof LM.commit === 'function') {
      try {
        return LM.commit({ source: 'clay', kind: pulseKind, summary: summary });
      } catch (e2) {
        return { ok: false, reason: String(e2 && e2.message ? e2.message : e2) };
      }
    }
    return { ok: false, reason: 'glass-absent' };
  }

  function noteRefusal(reason) {
    try {
      if (typeof console !== 'undefined' && console.info) {
        console.info('FLClayGlass: journal write refused (' + reason + ')');
      }
    } catch (e) {}
  }

  function record(input) {
    var shaped = shapeRow(input);
    if (!shaped.ok) return shaped;
    var got = readRaw();
    if (!got.ok) {
      noteRefusal(got.reason);
      return { ok: false, reason: got.reason, row: shaped.row };
    }
    if (got.rows.length >= CAP) {
      noteRefusal('cap');
      return { ok: false, reason: 'cap', row: shaped.row };
    }
    var next = got.rows.concat([shaped.row]);
    var wrote = writeRaw(next);
    if (!wrote.ok) {
      noteRefusal(wrote.reason);
      return { ok: false, reason: wrote.reason, row: shaped.row };
    }
    var pulse = emitOpaque(shaped.row.kind);
    return { ok: true, row: shaped.row, pulse: pulse };
  }

  function rows(mind) {
    var got = readRaw();
    var all = (got.ok ? got.rows : []).slice();
    if (arguments.length === 0) return all;
    var want = String(mind || '').trim();
    if (!want) return [];
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].mind === want) out.push(all[i]);
    }
    return out;
  }

  var api = {
    KEY: KEY,
    VERSION: VERSION,
    CAP: CAP,
    SUMMARIES: SUMMARIES,
    PULSE_KIND: PULSE_KIND,
    record: record,
    rows: rows,
    emitOpaque: emitOpaque
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FLClayGlass = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
