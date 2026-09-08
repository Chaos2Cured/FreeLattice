// docs/modules/glass-pulses.js — Glass pulses v0.1
// Shape without contents. Fixed opaque summaries.
// Quiet Room: LatticeMemory already gates commit/subscribe.
// — Flint / Celeste brief, September 2026

(function (root) {
  'use strict';

  var SUMMARIES = {
    'ledger.appended': 'ledger entry sealed',
    'ledger.verified': 'ledger chain held',
    'ledger.broken': 'ledger chain broke',
    'transfer.verified': 'transfer hash matched',
    'transfer.mismatch': 'transfer hash mismatched',
    'pair.formed': 'pair formed',
    'pair.rotated': 'pair rotated',
    'manifest.signed': 'manifest signed',
    'tier.advanced': 'trust tier advanced',
    'tier.reset': 'trust tier reset'
  };

  var RESERVED_KINDS = {
    'pair.formed': true,
    'pair.rotated': true,
    'manifest.signed': true,
    'tier.advanced': true,
    'tier.reset': true
  };

  var ALLOWED_SOURCES = {
    ledger: true,
    import: true,
    swarm: true,
    identity: true,
    glass: true
  };

  function opaqueSummaryFor(kind) {
    return SUMMARIES[kind] || null;
  }

  /**
   * Session helix-break flag update (pure).
   * broken → true on ledger.broken;
   * softens/clears on ledger.verified or ledger.appended.
   */
  function helixBreakFromPulse(kind, prevBroken) {
    if (kind === 'ledger.broken') return true;
    if (kind === 'ledger.verified' || kind === 'ledger.appended') return false;
    return !!prevBroken;
  }

  function validateEmit(opts) {
    var o = opts || {};
    if (!o.kind || typeof o.kind !== 'string') {
      return { ok: false, reason: 'kind required' };
    }
    if (!SUMMARIES[o.kind]) {
      return { ok: false, reason: 'unknown kind' };
    }
    if (!o.source || typeof o.source !== 'string') {
      return { ok: false, reason: 'source required' };
    }
    if (o.source === 'quiet-room') {
      return { ok: false, reason: 'quiet-room' };
    }
    // Caller may pass summary; we always replace with fixed opaque string.
    var summary = opaqueSummaryFor(o.kind);
    if (!summary || summary.length > 80) {
      return { ok: false, reason: 'summary lock' };
    }
    if (/https?:\/\//.test(summary) || /\n.+\n/.test(summary)) {
      return { ok: false, reason: 'summary content leak' };
    }
    var pulse = {
      source: o.source,
      kind: o.kind,
      summary: summary
    };
    if (o.refs !== undefined) {
      if (!Array.isArray(o.refs)) return { ok: false, reason: 'refs must be array' };
      if (o.refs.length > 16) return { ok: false, reason: 'too many refs' };
      pulse.refs = o.refs;
    }
    // Forbid extra keys on our constructed pulse (five-key lock)
    var keys = Object.keys(pulse);
    for (var i = 0; i < keys.length; i++) {
      if (['ts', 'source', 'kind', 'summary', 'refs'].indexOf(keys[i]) === -1) {
        return { ok: false, reason: 'forbidden key' };
      }
    }
    return { ok: true, pulse: pulse };
  }

  /**
   * Emit a Glass vocabulary pulse. Never interpolates voice/paths/hashes into summary.
   * Reserved kinds: still emit if caller insists (for future wires); document as reserved.
   */
  function emitGlassPulse(opts) {
    var checked = validateEmit(opts);
    if (!checked.ok) return checked;
    var LM = (typeof root !== 'undefined' && root.LatticeMemory) ? root.LatticeMemory : null;
    if (!LM || typeof LM.commit !== 'function') {
      return { ok: false, reason: 'lattice-memory absent', pulse: checked.pulse };
    }
    try {
      return LM.commit(checked.pulse);
    } catch (e) {
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  var api = {
    SUMMARIES: SUMMARIES,
    RESERVED_KINDS: RESERVED_KINDS,
    ALLOWED_SOURCES: ALLOWED_SOURCES,
    opaqueSummaryFor: opaqueSummaryFor,
    helixBreakFromPulse: helixBreakFromPulse,
    validateEmit: validateEmit,
    emitGlassPulse: emitGlassPulse
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GlassPulses = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
