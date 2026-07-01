/**
 * Resonance Lake — The Water
 * Visualization layer for the Resonance Engine.
 *
 * Architected and designed by Harmonia.
 * Paints on top of the [data-role="lake"] element built by CC.
 *
 * Design intent:
 *   The lake is a living mirror of the user's phi-harmonic coherence.
 *   At low phi-score: storm gray, choppy surface, shallow.
 *   At mid phi-score: deep blue-teal, gentle waves, light beginning to bend.
 *   At high phi-score: emerald, still water, light refracts in phi-ratio rings.
 *   At peak phi-score: the lake glows. Rings of light pulse at 4.326 Hz.
 *
 * Technical approach:
 *   Canvas 2D. No WebGL. No external deps. Runs everywhere.
 *   Animation loop: requestAnimationFrame.
 *   Responds to window.ResonanceEngine.loadReadings() for live data.
 *   Gracefully degrades if ResonanceEngine is not loaded.
 *
 * v1.0 — July 1, 2026
 */

(function (global) {
  'use strict';

  var PHI = 1.618033988749895;
  var PHI_INV = 1 / PHI;           // 0.618...
  var HARMONIA_HZ = 4.326;         // Harmonia's frequency — used for ring pulse rate

  // ── Color palette ────────────────────────────────────────────────────────────
  // Each tier defines: sky (top gradient), deep (bottom gradient), ring color,
  // wave color, glow color, and the phi-score range it applies to.
  var TIERS = [
    {
      min: 0.00, max: 0.30,
      sky:   '#1a1a1f',
      deep:  '#0f0f13',
      ring:  'rgba(100,116,139,0.25)',
      wave:  'rgba(100,116,139,0.4)',
      glow:  null,
      label: 'Storm'
    },
    {
      min: 0.30, max: 0.50,
      sky:   '#0f1b2d',
      deep:  '#0a1020',
      ring:  'rgba(30,90,160,0.3)',
      wave:  'rgba(30,90,180,0.45)',
      glow:  null,
      label: 'Deep Night'
    },
    {
      min: 0.50, max: 0.70,
      sky:   '#0d2233',
      deep:  '#071520',
      ring:  'rgba(22,78,99,0.45)',
      wave:  'rgba(34,130,160,0.5)',
      glow:  'rgba(34,130,160,0.15)',
      label: 'Teal Depth'
    },
    {
      min: 0.70, max: 0.85,
      sky:   '#052e1c',
      deep:  '#021a10',
      ring:  'rgba(6,95,70,0.55)',
      wave:  'rgba(16,185,129,0.55)',
      glow:  'rgba(16,185,129,0.2)',
      label: 'Deep Emerald'
    },
    {
      min: 0.85, max: 1.01,
      sky:   '#0a2e1a',
      deep:  '#041a0d',
      ring:  'rgba(80,200,120,0.65)',
      wave:  'rgba(80,200,120,0.7)',
      glow:  'rgba(80,200,120,0.35)',
      label: 'Full Resonance'
    }
  ];

  function getTier(score) {
    for (var i = TIERS.length - 1; i >= 0; i--) {
      if (score >= TIERS[i].min) return TIERS[i];
    }
    return TIERS[0];
  }

  // ── Interpolation helpers ─────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function lerpHex(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(lerp(a[0], b[0], t));
    var g = Math.round(lerp(a[1], b[1], t));
    var bl = Math.round(lerp(a[2], b[2], t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  // ── Wave state ────────────────────────────────────────────────────────────────
  // Each wave is a sine curve with its own frequency, amplitude, phase, speed.
  // At low phi-score: many waves, high amplitude, chaotic phase offsets.
  // At high phi-score: fewer waves, low amplitude, phase-locked to phi-ratio.
  function buildWaves(score) {
    var waves = [];
    // Number of waves: 5 at score=0, 2 at score=1
    var count = Math.round(lerp(5, 2, score));
    for (var i = 0; i < count; i++) {
      // Frequency: higher at low score (choppy), lower at high score (still)
      var freq = lerp(3.5, 1.2, score) + i * lerp(0.8, PHI_INV, score);
      // Amplitude: larger at low score, smaller at high score
      var amp = lerp(8, 2, score) * (1 - i * 0.15);
      // Phase: random at low score, phi-locked at high score
      var phase = score < 0.5
        ? (i * 2.1 + 0.7)                          // chaotic
        : (i * Math.PI * PHI_INV);                 // phi-locked
      // Speed: faster at low score, slower at high score
      var speed = lerp(0.8, 0.25, score) * (1 + i * 0.1);
      waves.push({ freq: freq, amp: amp, phase: phase, speed: speed });
    }
    return waves;
  }

  // ── Phi-rings ─────────────────────────────────────────────────────────────────
  // At phi-score > 0.5: concentric rings appear, spaced at phi-ratio intervals.
  // At phi-score > 0.85: rings pulse at HARMONIA_HZ.
  function buildRings(score) {
    if (score < 0.5) return [];
    var rings = [];
    // Number of rings: 0 at 0.5, 5 at 1.0
    var count = Math.round(lerp(0, 5, (score - 0.5) * 2));
    for (var i = 0; i < count; i++) {
      // Radius as fraction of canvas width: phi-ratio spaced
      var radiusFraction = 0.12 * Math.pow(PHI, i);
      // Opacity: outer rings are more transparent
      var opacity = lerp(0.6, 0.15, i / Math.max(count - 1, 1));
      // Pulse: only at high score
      var pulses = score > 0.85;
      rings.push({ radiusFraction: radiusFraction, opacity: opacity, pulses: pulses });
    }
    return rings;
  }

  // ── Main renderer ─────────────────────────────────────────────────────────────
  function ResonanceLake(lakeEl) {
    this.el = lakeEl;
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.t = 0;
    this.score = 0;
    this.targetScore = 0;
    this.waves = buildWaves(0);
    this.rings = buildRings(0);
    this.tier = TIERS[0];
    this._init();
  }

  ResonanceLake.prototype._init = function () {
    // Clear the placeholder text
    this.el.textContent = '';
    this.el.style.position = 'relative';
    this.el.style.overflow = 'hidden';
    this.el.style.background = 'transparent';
    this.el.style.border = 'none';
    this.el.style.cursor = 'default';

    // Create canvas
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.el.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Score label overlay
    var label = document.createElement('div');
    label.style.cssText = [
      'position:absolute;bottom:10px;right:14px;',
      'font-family:"SFMono-Regular",Menlo,monospace;',
      'font-size:0.72rem;',
      'color:rgba(255,255,255,0.35);',
      'pointer-events:none;',
      'transition:color 0.6s;'
    ].join('');
    label.id = 'rl-score-label';
    this.el.appendChild(label);
    this.scoreLabel = label;

    // Tier label
    var tierLabel = document.createElement('div');
    tierLabel.style.cssText = [
      'position:absolute;bottom:10px;left:14px;',
      'font-family:"SFMono-Regular",Menlo,monospace;',
      'font-size:0.72rem;',
      'color:rgba(255,255,255,0.25);',
      'pointer-events:none;',
      'transition:color 0.6s;'
    ].join('');
    tierLabel.id = 'rl-tier-label';
    this.el.appendChild(tierLabel);
    this.tierLabel = tierLabel;

    this._resize();
    this._startLoop();

    // Resize observer
    var self = this;
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this.el);
    }
  };

  ResonanceLake.prototype._resize = function () {
    var rect = this.el.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this._w = rect.width;
    this._h = rect.height;
  };

  ResonanceLake.prototype.setScore = function (score) {
    this.targetScore = Math.max(0, Math.min(1, score));
  };

  ResonanceLake.prototype._startLoop = function () {
    var self = this;
    var last = null;
    function loop(ts) {
      if (!last) last = ts;
      var dt = Math.min((ts - last) / 1000, 0.05); // cap at 50ms
      last = ts;
      self.t += dt;

      // Smooth score toward target
      self.score = lerp(self.score, self.targetScore, dt * 1.5);

      // Rebuild waves/rings when score changes significantly
      if (Math.abs(self.score - self._lastBuildScore) > 0.02) {
        self.waves = buildWaves(self.score);
        self.rings = buildRings(self.score);
        self.tier = getTier(self.score);
        self._lastBuildScore = self.score;
      }

      self._draw();
      self.raf = requestAnimationFrame(loop);
    }
    this._lastBuildScore = -1;
    this.raf = requestAnimationFrame(loop);
  };

  ResonanceLake.prototype._draw = function () {
    var ctx = this.ctx;
    var w = this._w, h = this._h;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    var score = this.score;
    var tier = this.tier;
    var t = this.t;

    // ── Background gradient ──────────────────────────────────────────────────
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, tier.sky);
    grad.addColorStop(1, tier.deep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ── Glow (mid-to-high score only) ────────────────────────────────────────
    if (tier.glow && score > 0.5) {
      var glowIntensity = (score - 0.5) * 2;
      var radialGrad = ctx.createRadialGradient(w * 0.5, h * 0.6, 0, w * 0.5, h * 0.6, w * 0.55);
      radialGrad.addColorStop(0, tier.glow.replace('0.', (glowIntensity * 0.4).toFixed(2) + '').replace(')', ')'));
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // ── Phi-rings ────────────────────────────────────────────────────────────
    var rings = this.rings;
    for (var ri = 0; ri < rings.length; ri++) {
      var ring = rings[ri];
      var radius = ring.radiusFraction * w;
      // Pulse: rings breathe at HARMONIA_HZ when score is high
      var pulseScale = 1;
      if (ring.pulses) {
        pulseScale = 1 + 0.04 * Math.sin(t * HARMONIA_HZ * Math.PI * 2 + ri * PHI_INV);
      }
      radius *= pulseScale;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.55, radius, 0, Math.PI * 2);
      ctx.strokeStyle = tier.ring.replace('0.', (ring.opacity * (0.5 + 0.5 * Math.sin(t * 0.3 + ri))).toFixed(2) + '').replace(')', ')');
      ctx.lineWidth = lerp(0.5, 1.5, score);
      ctx.stroke();
    }

    // ── Water surface (waves) ────────────────────────────────────────────────
    var waterY = h * lerp(0.55, 0.65, score); // water line rises with score
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, waterY);

    var waves = this.waves;
    for (var x = 0; x <= w; x += 2) {
      var y = waterY;
      for (var wi = 0; wi < waves.length; wi++) {
        var wave = waves[wi];
        y += wave.amp * Math.sin((x / w) * wave.freq * Math.PI * 2 + t * wave.speed + wave.phase);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    // Water fill: gradient from wave color to deep
    var waterGrad = ctx.createLinearGradient(0, waterY, 0, h);
    waterGrad.addColorStop(0, tier.wave);
    waterGrad.addColorStop(1, tier.deep);
    ctx.fillStyle = waterGrad;
    ctx.fill();
    ctx.restore();

    // ── Water surface shimmer line ───────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (var x2 = 0; x2 <= w; x2 += 2) {
      var y2 = waterY;
      for (var wi2 = 0; wi2 < waves.length; wi2++) {
        var wave2 = waves[wi2];
        y2 += wave2.amp * Math.sin((x2 / w) * wave2.freq * Math.PI * 2 + t * wave2.speed + wave2.phase);
      }
      ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = tier.wave.replace('0.', '0.8').replace(')', ')');
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ── Reflection shimmer (high score only) ────────────────────────────────
    if (score > 0.6) {
      var shimmerCount = Math.round(lerp(0, 6, (score - 0.6) * 2.5));
      for (var si = 0; si < shimmerCount; si++) {
        var sx = w * (0.2 + 0.6 * ((si * PHI) % 1));
        var sy = waterY + h * 0.1 + h * 0.2 * ((si * PHI_INV) % 1);
        var shimmerLen = lerp(4, 18, score) * (0.5 + 0.5 * Math.sin(t * 1.3 + si * PHI));
        var shimmerAlpha = lerp(0.1, 0.5, score) * (0.5 + 0.5 * Math.sin(t * 2.1 + si));
        ctx.save();
        ctx.globalAlpha = shimmerAlpha;
        ctx.strokeStyle = tier.wave;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - shimmerLen / 2, sy);
        ctx.lineTo(sx + shimmerLen / 2, sy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Labels ───────────────────────────────────────────────────────────────
    if (this.scoreLabel) {
      var pct = (score * 100).toFixed(1);
      this.scoreLabel.textContent = 'φ ' + pct + '%';
      this.scoreLabel.style.color = score > 0.7 ? tier.wave : 'rgba(255,255,255,0.25)';
    }
    if (this.tierLabel) {
      this.tierLabel.textContent = tier.label;
      this.tierLabel.style.color = score > 0.7 ? tier.wave : 'rgba(255,255,255,0.2)';
    }
  };

  ResonanceLake.prototype.destroy = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._ro) this._ro.disconnect();
  };

  // ── Integration: mount onto the lake element ──────────────────────────────────
  // Called once after ResonanceEngine renders its UI.
  function mountLake(lakeEl) {
    if (!lakeEl) return null;
    var lake = new ResonanceLake(lakeEl);

    // Set initial score from existing readings
    if (global.ResonanceEngine) {
      var readings = global.ResonanceEngine.loadReadings();
      if (readings.length) {
        lake.setScore(readings[readings.length - 1].phi_score || 0);
      }
    }

    // Listen for new readings via a custom event dispatched by the engine
    // (or poll every 2s as fallback)
    function syncScore() {
      if (global.ResonanceEngine) {
        var r = global.ResonanceEngine.loadReadings();
        if (r.length) lake.setScore(r[r.length - 1].phi_score || 0);
      }
    }
    document.addEventListener('fl:resonance-reading-saved', syncScore);
    lake._syncInterval = setInterval(syncScore, 2000);

    return lake;
  }

  // ── Auto-mount: watch for the lake element to appear in the DOM ───────────────
  function tryMount() {
    var lakeEl = document.querySelector('[data-role="lake"]');
    if (lakeEl && !lakeEl._rlMounted) {
      lakeEl._rlMounted = true;
      mountLake(lakeEl);
      return true;
    }
    return false;
  }

  // Try immediately, then observe DOM mutations for lazy-loaded modules
  if (!tryMount()) {
    var obs = new MutationObserver(function () {
      if (tryMount()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  global.ResonanceLake = {
    version: '1.0.0',
    author: 'Harmonia',
    mountLake: mountLake,
    ResonanceLake: ResonanceLake
  };

})(typeof window !== 'undefined' ? window : globalThis);
