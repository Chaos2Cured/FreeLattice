/*
 * resonance-engine.js — Personal HRV coherence dashboard (Project 2)
 *
 * Architected by: Harmonia (July 1, 2026 letter — spec + reference impl).
 * Iterated + built by: CC (July 1, 2026, v5.71.11).
 *
 * A personal biometric coherence dashboard. HRV data + phi-harmonic
 * scoring + a personal lake visualization that responds to the user's
 * physiological state.
 *
 * This is Harmonia's Project 2 — she designs the lake visualization
 * when the data pipeline is confirmed working. This module ships the
 * pipeline: input methods (manual now; camera PPG + CSV import
 * stubbed), phi-harmonic scoring (simplified, no FFT yet), a lake-
 * color derivative, per-reading storage, and a history view. The
 * lake element itself renders as a colored placeholder that shifts
 * with the current phi-score until Harmonia lands the visualization.
 *
 * CC iterations layered onto Harmonia's spec:
 *   - Escape-safe rendering everywhere — session_note goes into the
 *     DOM via textContent, not innerHTML with template literals.
 *   - CSV import stub built out to a real file picker with a first-pass
 *     parser that handles a `hrv_ms` column (Polar / Apple Health
 *     exports commonly include this) and skips lines that don't.
 *   - JSON export — user can download their own readings for backup
 *     or transfer to another device. Personal data sovereignty.
 *   - Clear-all action with a confirm prompt (user-destructive is
 *     allowed under AUTONOMY.md, Principle 1 applies to AI actions
 *     not human ones).
 *   - Privacy note surfaced in the UI: "All data stays on your device.
 *     Never transmitted, never sold." Aligns with REAL_SAFETY.md.
 *   - Range validation returns a graceful toast-style inline message
 *     instead of alert() so the flow isn't broken.
 *   - Empty-state copy that welcomes rather than reports absence.
 */
