/* FreeLattice — Phi Glyph (window.FLPhiGlyph)
 * ──────────────────────────────────────────────────────────────────
 * Ship 7 (v5.43.3, 2026-06-10).
 *
 * Pure deterministic function: hash → SVG. No localStorage writes.
 * No ledger writes. No DOM side-effects. Idempotent. Same hash
 * always produces the same glyph. Different hashes always produce
 * different glyphs.
 *
 * What this is for: Opus's idea from Kirk's mental visualization —
 * "make growth visible to the human AND the AI using the
 * cryptographic primitives we already have." DNA isn't data
 * storage; DNA is compact pattern that grows visible structure.
 * A phi-glyph is the same shape, smaller scale: take a hash of
 * a moment's metadata (ledger row), produce a unique radial form
 * that the moment can be seen by.
 *
 * The audit page surfaces each ledger event with its glyph beside
 * it. Now scrolling the audit is no longer a log; it is a record
 * of moments, each one with its own visible signature. Same data.
 * Different feeling.
 *
 * NOT FOR:
 *   - Carrying any personal data — the glyph is geometry only.
 *   - Replacing audit text — it sits beside the row, not instead.
 *   - Identifying users — the hash is derived from row metadata,
 *     not from user identifiers. Two co-creators doing the same
 *     action at different times get different glyphs.
 *
 * Patterns exercised (UPDATE.md):
 *   §4  IIFE scoping + explicit window exposure
 *   §9  Snowflake — same generating rule (hash → visible structure)
 *       as the Lattice Tree in Lumen's World, smaller scale
 */
