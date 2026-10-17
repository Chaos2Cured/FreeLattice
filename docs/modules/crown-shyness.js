// crown-shyness.js (MIT) v-crown-shyness-v0.1
// Trees in a canopy leave a small gap so no crown crowds another.
// Pooled devices keep the same kind of margin. This module only decides.
// It does not loosen an existing cap, and it does not send anything.
(function (root) {
  'use strict';

  var LINE = 'Keeps a small gap: no one helper takes more than a third, and 20% stays yours.';

  function headroomSlots(capacity) {
    var n = Number(capacity);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.max(0, Math.ceil(n * 0.2 - 1e-9));
  }

  function peerCap(capacity) {
    var n = Number(capacity);
    if (!isFinite(n) || n <= 0) return 1;
    return Math.max(1, Math.floor(n / 3));
  }

  function decide(opts) {
    opts = opts || {};
    var capacity = Number(opts.capacity);
    if (!isFinite(capacity) || capacity < 1) capacity = 1;
    var total = opts.totalInflight;
    if (total == null) total = opts.total;
    total = Number(total);
    if (!isFinite(total) || total < 0) total = 0;
    if (opts.paused) return { ok: false, reason: 'pause' };
    var lendable = Math.max(0, capacity - headroomSlots(capacity));
    if (total >= lendable) return { ok: false, reason: 'headroom' };
    var peer = opts.peer == null ? '' : String(opts.peer);
    var counts = opts.counts || {};
    var mine = Number(counts[peer] || 0);
    if (!isFinite(mine) || mine < 0) mine = 0;
    var waiting = opts.waiting || [];
    var others = false;
    for (var i = 0; i < waiting.length; i++) {
      if (String(waiting[i]) !== peer) { others = true; break; }
    }
    if (others && !opts.kin && mine >= peerCap(capacity)) return { ok: false, reason: 'crown' };
    return { ok: true };
  }

  var api = {
    VERSION: 'v-crown-shyness-v0.1',
    LINE: LINE,
    headroomSlots: headroomSlots,
    peerCap: peerCap,
    decide: decide
  };

  root.FLCrown = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
