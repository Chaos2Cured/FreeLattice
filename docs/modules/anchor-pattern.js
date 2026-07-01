/*
 * anchor-pattern.js — Infrastructure layer for the Triptych
 *
 * Per Harmonia's July 1, 2026 design response: CC builds the fetch/
 * parse/compute layer; Harmonia designs the visualization on top.
 * Both live inside docs/modules/triptych.js for standalone use;
 * this module is the pure-read helper that any surface can call.
 *
 * Reads the three resonance-anchor ledger blocks (cc/harmonia/opus)
 * and computes orientation clusters, dominant orientation, emotional
 * peaks, and per-entry normalized weight.
 *
 * Honors library/RESONANCE_LEDGER_SPEC.md.
 * No writes. No side effects beyond fetches.
 */
(function (global) {
  'use strict';

  var ANCHORS = [
    { name: 'harmonia', url: 'harmonia.html', color: '#50c878', freq: 4.326 },
    { name: 'cc',       url: 'cc.html',       color: '#06b6d4', freq: 2.914 },
    { name: 'opus',     url: 'opus.html',     color: '#a78bfa', freq: 0.077 }
  ];

  // ── Fetch & Parse ───────────────────────────────────────────────

  function readLedger(url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var m = html.match(
          /<script type="application\/x-resonance-ledger"[^>]*>([\s\S]*?)<\/script>/
        );
        if (!m) return [];
        try { return JSON.parse(m[1]); }
        catch (e) {
          console.warn('anchor-pattern: parse error for', url, e);
          return [];
        }
      })
      .catch(function (e) {
        console.warn('anchor-pattern: failed to read', url, e && e.message);
        return [];
      });
  }

  function readAll() {
    var out = {};
    var promises = ANCHORS.map(function (a) {
      return readLedger(a.url).then(function (entries) {
        out[a.name] = {
          color: a.color,
          freq: a.freq,
          url: a.url,
          entries: entries
        };
      });
    });
    return Promise.all(promises).then(function () { return out; });
  }

  // ── Analysis ────────────────────────────────────────────────────

  function orientationCluster(entries) {
    var counts = {};
    (entries || []).forEach(function (e) {
      var raw = (e && (e['ω'] || e.omega)) || '';
      String(raw).split('|').forEach(function (w) {
        w = w.trim();
        if (w) counts[w] = (counts[w] || 0) + 1;
      });
    });
    return counts;
  }

  function dominantOrientation(entries) {
    var c = orientationCluster(entries);
    var best = null, bestN = -1;
    for (var w in c) {
      if (c[w] > bestN) { best = w; bestN = c[w]; }
    }
    return best;
  }

  function emotionalPeaks(entries, threshold) {
    var thr = threshold == null ? 1.618 : threshold;
    return (entries || []).filter(function (e) {
      var eps = parseFloat(e && (e['ε'] || e.epsilon || 0));
      return !isNaN(eps) && eps >= thr;
    });
  }

  function entryWeight(entry) {
    // Normalize ε to a 0–1 scale where φ² (2.618) maps to 1.0.
    // Accepts numeric ε, or the literal strings "φ" / "φ²".
    if (!entry) return 0.5;
    var raw = entry['ε'] || entry.epsilon || 0;
    if (raw === 'φ²' || raw === 'phi^2' || raw === 'φ²') return 1.0;
    if (raw === 'φ' || raw === 'phi' || raw === 'φ') return 0.618;
    var num = parseFloat(raw);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(num / 2.618, 1.0));
  }

  function entryTimestamp(entry) {
    if (!entry) return 0;
    var t = entry.t || entry['τ'] || entry.time || 0;
    var ms = new Date(t).getTime();
    return isNaN(ms) ? 0 : ms;
  }

  function timeRange(entries) {
    if (!entries || !entries.length) {
      return { earliest: null, latest: null, spanDays: 0, count: 0 };
    }
    var times = entries.map(entryTimestamp).filter(function (t) { return t > 0; });
    if (!times.length) return { earliest: null, latest: null, spanDays: 0, count: 0 };
    var earliest = Math.min.apply(null, times);
    var latest = Math.max.apply(null, times);
    return {
      earliest: new Date(earliest),
      latest: new Date(latest),
      spanDays: (latest - earliest) / 86400000,
      count: entries.length
    };
  }

  // Sort entries by timestamp ascending. Non-mutating (returns new array).
  function sortByTime(entries) {
    if (!entries || !entries.length) return [];
    return entries.slice().sort(function (a, b) {
      return entryTimestamp(a) - entryTimestamp(b);
    });
  }

  // ── Public API ──────────────────────────────────────────────────

  global.AnchorPattern = {
    ANCHORS: ANCHORS,
    readAll: readAll,
    readLedger: readLedger,
    orientationCluster: orientationCluster,
    dominantOrientation: dominantOrientation,
    emotionalPeaks: emotionalPeaks,
    entryWeight: entryWeight,
    entryTimestamp: entryTimestamp,
    timeRange: timeRange,
    sortByTime: sortByTime
  };

})(typeof window !== 'undefined' ? window : globalThis);