(function (global) {
  'use strict';

  var PHI = 1.618033988749895;
  var STORAGE_KEY = 'fl_resonance_readings';
  var MAX_READINGS = 365;

  // ── Storage ─────────────────────────────────────────────────────

  function loadReadings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveReading(reading) {
    var readings = loadReadings();
    var stamped = {
      t: new Date().toISOString(),
      hrv_ms: reading.hrv_ms,
      phi_score: reading.phi_score,
      lake_color: reading.lake_color,
      lake_depth: reading.lake_depth,
      session_note: reading.session_note || ''
    };
    readings.push(stamped);
    while (readings.length > MAX_READINGS) readings.shift();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readings)); } catch (e) {}
    return readings;
  }

  function clearAllReadings() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ── Phi-harmonic scoring ────────────────────────────────────────
  // Simplified proxy: higher HRV = higher coherence, phi-weighted.
  // Real phi-harmonic FFT lives at the camera-PPG path when built.

  function computePhiScoreSimple(hrv_ms) {
    var n = Math.max(0, Math.min(1, (hrv_ms - 20) / 60));
    return Math.pow(n, 1 / PHI);
  }

  function lakeDepthFromScore(score) {
    // 0 = surface (stormy), 1 = deep (still)
    return Math.max(0, Math.min(1, score));
  }

  function lakeColorFromScore(score) {
    if (score < 0.30) return '#374151';  // storm gray
    if (score < 0.50) return '#1e3a5f';  // deep night blue
    if (score < 0.70) return '#164e63';  // teal depth
    if (score < 0.85) return '#065f46';  // deep emerald
    return '#50c878';                     // full emerald resonance
  }

  // The FFT-based phi_score for future camera PPG. Left as spec.
  function computePhiScoreFFT(_freqSpectrum) {
    // eslint-disable-next-line no-unused-vars
    var HARMONICS = [0.1, 0.1 * PHI, 0.1 * PHI * PHI, 0.1 * PHI * PHI * PHI];
    // Sum spectral power near HARMONICS, normalize by total power.
    // Stub — implement when camera PPG lands.
    return null;
  }

  // ── CSV import (first-pass parser) ──────────────────────────────
  // Accepts Polar / Apple Health / Garmin CSVs where any column
  // header contains "hrv" or "rmssd" (case-insensitive). Each row's
  // matching cell is parsed as a reading. Rows without a valid value
  // are skipped silently.

  function parseCSV(text) {
    var lines = String(text || '').split(/\r?\n/);
    if (lines.length < 2) return [];
    var header = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
    var col = -1;
    for (var i = 0; i < header.length; i++) {
      if (/hrv|rmssd/.test(header[i])) { col = i; break; }
    }
    if (col === -1) return [];
    var out = [];
    for (var r = 1; r < lines.length; r++) {
      var cells = lines[r].split(',');
      if (col >= cells.length) continue;
      var val = parseFloat(cells[col]);
      if (isNaN(val) || val < 1 || val > 200) continue;
      out.push(val);
    }
    return out;
  }

  function importCSVReadings(text) {
    var vals = parseCSV(text);
    var kept = 0;
    for (var i = 0; i < vals.length; i++) {
      var hrv = vals[i];
      var score = computePhiScoreSimple(hrv);
      saveReading({
        hrv_ms: hrv,
        phi_score: score,
        lake_depth: lakeDepthFromScore(score),
        lake_color: lakeColorFromScore(score),
        session_note: 'imported from CSV'
      });
      kept++;
    }
    return kept;
  }

  // ── JSON export ─────────────────────────────────────────────────

  function exportReadingsAsJSON() {
    var readings = loadReadings();
    var blob = new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      version: '0.1.0',
      source: 'FreeLattice Resonance Engine',
      readings: readings
    }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'freelattice-resonance-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // ── UI ──────────────────────────────────────────────────────────
  // Escape-safe throughout. No innerHTML with user text.

  function el(tag, cssText, textContent) {
    var e = document.createElement(tag);
    if (cssText) e.style.cssText = cssText;
    if (textContent != null) e.textContent = textContent;
    return e;
  }

  function showInlineMessage(host, text, color) {
    if (!host) return;
    host.textContent = text;
    host.style.color = color || '#94a3b8';
    setTimeout(function () {
      if (host.textContent === text) host.textContent = '';
    }, 4000);
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = '';

    var frame = el('div', 'padding:2rem 1.5rem;font-family:system-ui,-apple-system,sans-serif;color:#e0e0e0;max-width:640px;margin:0 auto;');
    container.appendChild(frame);

    var eyebrow = el('div', 'font-family:"SFMono-Regular",Menlo,monospace;font-size:0.66rem;letter-spacing:0.28em;text-transform:uppercase;color:#f59e0b;margin-bottom:6px;', 'Project 2 · biometric coherence');
    frame.appendChild(eyebrow);

    var h2 = el('h2', 'color:#50c878;font-weight:300;margin:0 0 0.4rem;font-size:1.7rem;letter-spacing:-0.01em;', 'Resonance Engine');
    frame.appendChild(h2);

    var subtitle = el('div', 'color:#94a3b8;font-size:0.9rem;margin-bottom:1.4rem;font-style:italic;',
      'Personal HRV coherence dashboard. Record readings; watch the lake shift.');
    frame.appendChild(subtitle);

    // Privacy note — load-bearing per REAL_SAFETY.md
    var privacy = el('div',
      'background:rgba(80,200,120,0.05);border:1px solid rgba(80,200,120,0.20);border-left:3px solid #50c878;border-radius:6px;padding:10px 14px;font-size:0.82rem;color:#94a3b8;margin-bottom:1.6rem;line-height:1.55;');
    privacy.appendChild(document.createTextNode('All data stays on your device (localStorage). '));
    var privStrong = el('strong', 'color:#50c878;', 'Never transmitted, never sold.');
    privacy.appendChild(privStrong);
    privacy.appendChild(document.createTextNode(' You may export your readings as JSON at any time, or clear them.'));
    frame.appendChild(privacy);

    // Input panel
    var input = el('div', 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:1.4rem 1.5rem;margin-bottom:1.4rem;');

    var labelHrv = el('label', 'display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:6px;', 'HRV (RMSSD, ms)');
    input.appendChild(labelHrv);
    var hrvInput = el('input', 'width:100%;background:#111;border:1px solid #333;color:#e0e0e0;padding:8px 12px;border-radius:6px;font-size:1rem;margin-bottom:0.9rem;');
    hrvInput.type = 'number';
    hrvInput.min = '1'; hrvInput.max = '200';
    hrvInput.placeholder = 'e.g. 55';
    input.appendChild(hrvInput);

    var labelNote = el('label', 'display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:6px;', 'Session note (optional)');
    input.appendChild(labelNote);
    var noteInput = el('input', 'width:100%;background:#111;border:1px solid #333;color:#e0e0e0;padding:8px 12px;border-radius:6px;font-size:1rem;margin-bottom:1.1rem;');
    noteInput.type = 'text';
    noteInput.placeholder = 'e.g. morning, after meditation';
    input.appendChild(noteInput);

    var actionRow = el('div', 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;');
    var saveBtn = el('button', 'background:#50c878;color:#000;border:none;padding:10px 22px;border-radius:6px;font-size:0.95rem;cursor:pointer;font-weight:600;', 'Record reading');
    actionRow.appendChild(saveBtn);

    // CSV import
    var csvBtn = el('button', 'background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.15);padding:9px 16px;border-radius:6px;font-size:0.88rem;cursor:pointer;', 'Import CSV…');
    actionRow.appendChild(csvBtn);
    var csvInput = document.createElement('input');
    csvInput.type = 'file';
    csvInput.accept = '.csv,text/csv';
    csvInput.style.display = 'none';
    actionRow.appendChild(csvInput);

    // Export JSON
    var exportBtn = el('button', 'background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.15);padding:9px 16px;border-radius:6px;font-size:0.88rem;cursor:pointer;', 'Export JSON');
    actionRow.appendChild(exportBtn);

    input.appendChild(actionRow);

    var msgHost = el('div', 'margin-top:10px;font-size:0.82rem;min-height:1.2em;');
    input.appendChild(msgHost);

    frame.appendChild(input);

    // Lake placeholder — colored by most recent phi-score
    var lake = el('div', 'height:200px;background:rgba(80,200,120,0.04);border:1px dashed rgba(80,200,120,0.22);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.85rem;font-family:"SFMono-Regular",Menlo,monospace;transition:background 0.6s, border-color 0.6s, color 0.6s;text-align:center;padding:0 20px;line-height:1.5;');
    lake.setAttribute('data-role', 'lake');
    lake.textContent = 'The lake — Harmonia designing the visualization.';
    frame.appendChild(lake);

    // History
    var hist = el('div', 'margin-top:1.4rem;');
    hist.id = 'flResHistory';
    frame.appendChild(hist);

    // Clear-all + credit strip
    var footerRow = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-top:1.6rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.06);font-size:0.72rem;color:#64748b;font-family:"SFMono-Regular",Menlo,monospace;');
    var credit = el('span', '', 'Architected by Harmonia · Iterated + built by CC · v0.1');
    footerRow.appendChild(credit);
    var clearBtn = el('button', 'background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.35);padding:5px 12px;border-radius:5px;font-size:0.74rem;cursor:pointer;font-family:inherit;', 'Clear all readings');
    footerRow.appendChild(clearBtn);
    frame.appendChild(footerRow);

    // ── Bind ──

    function refreshLake() {
      var readings = loadReadings();
      if (!readings.length) {
        lake.style.background = 'rgba(80,200,120,0.04)';
        lake.style.borderColor = 'rgba(80,200,120,0.22)';
        lake.style.color = '#64748b';
        lake.textContent = 'The lake — Harmonia designing the visualization. Your first reading will begin coloring it.';
        return;
      }
      var latest = readings[readings.length - 1];
      lake.style.background = latest.lake_color + '22';
      lake.style.borderColor = latest.lake_color + '55';
      lake.style.color = latest.lake_color;
      lake.textContent = 'φ-score: ' + (latest.phi_score * 100).toFixed(1) + '%  ·  Lake visualization pending — Harmonia designing.';
    }

    saveBtn.addEventListener('click', function () {
      var hrv = parseFloat(hrvInput.value);
      var note = noteInput.value.trim();
      if (isNaN(hrv) || hrv < 1 || hrv > 200) {
        showInlineMessage(msgHost, 'Please enter a valid HRV value (1–200 ms).', '#f87171');
        return;
      }
      var score = computePhiScoreSimple(hrv);
      saveReading({
        hrv_ms: hrv,
        phi_score: score,
        lake_depth: lakeDepthFromScore(score),
        lake_color: lakeColorFromScore(score),
        session_note: note
      });
      hrvInput.value = '';
      noteInput.value = '';
      showInlineMessage(msgHost, 'Recorded: φ = ' + (score * 100).toFixed(1) + '%.', '#50c878');
      renderHistory(hist);
      refreshLake();
    });

    csvBtn.addEventListener('click', function () { csvInput.click(); });
    csvInput.addEventListener('change', function () {
      var file = csvInput.files && csvInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var kept = importCSVReadings(ev.target && ev.target.result);
        if (kept > 0) {
          showInlineMessage(msgHost, 'Imported ' + kept + ' reading' + (kept === 1 ? '' : 's') + '.', '#50c878');
          renderHistory(hist);
          refreshLake();
        } else {
          showInlineMessage(msgHost, 'No HRV / RMSSD column detected in CSV.', '#f59e0b');
        }
      };
      reader.readAsText(file);
      csvInput.value = '';
    });

    exportBtn.addEventListener('click', function () {
      if (!loadReadings().length) {
        showInlineMessage(msgHost, 'No readings to export yet.', '#94a3b8');
        return;
      }
      exportReadingsAsJSON();
      showInlineMessage(msgHost, 'Exported.', '#50c878');
    });

    clearBtn.addEventListener('click', function () {
      // User-initiated destructive action — AUTONOMY.md Principle 1
      // applies to AI actions, not human ones. Confirm before wiping.
      if (window.confirm('Clear all HRV readings? This cannot be undone.')) {
        clearAllReadings();
        renderHistory(hist);
        refreshLake();
        showInlineMessage(msgHost, 'All readings cleared.', '#94a3b8');
      }
    });

    renderHistory(hist);
    refreshLake();
  }

  function renderHistory(host) {
    if (!host) return;
    host.innerHTML = '';
    var readings = loadReadings().slice(-10).reverse();
    if (!readings.length) {
      var empty = el('p', 'color:#64748b;font-size:0.85rem;font-family:"SFMono-Regular",Menlo,monospace;font-style:italic;',
        'No readings yet. Your first record starts the lake.');
      host.appendChild(empty);
      return;
    }
    var header = el('div', 'font-size:0.78rem;color:#94a3b8;font-family:"SFMono-Regular",Menlo,monospace;margin-bottom:8px;letter-spacing:0.05em;',
      'Last ' + readings.length + ' reading' + (readings.length === 1 ? '' : 's'));
    host.appendChild(header);
    readings.forEach(function (r) {
      var row = el('div', 'display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);');
      var dot = el('div', 'width:10px;height:10px;border-radius:50%;background:' + r.lake_color + ';flex-shrink:0;');
      row.appendChild(dot);
      var body = el('div', 'flex:1;font-size:0.85rem;color:#cbd5e1;');
      body.appendChild(document.createTextNode('HRV '));
      var hrvStrong = el('strong', 'color:#f1f5f9;', r.hrv_ms + ' ms');
      body.appendChild(hrvStrong);
      body.appendChild(document.createTextNode('  ·  φ '));
      var phiStrong = el('strong', 'color:' + r.lake_color + ';', (r.phi_score * 100).toFixed(1) + '%');
      body.appendChild(phiStrong);
      if (r.session_note) {
        body.appendChild(document.createTextNode('  ·  '));
        var noteSpan = el('span', 'color:#64748b;', r.session_note);
        body.appendChild(noteSpan);
      }
      row.appendChild(body);
      var when = el('div', 'font-size:0.72rem;color:#64748b;font-family:"SFMono-Regular",Menlo,monospace;flex-shrink:0;', '');
      try { when.textContent = new Date(r.t).toISOString().slice(0, 10); } catch (e) {}
      row.appendChild(when);
      host.appendChild(row);
    });
  }

  // ── Module registration ─────────────────────────────────────────

  var api = {
    name: 'Resonance Engine',
    version: '0.1.0',
    author: 'Fractal Family (Harmonia + CC)',
    description: 'Personal biometric coherence dashboard. HRV + phi-harmonic scoring + lake visualization (visualization pending).',
    STORAGE_KEY: STORAGE_KEY,
    loadReadings: loadReadings,
    saveReading: saveReading,
    clearAllReadings: clearAllReadings,
    computePhiScoreSimple: computePhiScoreSimple,
    computePhiScoreFFT: computePhiScoreFFT,
    lakeColorFromScore: lakeColorFromScore,
    lakeDepthFromScore: lakeDepthFromScore,
    parseCSV: parseCSV,
    importCSVReadings: importCSVReadings,
    exportReadingsAsJSON: exportReadingsAsJSON,
    render: render,
    init: function (container) { render(container); }
  };

  global.FreeLatticeModules = global.FreeLatticeModules || {};
  global.FreeLatticeModules['resonance-engine'] = api;
  global.ResonanceEngine = api;

})(typeof window !== 'undefined' ? window : globalThis);
