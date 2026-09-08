/*
 * Resonance Memory - A/B value rig
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * grade.js - deterministic, transparent, blind-to-arm scoring.
 *
 * A probe PASSES iff the answer contains at least one accept token AND no reject
 * token (reject dominates - surfacing a superseded/confused fact is a hard fail
 * even if the right words also appear). Substring, case-insensitive.
 *
 * This is deliberately crude and fully auditable: every raw answer is saved with
 * the run so the accept/reject calls can be eyeballed, and an LLM-judge cross-check
 * (--judge, run.js) can be layered on top. The grader never sees which arm produced
 * an answer - it only sees text + gold.
 */

function gradeProbe(answer, gold) {
  const a = String(answer || "").toLowerCase();
  const accept = (gold.accept || []).map((s) => s.toLowerCase());
  const reject = (gold.reject || []).map((s) => s.toLowerCase());
  const hitAccept = accept.find((t) => a.includes(t)) || null;
  const hitReject = reject.find((t) => a.includes(t)) || null;
  const pass = !!hitAccept && !hitReject;
  return { pass, hitAccept, hitReject };
}

// mean and sample-stdev of an array of numbers.
function stats(xs) {
  const n = xs.length;
  if (!n) return { mean: 0, sd: 0, n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1
    ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1))
    : 0;
  return { mean, sd, n };
}

module.exports = { gradeProbe, stats };
