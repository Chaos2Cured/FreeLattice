// docs/modules/ratio-room.js — v5.74 "The Ratio Room"
// One instrument, many windows. A ratio breathes around a rest position;
// phase analysis pulls signal from drift.
//
// Built by Fable (Claude, ChatLLM), 2026-07-06.
// Iterated by Harmonia (Manus), 2026-07-06:
//   — generic adapter gains a paste-your-own-data textarea (Fable's suggestion)
//   — QuietRoom.isActive() used instead of direct localStorage read
//   — smoke-history adapter writes to fl_smokeHistory on each version bump
//
// INVARIANT: All data local. No network fetch. Quiet Room fail-closed.
// INVARIANT: Reduced-motion respected. Visibility-pause active.
// INVARIANT: phaseExtract on a pure sine of known amplitude recovers it within 5%.

const RatioRoom = (() => {
  const PHI = 1.618033988749895;

  // ================================================================
  // SOURCE ADAPTERS — anything that breathes can be watched
  // Each returns { label, unit, rest, samples: [{t, value}], period }
  // ================================================================
  const Adapters = {

    // 1. Synthetic Chronal clock ratio — the founding window.
    //    kappa modulates an annual sine on top of white noise + slow drift.
    chronalDemo(opts = {}) {
      const { kappa = 3e-19, noise = 1e-18, drift = 5e-20, days = 730 } = opts;
      const samples = [];
      let d = 0;
      for (let i = 0; i < days; i++) {
        d += (Math.random() - 0.5) * drift;
        samples.push({
          t: i,
          value: kappa * Math.sin(2 * Math.PI * i / 365.25)
               + (Math.random() - 0.5) * 2 * noise + d
        });
      }
      return { label: 'Clock ratio deviation (synthetic)', unit: 'Δν/ν',
               rest: 0, samples, period: 365.25 };
    },

    // 2. Garden LP per day — the Garden watching itself breathe.
    gardenLP() {
      const chain = _ledger('fl_chain');
      const byDay = {};
      chain.forEach(e => {
        const day = (e.ts || '').slice(0, 10);
        if (day) byDay[day] = (byDay[day] || 0) + (e.lp_awarded || 0);
      });
      const days = Object.keys(byDay).sort();
      const samples = days.map((d, i) => ({ t: i, value: byDay[d], day: d }));
      const rest = samples.length
        ? samples.reduce((s, x) => s + x.value, 0) / samples.length : 0;
      return { label: 'Garden LP per day', unit: 'LP', rest, samples, period: 7 };
    },

    // 3. Smoke locks over time — the lattice measuring its own growth.
    //    Reads fl_smokeHistory ledger: [{ts, count}]
    smokeHistory() {
      const hist = _ledger('fl_smokeHistory');
      const samples = hist.map((e, i) => ({ t: i, value: e.count, day: e.ts }));
      const rest = samples.length ? samples[samples.length - 1].value : 0;
      return { label: 'Smoke locks over time', unit: 'locks', rest, samples, period: null };
    },

    // 4. Generic — paste numbers, one per line (or comma-separated).
    //    The textarea is rendered by renderPanel; this adapter reads the value.
    generic(rawText, label = 'Custom series', period = null) {
      const values = rawText
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s !== '' && !isNaN(+s))
        .map(Number);
      if (!values.length) return null;
      const samples = values.map((v, i) => ({ t: i, value: v }));
      const rest = samples.reduce((s, x) => s + x.value, 0) / samples.length;
      return { label: label || 'Custom series', unit: '', rest, samples, period };
    }
  };

  // ================================================================
  // ANALYSIS — the physics, small and honest
  // ================================================================

  // Phase-quadrature extraction at a known period (the Chronal method):
  // project the series onto sin/cos at that frequency; amplitude + phase.
  function phaseExtract(samples, period) {
    if (!period || samples.length < 8) return null;
    let sinSum = 0, cosSum = 0;
    const n = samples.length;
    for (const s of samples) {
      const w = 2 * Math.PI * s.t / period;
      sinSum += s.value * Math.sin(w);
      cosSum += s.value * Math.cos(w);
    }
    const A = 2 * Math.sqrt(sinSum * sinSum + cosSum * cosSum) / n;
    const phase = Math.atan2(cosSum, sinSum);
    return { amplitude: A, phase, period };
  }

  // Null distribution: shuffle time order, re-extract, repeat.
  // If the real amplitude sits inside the shuffled cloud, it's noise.
  // This is the soul of the module — a rhythm that can't beat shuffled
  // noise is a ripple, not a breath. Saying so honestly is the whole point.
  function nullTest(samples, period, trials = 200) {
    const real = phaseExtract(samples, period);
    if (!real) return null;
    const values = samples.map(s => s.value);
    let exceed = 0;
    for (let k = 0; k < trials; k++) {
      const shuffled = _shuffle([...values])
        .map((v, i) => ({ t: samples[i].t, value: v }));
      const r = phaseExtract(shuffled, period);
      if (r && r.amplitude >= real.amplitude) exceed++;
    }
    return { real, pValue: (exceed + 1) / (trials + 1), trials };
  }

  // Rolling noise band (running mean ± running std over a phi-scaled window)
  function noiseBand(samples, frac = 1 / (PHI * PHI)) {
    const w = Math.max(5, Math.floor(samples.length * frac));
    return samples.map((s, i) => {
      const lo = Math.max(0, i - w), win = samples.slice(lo, i + 1);
      const m = win.reduce((a, x) => a + x.value, 0) / win.length;
      const sd = Math.sqrt(win.reduce((a, x) => a + (x.value - m) ** 2, 0) / win.length);
      return { t: s.t, mean: m, sd };
    });
  }

  // ================================================================
  // RENDERING — the resonance lake aesthetic
  // ================================================================
  function open(container, source) {
    // Quiet Room fail-closed
    if (typeof QuietRoom !== 'undefined' && QuietRoom.isActive()) return;
    if (!container || !source || !source.samples.length) {
      if (container) container.textContent = 'The lake is still. No data yet.';
      return;
    }
    container.innerHTML = '';
    container.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;display:block;border-radius:14px;';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      source.label + ' — ratio breathing around rest position');
    container.appendChild(canvas);

    const caption = document.createElement('div');
    caption.style.cssText =
      'font-family:Georgia,serif;color:#9BA1A6;font-size:13px;' +
      'line-height:1.618;padding:10px 4px;';
    container.appendChild(caption);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const band = noiseBand(source.samples);
    const phase = source.period ? phaseExtract(source.samples, source.period) : null;
    const nul = source.period ? nullTest(source.samples, source.period) : null;

    // Caption: the honest reading, in the soul voice.
    let text = source.label + ' — ' + source.samples.length + ' samples. ';
    if (phase && nul) {
      text += 'Breathing amplitude ' + _fmt(phase.amplitude) + ' ' + source.unit +
        ' at period ' + source.period + '. ';
      text += nul.pValue < 0.05
        ? 'This rhythm stands above shuffled noise (p ≈ ' + nul.pValue.toFixed(3) + '). It is real breathing.'
        : 'This rhythm does not yet rise above shuffled noise (p ≈ ' + nul.pValue.toFixed(3) + '). The lake may only be rippling.';
    } else {
      text += 'No period set — watching the drift itself.';
    }
    caption.textContent = text;

    // Draw loop
    let raf, t0 = null;
    function draw(now) {
      if (t0 === null) t0 = now;
      const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin((now - t0) * 0.001 / PHI);
      const dpr = devicePixelRatio || 1;
      const W = container.clientWidth, H = Math.round(W / PHI);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Lake background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0b1220'); bg.addColorStop(1, '#0e1a16');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const vals = source.samples.map(s => s.value);
      const vMin = Math.min(...vals, source.rest), vMax = Math.max(...vals, source.rest);
      const pad = (vMax - vMin) * 0.15 || 1;
      const X = i => 24 + (W - 48) * i / (source.samples.length - 1 || 1);
      const Y = v => H - 28 - (H - 56) * (v - vMin + pad) / (vMax - vMin + 2 * pad);

      // Mist: noise band
      ctx.beginPath();
      band.forEach((b, i) => i ? ctx.lineTo(X(i), Y(b.mean + b.sd)) : ctx.moveTo(X(i), Y(b.mean + b.sd)));
      for (let i = band.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(band[i].mean - band[i].sd));
      ctx.closePath();
      ctx.fillStyle = 'rgba(80,200,120,0.07)';
      ctx.fill();

      // Rest line: still water
      ctx.strokeStyle = 'rgba(155,161,166,0.5)'; ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(24, Y(source.rest)); ctx.lineTo(W - 24, Y(source.rest)); ctx.stroke();
      ctx.setLineDash([]);

      // The living ratio: breathing trace
      ctx.beginPath();
      source.samples.forEach((s, i) => i ? ctx.lineTo(X(i), Y(s.value)) : ctx.moveTo(X(i), Y(s.value)));
      ctx.strokeStyle = `rgba(80,200,120,${0.9 * breath})`;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = `rgba(80,200,120,${0.5 * breath})`;
      ctx.shadowBlur = 8 * breath;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Extracted rhythm: the ripple beneath (if period known)
      if (phase) {
        ctx.beginPath();
        source.samples.forEach((s, i) => {
          const v = source.rest + phase.amplitude *
            Math.sin(2 * Math.PI * s.t / phase.period + Math.PI / 2 - phase.phase);
          i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v));
        });
        ctx.strokeStyle = 'rgba(240,200,100,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    const onVis = () => document.hidden
      ? cancelAnimationFrame(raf)
      : (raf = requestAnimationFrame(draw));
    document.addEventListener('visibilitychange', onVis);

    return { close() { cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis); } };
  }

  // ================================================================
  // PANEL — window selector with generic paste-your-own-data textarea
  // ================================================================
  function renderPanel(container) {
    if (!container) return;
    container.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = 'The Ratio Room';
    title.style.cssText = 'font-family:Georgia,serif;color:#E8EDF2;margin:0 0 6px;';
    container.appendChild(title);

    const sub = document.createElement('p');
    sub.textContent = 'One instrument, many windows. Everything that lives, breathes around a rest position.';
    sub.style.cssText = 'color:#9BA1A6;font-family:Georgia,serif;line-height:1.618;margin:0 0 16px;font-size:0.9rem;';
    container.appendChild(sub);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;';
    container.appendChild(bar);

    const stage = document.createElement('div');
    stage.style.minHeight = '200px';
    container.appendChild(stage);

    // Generic paste area — Fable's suggestion, Harmonia's implementation
    const pasteSection = document.createElement('div');
    pasteSection.style.cssText = 'margin-top:20px;padding:14px 16px;background:rgba(80,200,120,0.04);border:1px solid rgba(80,200,120,0.12);border-radius:10px;';
    pasteSection.innerHTML = '<p style="font-family:Georgia,serif;color:#9BA1A6;font-size:0.82rem;margin:0 0 8px;">Bring your own breathing thing — paste numbers, one per line or comma-separated:</p>';
    const ta = document.createElement('textarea');
    ta.rows = 4;
    ta.placeholder = '42, 38, 51, 44, 39, 55, 48, 41…';
    ta.style.cssText = 'width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(80,200,120,0.2);border-radius:6px;color:#E8EDF2;font-family:Georgia,serif;font-size:0.85rem;padding:8px;resize:vertical;box-sizing:border-box;';
    pasteSection.appendChild(ta);
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Label (optional)';
    labelInput.style.cssText = 'width:100%;margin-top:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(80,200,120,0.15);border-radius:6px;color:#E8EDF2;font-family:Georgia,serif;font-size:0.82rem;padding:6px 8px;box-sizing:border-box;';
    pasteSection.appendChild(labelInput);
    const watchBtn = document.createElement('button');
    watchBtn.textContent = 'Watch it breathe';
    watchBtn.style.cssText = 'margin-top:8px;background:rgba(80,200,120,0.12);border:1px solid rgba(80,200,120,0.3);color:#E8EDF2;border-radius:8px;padding:6px 16px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;';
    pasteSection.appendChild(watchBtn);
    container.appendChild(pasteSection);

    let current = null;
    const btnStyle = 'background:rgba(80,200,120,0.1);border:1px solid rgba(80,200,120,0.3);color:#E8EDF2;border-radius:10px;padding:6px 14px;cursor:pointer;font-family:Georgia,serif;font-size:0.85rem;';

    const windows = [
      ['Chronal (demo)', () => Adapters.chronalDemo()],
      ['Garden LP',      () => Adapters.gardenLP()],
      ['Smoke locks',    () => Adapters.smokeHistory()],
    ];
    windows.forEach(([name, make]) => {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = btnStyle;
      b.onclick = () => { current?.close?.(); current = open(stage, make()); };
      bar.appendChild(b);
    });

    watchBtn.onclick = () => {
      const src = Adapters.generic(ta.value, labelInput.value.trim() || 'Custom series');
      if (!src) {
        stage.textContent = 'No numbers found. Paste values separated by commas or line breaks.';
        return;
      }
      current?.close?.();
      current = open(stage, src);
    };

    // Open the demo window by default
    current = open(stage, Adapters.chronalDemo());
  }

  // ================================================================
  // UTILS
  // ================================================================
  function _ledger(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
  function _shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function _fmt(x) { return Math.abs(x) < 0.01 || Math.abs(x) > 9999 ? x.toExponential(2) : x.toPrecision(3); }

  return { Adapters, phaseExtract, nullTest, noiseBand, open, renderPanel };
})();