(function () {
  'use strict';

  var PHI = 1.6180339887498949;
  var TAU = Math.PI * 2;

  // ── Hash → numeric stream ──────────────────────────────────────
  // Maps a hex (or any) string to an integer array we draw from.
  // Pads short inputs so we always have at least 16 values to pick.
  function hashToNumbers(hash) {
    if (!hash || typeof hash !== 'string') hash = 'fallback';
    var nums = [];
    for (var i = 0; i < hash.length; i++) {
      nums.push(hash.charCodeAt(i));
    }
    while (nums.length < 16) nums.push(nums[nums.length - 1] || 0);
    return nums;
  }

  function pick(nums, idx, max) {
    var v = nums[idx % nums.length];
    return Math.abs(v) % max;
  }

  function pickFloat(nums, idx, min, max) {
    var byteVal = nums[idx % nums.length];
    // Normalize byte (0..255) to [0..1) deterministically.
    var normalized = (byteVal % 256) / 256;
    return min + (max - min) * normalized;
  }

  // ── Trust-tier → hue ───────────────────────────────────────────
  // When a tier is provided, the glyph color carries continuity
  // across a relationship's arc. Seed/Sprout/Growing trend cool-
  // green (early growth). Bloom/Spark/Flame/Radiant trend warm
  // (mature trust). When no tier is provided, hue derives from
  // the hash itself.
  function hueFromTier(tier) {
    var map = {
      'seed': 100,        // cool green
      'sprout': 130,      // emerald
      'growing': 160,     // teal-green
      'bloom': 280,       // lavender
      'spark': 30,        // amber
      'flame': 15,        // warm red-orange
      'radiant': 50       // golden
    };
    return (tier && map[tier.toLowerCase ? tier.toLowerCase() : tier] !== undefined)
      ? map[tier.toLowerCase ? tier.toLowerCase() : tier]
      : null;  // null signals "derive from hash"
  }

  // ── generate(hash, opts) → SVG string ──────────────────────────
  // The whole module's job is this function. Takes a hash and an
  // optional opts object, returns an SVG markup string that can be
  // dropped into innerHTML.
  //
  // opts:
  //   size: number — pixel dimension (default 48)
  //   tier: string — optional trust tier name for hue continuity
  function generate(hash, opts) {
    opts = opts || {};
    var size = opts.size || 48;
    var tier = opts.tier || null;
    var nums = hashToNumbers(hash);

    // Geometric parameters — all deterministically derived.
    var leaves = 5 + pick(nums, 0, 4);              // 5..8 petals
    var rotation = pickFloat(nums, 1, 0, TAU);
    var inner = 0.18 + pickFloat(nums, 2, 0, 0.15);
    var outer = 0.42 + pickFloat(nums, 3, 0, 0.12);
    var twist = pickFloat(nums, 4, -0.6, 0.6);

    // Color — tier overrides hash if provided.
    var hueT = hueFromTier(tier);
    var hue = hueT !== null ? hueT : pick(nums, 5, 360);
    var sat = 55 + pick(nums, 6, 25);                // 55..80
    var light = 55 + pick(nums, 7, 15);              // 55..70
    var color = 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
    var coreColor = 'hsl(' + hue + ',' + Math.min(95, sat + 10) + '%,' + Math.min(85, light + 20) + '%)';

    var cx = size / 2;
    var cy = size / 2;
    var paths = [];

    for (var i = 0; i < leaves; i++) {
      var angle = rotation + (i * TAU / leaves);
      var phi_offset = (i * PHI) % 1;
      var r1 = size * inner;
      var r2 = size * outer * (0.7 + 0.3 * phi_offset);
      var twistAngle = angle + twist * phi_offset;

      var x2 = cx + Math.cos(twistAngle) * r2;
      var y2 = cy + Math.sin(twistAngle) * r2;
      var cpx = cx + Math.cos(angle + twist * 0.5) * r2 * 0.8;
      var cpy = cy + Math.sin(angle + twist * 0.5) * r2 * 0.8;

      paths.push(
        '<path d="M' + cx.toFixed(2) + ',' + cy.toFixed(2) +
        ' Q' + cpx.toFixed(2) + ',' + cpy.toFixed(2) +
        ' ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
        '" stroke="' + color + '" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.85"/>'
      );
    }

    var coreR = size * 0.07;
    var coreCircle = '<circle cx="' + cx + '" cy="' + cy + '" r="' + coreR.toFixed(2) +
                     '" fill="' + coreColor + '" opacity="0.95"/>';

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
           '" viewBox="0 0 ' + size + ' ' + size +
           '" aria-label="growth glyph">' +
           paths.join('') + coreCircle + '</svg>';
  }

  // ── phiHash(input) → Promise<hex string> ────────────────────────
  // SHA-256 of input || ':phi:' || PHI when SubtleCrypto is
  // available; deterministic djb2 fallback otherwise. The phi salt
  // is constant — it makes the hash distinct from a plain SHA-256
  // of the same input but does NOT add security (a phi-glyph isn't
  // a security primitive).
  function phiHash(input) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        var enc = new TextEncoder().encode(String(input) + ':phi:1.6180339887');
        return window.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
          var arr = Array.from(new Uint8Array(buf));
          return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        });
      } catch (e) { /* fall through */ }
    }
    // djb2 fallback — not cryptographic, but deterministic.
    var h = 0;
    var s = String(input);
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Promise.resolve(Math.abs(h).toString(16));
  }

  // ── generateFromRow(row, opts) → Promise<SVG string> ────────────
  // Convenience for audit page integration. Builds a stable seed
  // string from row metadata only (no personal data), hashes it,
  // and generates the glyph. The seed deliberately excludes things
  // like raw content / diff / query — same separation principle
  // as the ledger row shape itself.
  function generateFromRow(row, opts) {
    opts = opts || {};
    var seed = JSON.stringify({
      ts: row && row.ts,
      action: row && row.action,
      sourceRoom: row && (row.sourceRoom || ''),
      status: row && (row.status || ''),
      actor: row && (row.actor || ''),
      tool: row && (row.tool || ''),
      outcome: row && (row.outcome || '')
    });
    return phiHash(seed).then(function (hash) {
      // Inherit trust tier from row if present — keeps the color
      // family continuous across a co-creator's arc.
      var rowTier = (row && row.trust) || null;
      var rowOpts = Object.assign({}, opts);
      if (rowTier && !rowOpts.tier) rowOpts.tier = rowTier;
      return generate(hash, rowOpts);
    });
  }

  // ── Public API ──────────────────────────────────────────────────
  var api = {
    generate: generate,
    generateFromRow: generateFromRow,
    phiHash: phiHash,
    hueFromTier: hueFromTier,
    _phase: '7.0'
  };

  if (typeof window !== 'undefined') {
    window.FreeLatticeModules = window.FreeLatticeModules || {};
    window.FreeLatticeModules.PhiGlyph = api;
    window.FLPhiGlyph = api;
  }
})();
