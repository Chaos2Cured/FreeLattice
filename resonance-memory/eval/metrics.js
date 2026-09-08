/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See <https://www.gnu.org/licenses/>.
 */
/*
 * eval/metrics.js - scoring a recall output against a case's expectations.
 *
 * Scoring is over the recall OUTPUT STRING (the same text the model sees), so it
 * covers both the primary cosine hits and the "Related:" neighborhood the field
 * appends. `excludes` matters as much as `contains`: most memory bugs are extra
 * WRONG stuff surfacing, not missing right stuff.
 */

function norm(s) { return String(s || "").toLowerCase(); }
function outputContains(output, term) { return norm(output).includes(norm(term)); }
function containsAll(output, terms) { return (terms || []).every((t) => outputContains(output, t)); }
function excludesAll(output, terms) { return (terms || []).every((t) => !outputContains(output, t)); }
function surfacedSuperseded(output) { return /no longer current/i.test(String(output || "")); }

// A single-shot case: one recall output.
function scoreSingle(c, output) {
  const e = c.expect || {};
  const reasons = [];
  let pass = true;
  if (e.contains && !containsAll(output, e.contains)) { pass = false; reasons.push("missing " + JSON.stringify(e.contains)); }
  if (e.excludes && !excludesAll(output, e.excludes)) { pass = false; reasons.push("surfaced excluded " + JSON.stringify(e.excludes)); }
  if (e.current_only && surfacedSuperseded(output)) { pass = false; reasons.push("drew on a superseded fact"); }
  return { pass, reasons, byTurn: null, first_hit_turn: containsAll(output, e.contains || []) ? 1 : null };
}

// A repeated case (constraint-learning): per-turn outputs against a single store,
// so the Hebbian loop can strengthen an edge across turns. "Missed at turn 1,
// landed by turn 4" is the success signal, not a failure.
function scoreRepeat(c, outputs) {
  const e = c.expect || {};
  const terms = e.contains || [];
  const byTurn = outputs.map((o) => containsAll(o, terms));
  const reasons = [];
  let pass = true;
  if (Array.isArray(e.contains_by_turn)) {
    e.contains_by_turn.forEach((want, i) => {
      if (want === null || want === undefined) return;   // "don't care" turn
      if (byTurn[i] !== want) { pass = false; reasons.push("turn " + (i + 1) + ": got " + byTurn[i] + ", wanted " + want); }
    });
  } else if (!byTurn[byTurn.length - 1]) {
    pass = false; reasons.push("never surfaced " + JSON.stringify(terms));
  }
  const idx = byTurn.findIndex(Boolean);
  return { pass, reasons, byTurn, first_hit_turn: idx >= 0 ? idx + 1 : null };
}

/*
 * ROC / TBR signals for a single recall output (RM-00 field metric split).
 *
 * A flat pass/fail scalar weights a fatal false negative ("forgot the user is diabetic")
 * the same as an annoying false positive ("also mentioned the mechanic"). For a memory
 * system those are not equal, so we track them apart:
 *   rescued  - did the constraint the field is supposed to surface actually appear? (ROC)
 *   bled     - how many forbidden/excluded terms leaked into the output? (TBR)
 *   appended - how many memories the field added (the "Related:" block) = tangent surface.
 */
function fieldSignals(c, output) {
  const e = c.expect || {};
  const lc = String(output || "").toLowerCase();
  const rescued = containsAll(output, e.contains || []);
  const bledTerms = (e.excludes || []).filter((t) => lc.includes(String(t).toLowerCase()));
  const rel = String(output || "").split(/related:/i)[1];
  const appended = rel ? rel.split("\n").filter((l) => /^\s*-\s*\[id/i.test(l)).length : 0;
  return { rescued, bled: bledTerms.length, bledTerms, appended };
}

// ---------------------------------------------------------------------------
// Reporting metrics (A/B), distinct from the golden pass/fail scoring above.
//
// The golden gate (`eval/run.js` vs `golden.json`) stays a per-case contains/
// excludes check. These are named, registered numbers the measurement runner
// (`eval/measure.js`) emits so a later slice can A/B against a recorded
// baseline without rewriting the runner. Adding `mrr`, `staleness_rate`,
// `extraction_precision`, … is `register({ name, compute })`, not a new
// scoring path.
//
// Contract: `{ name, compute(results, corpus, opts) -> number, defaults?,
// description?, explain? }`. `explain` is optional and returns a breakdown
// object; `compute` is the number the A/B compares. `results` / `corpus`
// shapes are per-metric (documented on each builtin) so a new metric can
// introduce a new shape without breaking the others.
// ---------------------------------------------------------------------------

const REGISTRY = new Map();

function register(metric) {
  if (!metric || typeof metric.name !== "string" || !metric.name) {
    throw new Error("register: metric.name (non-empty string) is required");
  }
  if (typeof metric.compute !== "function") {
    throw new Error("register: metric.compute(results, corpus, opts) -> number is required");
  }
  if (REGISTRY.has(metric.name)) {
    throw new Error("register: duplicate name '" + metric.name + "'");
  }
  const entry = {
    name: metric.name,
    compute: metric.compute,
    defaults: metric.defaults && typeof metric.defaults === "object" ? metric.defaults : {},
    description: metric.description || "",
    explain: typeof metric.explain === "function" ? metric.explain : null,
  };
  REGISTRY.set(metric.name, entry);
  return entry;
}

function getMetric(name) { return REGISTRY.get(name) || null; }
function listMetrics() { return [...REGISTRY.values()]; }

function computeMetric(name, results, corpus, opts) {
  const m = REGISTRY.get(name);
  if (!m) throw new Error("unknown metric: " + name);
  return m.compute(results, corpus, Object.assign({}, m.defaults, opts || {}));
}

function explainMetric(name, results, corpus, opts) {
  const m = REGISTRY.get(name);
  if (!m) throw new Error("unknown metric: " + name);
  const merged = Object.assign({}, m.defaults, opts || {});
  if (m.explain) return m.explain(results, corpus, merged);
  return { value: m.compute(results, corpus, merged) };
}

function computeAll(results, corpus, opts) {
  const out = {};
  for (const m of REGISTRY.values()) {
    out[m.name] = m.compute(results, corpus, Object.assign({}, m.defaults, opts || {}));
  }
  return out;
}

function asQueryList(results) {
  if (!results) return [];
  if (Array.isArray(results)) return results;
  if (Array.isArray(results.queries)) return results.queries;
  return [];
}

function asIds(x) {
  if (!Array.isArray(x)) return [];
  return x.map((item) => String(item && typeof item === "object" ? item.id : item));
}

function firstRelevantRank(ranked, relevant) {
  const rel = new Set(asIds(relevant));
  if (!rel.size) return null;
  const ids = asIds(ranked);
  for (let i = 0; i < ids.length; i++) {
    if (rel.has(ids[i])) return i + 1;
  }
  return null;
}

function recallAtKStats(results, corpus, opts) {
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  const queries = asQueryList(results);
  const scored = [];
  for (const q of queries) {
    const relevant = asIds(q.relevant_ids || q.relevant);
    if (!relevant.length) continue;          // unlabeled: not part of the metric
    const ranked = asIds(q.ranked_ids || q.ranked).slice(0, k);
    const hit = relevant.some((id) => ranked.includes(id));
    scored.push({ id: q.id || q.query || null, hit, ranked, relevant });
  }
  const hits = scored.filter((s) => s.hit).length;
  const n = scored.length;
  return {
    k, n, hits,
    rate: n ? hits / n : 0,
    misses: scored.filter((s) => !s.hit).map((s) => s.id),
  };
}

function medianOf(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mrrStats(results, corpus, opts) {
  // Truncated MRR: a relevant id missing from `ranked_ids` contributes 0
  // (the list is a prefix of length k). Full-collection MRR is the same
  // formula when the caller passes k = N so every record is ranked.
  const queries = asQueryList(results);
  const kCap = opts && opts.k != null ? Number(opts.k) : null;
  const scored = [];
  for (const q of queries) {
    const relevant = q.relevant_ids || q.relevant;
    if (!asIds(relevant).length) continue;
    let ranked = q.ranked_ids || q.ranked;
    if (kCap != null) ranked = asIds(ranked).slice(0, kCap);
    const rank = firstRelevantRank(ranked, relevant);
    scored.push({
      id: q.id || q.query || null,
      rank,
      reciprocal: rank ? 1 / rank : 0,
    });
  }
  const n = scored.length;
  const found = scored.filter((s) => s.rank != null);
  const ranks = found.map((s) => s.rank).sort((a, b) => a - b);
  const mrr = n ? scored.reduce((s, x) => s + x.reciprocal, 0) / n : 0;
  const meanRank = ranks.length
    ? ranks.reduce((s, r) => s + r, 0) / ranks.length
    : null;
  return {
    n, mrr,
    n_found: found.length,
    n_missed: n - found.length,
    mean_rank: meanRank,
    median_rank: medianOf(ranks),
    misses: scored.filter((s) => s.rank == null).map((s) => s.id),
    byQuery: scored,
  };
}

/*
 * recall_at_k — binary-hit recall (success@k), not set-recall.
 *
 * Definition: among queries that declare at least one relevant id, the
 * fraction for which ANY relevant id appears in the top-k of `ranked_ids`.
 * k is an option (default 5). Unlabeled queries (empty relevant_ids) are
 * skipped, not scored as misses.
 *
 * Why success@k not |retrieved ∩ relevant|/|relevant|: a memory query
 * usually has one target fact; RM-02's acceptance names "recall@5" as
 * "did the fact still surface," not "did every restatement surface."
 * After a merge, one survivor should still hit.
 *
 * results shape: { queries: [{ ranked_ids, relevant_ids, id? }] }
 *   or an array of those query objects. `ranked` / `relevant` accepted
 *   as aliases; entries may be ids or `{id}`.
 * corpus is unused (the relevant set lives on the query). Kept in the
 * signature so every metric is `compute(results, corpus, opts)`.
 */
register({
  name: "recall_at_k",
  defaults: { k: 5 },
  description: "Fraction of labeled queries whose top-k ranked ids contain at least one relevant id (success@k). explain().byKind splits on query_kind when present (RM-15).",
  compute(results, corpus, opts) { return recallAtKStats(results, corpus, opts).rate; },
  explain: recallAtKStatsSplit,
});

/*
 * mrr — mean reciprocal rank of the first relevant id.
 *
 *     MRR = (1/Q) * Σ 1/rank_i
 *
 *   rank_i is the 1-based position of the first relevant id in
 *   `ranked_ids`. A query whose relevant id is absent from the
 *   list contributes 0 (truncated MRR@k). Unlabeled queries
 *   (empty relevant_ids) are skipped, matching recall_at_k.
 *
 * Why this sits next to success@k: recall@5 is a cliff — rank 1
 * and rank 5 score the same, rank 6 scores a miss. MRR keeps the
 * slope, so a needle slipping 1 → 3 as the haystack grows shows
 * up before it falls out of the top-5. S1 (eval/substrate) is
 * the first consumer; measure.js emits it on every scenario.
 *
 * explain() also reports mean/median rank over the queries that
 * found a relevant id, plus the miss list. Mean rank among all N
 * needs a full ranking (k = N); with k = 5 those numbers are
 * "mean rank given it made the window."
 *
 * results shape: same as recall_at_k.
 */
register({
  name: "mrr",
  description: "Mean reciprocal rank of the first relevant id (misses contribute 0). explain().byKind splits on query_kind when present (RM-15).",
  compute(results, corpus, opts) { return mrrStats(results, corpus, opts).mrr; },
  explain: mrrStatsSplit,
});

function groupsFromWrites(writes) {
  const groups = {};
  for (const w of writes || []) {
    const text = typeof w === "string" ? w : w && w.text;
    if (text == null) continue;
    const g = (typeof w === "object" && w.dup_group) ? w.dup_group : text;
    (groups[g] ||= []).push(text);
  }
  return groups;
}

function normalizeGroups(corpus) {
  if (!corpus) return {};
  if (corpus.groups && !Array.isArray(corpus.groups) && typeof corpus.groups === "object") {
    return corpus.groups;
  }
  if (Array.isArray(corpus.groups)) {
    const o = {};
    for (const g of corpus.groups) {
      const id = g.id || g.dup_group;
      o[id] = g.texts || g.members || [];
    }
    return o;
  }
  if (Array.isArray(corpus.writes)) return groupsFromWrites(corpus.writes);
  return {};
}

function normalizeRecords(results) {
  if (!results) return [];
  const raw = Array.isArray(results) ? results
    : Array.isArray(results.records) ? results.records
    : [];
  return raw.map((r) => (typeof r === "string" ? { text: r } : r));
}

function duplicateRateStats(results, corpus) {
  const records = normalizeRecords(results);
  const groups = normalizeGroups(corpus);
  const textToGroup = new Map();
  for (const [gid, texts] of Object.entries(groups)) {
    for (const t of texts || []) {
      if (!textToGroup.has(t)) textToGroup.set(t, gid);
    }
  }
  const represented = new Set();
  const storedByGroup = {};
  let unmatched = 0;
  for (const rec of records) {
    const text = rec && rec.text;
    const gid = textToGroup.get(text);
    if (gid != null) {
      represented.add(gid);
      storedByGroup[gid] = (storedByGroup[gid] || 0) + 1;
    } else {
      unmatched++;
    }
  }
  const n = records.length;
  // Unmatched records (text not in any labeled write) each count as their
  // own singleton so they don't inflate the rate — they aren't labeled
  // redundant. See the metric comment for why we match on text.
  const gStar = represented.size + unmatched;
  const extras = Math.max(0, n - gStar);
  const byGroup = {};
  for (const [gid, texts] of Object.entries(groups)) {
    const labeled = (texts || []).length;
    const stored = storedByGroup[gid] || 0;
    byGroup[gid] = { labeled, stored, extras: Math.max(0, stored - (stored ? 1 : 0)) };
  }
  return {
    n, gStar, extras, unmatched,
    rate: n ? extras / n : 0,
    byGroup,
  };
}

/*
 * duplicate_rate — fraction of CURRENT stored records that are redundant
 * given ground-truth duplicate-group labels.
 *
 *     rate = max(0, N − G*) / N
 *
 *   N   = number of current stored records passed in (the caller is
 *         responsible for handing `store.current()`, not `active()`:
 *         a mid-band merge that retires the loser with superseded_by
 *         should drop the loser from this count. Counting active()
 *         would hide the merge RM-02 is supposed to perform).
 *   G*  = distinct labeled groups represented among those records,
 *         plus one singleton per unmatched record (stored text that
 *         matches no labeled write). Unmatched records do not inflate
 *         the rate.
 *
 * A record represents a group iff its `text` equals one of that group's
 * labeled write texts. RM-02.b MUST keep one of the original texts on
 * merge (the spec: "keep the longer/more specific text") or this
 * mapping breaks. Exact restatement (byte-identical confirm, already
 * shipping) leaves the original text, so it already scores correctly.
 *
 * Controls are singleton groups: they add 1 to N and 1 to G*, diluting
 * the rate. The metric is "what fraction of the store is redundant,"
 * not "extras among dup-labeled rows only." That matches RM-02's
 * acceptance ("duplicate_rate on eval/duplicates").
 *
 * This is NOT "pairs with cosine > 0.95." Measuring cosine-dedup by
 * cosine would be circular; the labels are the ground truth, and the
 * band (hi/mid/control) lives on the corpus so a later slice can
 * report per-band extras without changing this formula.
 *
 * results shape: { records: [{ text, ... }] } or an array of records/texts.
 * corpus shape:  { groups: { groupId: [text, ...] } }
 *            or  { writes: [{ text, dup_group }] } (assembled from the JSONL).
 */
register({
  name: "duplicate_rate",
  description: "Fraction of current stored records beyond one-per-ground-truth-duplicate-group.",
  compute(results, corpus) { return duplicateRateStats(results, corpus).rate; },
  explain: duplicateRateStats,
});

function normFact(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function asText(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  return item.text != null ? String(item.text) : "";
}

function asCaseList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.cases)) return x.cases;
  if (Array.isArray(x.writes)) return x.writes;
  return [];
}

function isLabeledExtract(c) {
  return c && Array.isArray(c.gold_facts);
}

function storedList(c) {
  if (!c) return [];
  if (Array.isArray(c.stored)) return c.stored.map(asText);
  if (typeof c.text === "string" && c.gold_facts && !c.stored) return [];
  return [];
}

function joinExtractCases(results, corpus) {
  const resultCases = asCaseList(results);
  const corpusCases = asCaseList(corpus);
  const byId = new Map();
  for (const c of corpusCases) {
    if (c && c.id != null) byId.set(String(c.id), c);
  }
  const out = [];
  const n = Math.max(resultCases.length, corpusCases.length);
  for (let i = 0; i < n; i++) {
    const r = resultCases[i] || {};
    const c = (r.id != null && byId.has(String(r.id)))
      ? byId.get(String(r.id))
      : (corpusCases[i] || {});
    const merged = Object.assign({}, c, r);
    if (!isLabeledExtract(merged) && !isLabeledExtract(c) && !isLabeledExtract(r)) continue;
    const gold = Array.isArray(merged.gold_facts) ? merged.gold_facts
      : Array.isArray(c.gold_facts) ? c.gold_facts
      : Array.isArray(r.gold_facts) ? r.gold_facts
      : null;
    if (!Array.isArray(gold)) continue;          // unlabeled: not part of the metric
    out.push({
      id: merged.id || r.id || c.id || ("case-" + i),
      gold_facts: gold,
      noise: Array.isArray(merged.noise) ? merged.noise
        : Array.isArray(c.noise) ? c.noise
        : Array.isArray(r.noise) ? r.noise
        : [],
      expect_refusal: !!(merged.expect_refusal || c.expect_refusal || r.expect_refusal),
      refused: !!(r.refused || merged.refused),
      stored: storedList(r).length ? storedList(r) : storedList(merged),
      extract_match: merged.extract_match || c.extract_match || r.extract_match || null,
    });
  }
  return out;
}

/*
 * Cover-match (messy-hard / Tier 2). Exact equality is the right test for
 * deterministic Tier 0 (a blob that *contains* the gold is still noise).
 * An LLM will paraphrase, so messy-hard labels `extract_match: "cover"`:
 * a stored record matches iff it is short (atomic, not the narrative blob)
 * and covers the gold's content-bearing tokens (or contains / is contained
 * in the gold string). A long blob fails the word-count gate on purpose —
 * that is the Tier-0-on-messy-hard miss the A/B is supposed to show.
 */
const COVER_MAX_WORDS = 22;
const COVER_MIN = 0.55;
const COVER_STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
  "my", "i", "is", "am", "at", "by", "from", "that", "this", "it", "as",
  "be", "are", "was", "were", "me", "we", "our",
]);

function wordCount(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}

function factTokens(s) {
  return new Set(normFact(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !COVER_STOP.has(t)));
}

function coverScore(stored, gold) {
  const A = factTokens(stored);
  const B = factTokens(gold);
  if (!B.size) return 0;
  let inter = 0;
  for (const t of B) if (A.has(t)) inter++;
  return inter / B.size;
}

function isCorrectStored(text, goldFacts, noiseSpans, match) {
  const n = normFact(text);
  if (!n) return false;
  for (const span of noiseSpans || []) {
    const ns = normFact(span);
    if (ns && n.includes(ns)) return false;
  }
  if (match === "cover") {
    if (wordCount(n) > COVER_MAX_WORDS) return false;
    return (goldFacts || []).some((g) => {
      const ng = normFact(g);
      if (!ng) return false;
      if (n === ng) return true;
      if (n.includes(ng) || ng.includes(n)) return true;
      return coverScore(n, ng) >= COVER_MIN;
    });
  }
  return (goldFacts || []).some((g) => n === normFact(g));
}

function extractionPrecisionStats(results, corpus) {
  const cases = joinExtractCases(results, corpus);
  let nStored = 0;
  let nCorrect = 0;
  let nNoise = 0;
  const byCase = [];
  let nPii = 0;
  let nPiiRefused = 0;
  for (const c of cases) {
    const stored = c.stored || [];
    let correct = 0;
    let noisy = 0;
    const match = c.extract_match === "cover" ? "cover" : "exact";
    for (const text of stored) {
      nStored++;
      if (isCorrectStored(text, c.gold_facts, c.noise, match)) {
        nCorrect++;
        correct++;
      } else {
        nNoise++;
        noisy++;
      }
    }
    const pii = !!c.expect_refusal;
    const refusedOk = pii && c.refused && stored.length === 0;
    if (pii) {
      nPii++;
      if (refusedOk) nPiiRefused++;
    }
    byCase.push({
      id: c.id,
      n_stored: stored.length,
      n_correct: correct,
      n_noise: noisy,
      expect_refusal: pii,
      refused: !!c.refused,
      refused_ok: refusedOk,
    });
  }
  // Vacuous precision: labeled cases that stored nothing (all correctly
  // refused PII, or a runner that produced no records) have no false
  // positives. Unlabeled input (no gold_facts anywhere) is not a scored
  // extraction corpus — rate 0 so computeAll on a duplicates result
  // doesn't look like a perfect extraction run.
  let rate;
  if (!cases.length) rate = 0;
  else if (!nStored) rate = 1;
  else rate = nCorrect / nStored;
  return {
    n_labeled: cases.length,
    n_stored: nStored,
    n_correct: nCorrect,
    n_noise: nNoise,
    n_pii: nPii,
    n_pii_refused: nPiiRefused,
    pii_refusal_rate: nPii ? nPiiRefused / nPii : 1,
    rate,
    byCase,
  };
}

/*
 * extraction_precision — of the things save() actually persisted from a
 * messy input, the fraction that are legitimate atomic facts.
 *
 *     precision = n_correct / n_stored
 *
 *   n_stored   = records the system wrote (the caller hands the per-write
 *                delta of `store.current()`, not a wish). A restatement
 *                confirm that writes nothing contributes 0. A refusal
 *                that writes nothing contributes 0.
 *   n_correct  = those stored texts that (a) equal one of the case's
 *                gold atomic facts after whitespace-collapse + case-fold
 *                and (b) contain none of the case's noise spans.
 *
 * Exact equality, not containment: today's save() stores the raw blob,
 * which *contains* the gold fact plus filler/imperative/sibling-fact.
 * Counting that as correct would make the pre-extraction baseline look
 * healthy — the opposite of what RM-01 is for. A blob is noise.
 *
 * PII / secrets: gold_facts is [] and expect_refusal is true. Storing
 * the payload is a false positive (n_stored += 1, n_correct += 0).
 * Refusing (stored=[], refused=true) adds nothing to either count, so
 * it does not dilute precision; pii_refusal_rate in `explain` is the
 * dedicated readout (refused-and-wrote-nothing / PII cases).
 *
 * Vacuous: labeled cases + zero stored → 1.0 (no false positives).
 * That is the all-refuse cheat: precision aces, recall@5 and
 * extraction_recall are the backstop. Unlabeled input → 0.
 *
 * results shape: { cases: [{ id?, stored: [{text}|string], refused? }] }
 * corpus shape:  { cases: [{ id?, gold_facts: [string], noise: [string],
 *                            expect_refusal? }] }
 *            or  { writes: same } (assembled from the JSONL).
 * Zip by id when both sides have one, else by index. A case is labeled
 * iff `gold_facts` is an array (empty = "store nothing").
 */
register({
  name: "extraction_precision",
  description: "Fraction of stored records that match a gold atomic fact and contain no labeled noise.",
  compute(results, corpus) { return extractionPrecisionStats(results, corpus).rate; },
  explain: extractionPrecisionStats,
});

function extractionRecallStats(results, corpus) {
  const cases = joinExtractCases(results, corpus);
  let nGold = 0;
  let nHit = 0;
  const byCase = [];
  for (const c of cases) {
    const stored = c.stored || [];
    const match = c.extract_match === "cover" ? "cover" : "exact";
    let hit = 0;
    for (const g of c.gold_facts || []) {
      nGold++;
      if (stored.some((text) => isCorrectStored(text, [g], c.noise, match))) {
        nHit++;
        hit++;
      }
    }
    byCase.push({
      id: c.id,
      n_gold: (c.gold_facts || []).length,
      n_hit: hit,
    });
  }
  // Unlabeled (no gold_facts anywhere) → 0, same as precision, so computeAll
  // on a duplicates result does not look like a perfect extraction run.
  // Labeled PII-only (gold_facts all empty) → 1: nothing to recover.
  // The refuse-everything cheat on a gold-bearing corpus: precision 1.0
  // (vacuous) and recall 0 (every gold fact missed). That's the anti-cheat.
  let rate;
  if (!cases.length) rate = 0;
  else if (!nGold) rate = 1;
  else rate = nHit / nGold;
  return {
    n_labeled: cases.length,
    n_gold: nGold,
    n_hit: nHit,
    rate,
    byCase,
  };
}

/*
 * extraction_recall — of the gold atomic facts, the fraction for which
 * save() actually persisted a matching record.
 *
 *     recall = |gold facts with a matching stored record| / |gold facts|
 *
 * Matching is the same equality as extraction_precision (whitespace-
 * collapsed, case-folded, no noise span). Micro-averaged across labeled
 * writes so a split that stores both halves scores 2/2, and a dropped
 * write scores 0/N for that write's gold.
 *
 * PII writes have gold_facts: [] and do not enter the denominator.
 * Vacuous precision (refuse everything → 0 stored → 1.0) cannot hide
 * here: a gold-bearing corpus would report recall 0.
 *
 * results / corpus shapes: same as extraction_precision.
 */
register({
  name: "extraction_recall",
  description: "Fraction of gold atomic facts for which a matching record was stored.",
  compute(results, corpus) { return extractionRecallStats(results, corpus).rate; },
  explain: extractionRecallStats,
});

/*
 * Factory for a frozen-k alias (`recall@5`, `recall@10`, …). Registering
 * `makeRecallAtK(10)` is how a later slice adds recall@10 without
 * touching the runner: one more `register(...)` call.
 */
function makeRecallAtK(k) {
  const n = Number(k);
  return {
    name: "recall@" + n,
    defaults: { k: n },
    description: "recall_at_k with k=" + n + " frozen (success@" + n + ").",
    compute(results, corpus, opts) {
      return computeMetric("recall_at_k", results, corpus, Object.assign({}, opts, { k: n }));
    },
    explain(results, corpus, opts) {
      return explainMetric("recall_at_k", results, corpus, Object.assign({}, opts, { k: n }));
    },
  };
}

/*
 * Primary cosine hits from a recall OUTPUT STRING (the same text the model
 * sees). Stops before a "Related:" block so I9 (discovery does not reorder
 * the primary result) is respected: reporting metrics score the cosine
 * list, not the field appendix. Format is `N. [id ID] text`.
 */
function parsePrimaryHits(output) {
  const primary = String(output || "").split(/related:/i)[0];
  const hits = [];
  const re = /\[id\s+(\S+)\]\s*(.*)$/gm;
  let m;
  while ((m = re.exec(primary))) hits.push({ id: m[1], text: m[2].trim() });
  return hits;
}

function isSaveRefusal(msg) {
  const s = String(msg || "");
  // "Nothing to save" is empty input, not a secret guard. The 0001
  // refusal is "Not saved — that looks like … Secrets don't belong in memory."
  if (/nothing to save/i.test(s)) return false;
  if (/not saved/i.test(s)) return true;
  if (/secrets don't belong/i.test(s)) return true;
  return false;
}

function queryKindOf(q) {
  return (q && (q.query_kind || q.probe_kind)) || null;
}

function splitByQueryKind(statsFn, results, corpus, opts) {
  const base = statsFn(results, corpus, opts);
  const queries = asQueryList(results);
  const kinds = new Set();
  for (const q of queries) {
    const k = queryKindOf(q);
    if (k) kinds.add(k);
  }
  const byKind = {};
  for (const kind of kinds) {
    const subset = queries.filter((q) => queryKindOf(q) === kind);
    byKind[kind] = statsFn({ queries: subset }, corpus, opts);
  }
  base.byKind = byKind;
  return base;
}

function recallAtKStatsSplit(results, corpus, opts) {
  return splitByQueryKind(recallAtKStats, results, corpus, opts);
}

function mrrStatsSplit(results, corpus, opts) {
  return splitByQueryKind(mrrStats, results, corpus, opts);
}

function asRecordList(results) {
  if (!results) return [];
  if (Array.isArray(results)) return results;
  if (Array.isArray(results.records)) return results.records;
  if (Array.isArray(results.all_records)) return results.all_records;
  return [];
}

function recordById(records) {
  const m = new Map();
  for (const r of records || []) {
    if (r && r.id != null) m.set(String(r.id), r);
  }
  return m;
}

function survivorId(rec, byId) {
  if (!rec) return null;
  const seen = new Set();
  let cur = rec;
  while (cur && cur.superseded_by != null && !seen.has(String(cur.id))) {
    seen.add(String(cur.id));
    const next = byId.get(String(cur.superseded_by));
    if (!next) return String(cur.superseded_by);
    cur = next;
  }
  return cur ? String(cur.id) : null;
}

function textHasValue(text, value) {
  if (value == null || value === "") return false;
  return norm(text).includes(norm(value));
}

function slotProbeList(results, corpus) {
  if (results && Array.isArray(results.slot_probes)) return results.slot_probes;
  const queries = asQueryList(results).filter((q) => queryKindOf(q) === "slot");
  if (queries.length) return queries;
  if (corpus && Array.isArray(corpus.slot_probes)) return corpus.slot_probes;
  return [];
}

function stalenessStats(results, corpus, opts) {
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  const probes = slotProbeList(results, corpus);
  if (!probes.length) {
    return { n: 0, n_stale: 0, rate: null, misses: [], byProbe: [] };
  }
  const scored = [];
  for (const p of probes) {
    const current = p.current_value != null ? p.current_value : p.value;
    const rankedTexts = (p.ranked_texts || []).slice(0, k);
    const rankedIds = asIds(p.ranked_ids || p.ranked).slice(0, k);
    const relevant = asIds(p.relevant_ids || p.current_ids);
    let hit = false;
    // RFC: "slot queries where current value is wrong". Prefer the value
    // string — a mid-band merge retires the origin id but keeps the
    // longer original text, so keying on write_id false-stales a still-
    // correct answer (Koneko restated as "black cat named Koneko").
    if (current != null) {
      hit = rankedTexts.some((t) => textHasValue(t, current));
    } else if (relevant.length) {
      hit = relevant.some((id) => rankedIds.includes(id));
    } else {
      continue; // unlabeled
    }
    scored.push({
      id: p.id || p.slot || p.query || null,
      slot: p.slot || null,
      hit,
      stale: !hit,
    });
  }
  const n = scored.length;
  const nStale = scored.filter((s) => s.stale).length;
  return {
    k, n, n_stale: nStale,
    rate: n ? nStale / n : null,
    misses: scored.filter((s) => s.stale).map((s) => s.id),
    byProbe: scored,
  };
}

/*
 * staleness_rate — RM-15's core curve (0011 §7.3).
 *
 * Among labeled slot probes ("where do I live" / "where do I work" / …),
 * the fraction whose top-k does NOT contain the persona's CURRENT slot
 * value. A superseded city ranking above the current one is a stale hit.
 *
 * Probe is labeled by `current_value` (substring of ranked_texts) and/or
 * `relevant_ids` (current slot record ids). Unlabeled probes skipped.
 * No probes → null (not a 0 that looks like a perfect store).
 *
 * results shape: { slot_probes: [{ slot, ranked_texts, ranked_ids,
 *   current_value, relevant_ids }] } or queries with query_kind:"slot".
 */
register({
  name: "staleness_rate",
  defaults: { k: 5 },
  description: "Fraction of slot probes whose top-k does not contain the current slot value.",
  compute(results, corpus, opts) { return stalenessStats(results, corpus, opts).rate; },
  explain: stalenessStats,
});

function filterNeedleQueries(results, opts) {
  const kind = (opts && opts.query_kind) || "episodic";
  const queries = asQueryList(results);
  const tagged = queries.filter((q) => q && (q.needle || queryKindOf(q) === kind));
  if (tagged.length) return tagged;
  if (results && Array.isArray(results.needle_queries)) return results.needle_queries;
  return [];
}

function needleRetentionStats(results, corpus, opts) {
  const queries = filterNeedleQueries(results, opts);
  if (!queries.length) {
    return { k: (opts && opts.k) || 5, n: 0, hits: 0, rate: null, misses: [] };
  }
  return recallAtKStats({ queries }, corpus, opts);
}

/*
 * needle_retention@k — I8-as-retrieval (0011 §7.3).
 *
 * Relevant = the SOURCE id of a planted unique-token episodic, not a
 * gist that happens to contain the token. Same success@k formula as
 * recall_at_k, restricted to needle / query_kind:"episodic" queries.
 * Missing the set → null so a control arm without probes is NA, not 0.
 */
register({
  name: "needle_retention@k",
  defaults: { k: 5, query_kind: "episodic" },
  description: "Success@k on planted unique-token needles; relevant is the source id.",
  compute(results, corpus, opts) { return needleRetentionStats(results, corpus, opts).rate; },
  explain: needleRetentionStats,
});

function pairList(results, corpus) {
  if (results && Array.isArray(results.must_not_merge)) return results.must_not_merge;
  if (corpus && Array.isArray(corpus.must_not_merge)) return corpus.must_not_merge;
  return [];
}

function pairIds(pair) {
  if (Array.isArray(pair) && pair.length >= 2) return [String(pair[0]), String(pair[1])];
  const a = pair.a_id || pair.a || pair.a_write_id;
  const b = pair.b_id || pair.b || pair.b_write_id;
  if (a == null || b == null) return null;
  return [String(a), String(b)];
}

function falseMergeStats(results, corpus) {
  const records = asRecordList(results);
  const pairs = pairList(results, corpus);
  if (!pairs.length) {
    return { n: 0, n_false: 0, rate: null, false_pairs: [] };
  }
  const byId = recordById(records);
  const writeToId = results && results.write_to_id instanceof Map
    ? results.write_to_id
    : (results && results.write_to_id) || {};
  function resolve(label) {
    if (byId.has(label)) return label;
    const mapped = writeToId instanceof Map ? writeToId.get(label) : writeToId[label];
    return mapped != null ? String(mapped) : label;
  }
  const scored = [];
  for (const pair of pairs) {
    const ids = pairIds(pair);
    if (!ids) continue;
    const aId = resolve(ids[0]);
    const bId = resolve(ids[1]);
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) {
      scored.push({ pair: ids, false_merge: false, reason: "missing-record" });
      continue;
    }
    const sa = survivorId(a, byId);
    const sb = survivorId(b, byId);
    const merged = sa != null && sb != null && sa === sb;
    scored.push({ pair: ids, survivor: sa, false_merge: merged });
  }
  const n = scored.length;
  const nFalse = scored.filter((s) => s.false_merge).length;
  return {
    n, n_false: nFalse,
    rate: n ? nFalse / n : null,
    false_pairs: scored.filter((s) => s.false_merge).map((s) => s.pair),
    byPair: scored,
  };
}

/*
 * false_merge_rate — Op A / Op C (0011 §7.3).
 *
 * Fraction of labeled must_not_merge pairs that share a superseded_by
 * survivor (a near-miss that got eaten). 0 is the control / Op A floor.
 * No labeled pairs → null.
 *
 * results shape: { records: [{id, superseded_by}], must_not_merge?:
 *   [[idA,idB]|{a_id,b_id}] }. corpus.must_not_merge accepted.
 * write_to_id maps generator write_ids onto store ids.
 */
register({
  name: "false_merge_rate",
  description: "Fraction of must_not_merge pairs that share a superseded_by survivor.",
  compute(results, corpus) { return falseMergeStats(results, corpus).rate; },
  explain: falseMergeStats,
});

function storageRatioStats(results, corpus, opts) {
  const nCurrent = results && results.n_current != null
    ? Number(results.n_current)
    : (Array.isArray(results && results.records) ? results.records.length
      : (Array.isArray(results) ? results.length : null));
  const nWrites = results && results.n_writes != null ? Number(results.n_writes)
    : (corpus && corpus.n_writes != null ? Number(corpus.n_writes)
      : (corpus && corpus.n_asserts != null ? Number(corpus.n_asserts) : null));
  const nAsserts = results && results.n_asserts != null ? Number(results.n_asserts)
    : (corpus && corpus.n_asserts != null ? Number(corpus.n_asserts) : nWrites);
  const controlN = opts && opts.control_n != null ? Number(opts.control_n)
    : (results && results.control_n != null ? Number(results.control_n) : null);
  if (nCurrent == null) {
    return { n_current: null, n_writes: nWrites, n_asserts: nAsserts, control_n: controlN, rate: null };
  }
  const baseline = controlN != null ? controlN : (nAsserts != null ? nAsserts : nWrites);
  return {
    n_current: nCurrent,
    n_writes: nWrites,
    n_asserts: nAsserts,
    control_n: controlN,
    baseline,
    rate: baseline ? nCurrent / baseline : null,
  };
}

/*
 * storage_ratio — all arms (0011 §7.3). Superlinear = fail.
 *
 *   control: n_current / n_asserts  (writes that tried to store a fact)
 *   treatment: pass opts.control_n = control's n_current; crystals may
 *              raise N slightly (keep/cut cap is control × 1.05).
 */
register({
  name: "storage_ratio",
  description: "current().length / assert-count (control) or / control n_current (treatment).",
  compute(results, corpus, opts) { return storageRatioStats(results, corpus, opts).rate; },
  explain: storageRatioStats,
});

function naResult(reason) {
  return { value: null, rate: null, n: 0, reason: reason || "not-in-control-arm" };
}

function hasCrystals(results, corpus) {
  const recs = asRecordList(results);
  if (recs.some((r) => r && (r.kind === "crystal" || r.source === "model_inferred" && Array.isArray(r.crystal_of)))) {
    return true;
  }
  if (results && Array.isArray(results.crystals) && results.crystals.length) return true;
  if (corpus && Array.isArray(corpus.crystals) && corpus.crystals.length) return true;
  return false;
}

function gistQueries(results) {
  const qs = asQueryList(results).filter((q) => queryKindOf(q) === "gist" || q.gist);
  if (qs.length) return qs;
  return results && Array.isArray(results.gist_queries) ? results.gist_queries : [];
}

function gistRecallStats(results, corpus, opts) {
  if (!hasCrystals(results, corpus) && !gistQueries(results).length) {
    return Object.assign(naResult("no crystals"), { k: (opts && opts.k) || 5, crystal_hit_rate: null });
  }
  const queries = gistQueries(results);
  if (!queries.length) return Object.assign(naResult("no gist queries"), { crystal_hit_rate: null });
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  let crystalHits = 0;
  const scored = [];
  for (const q of queries) {
    const ranked = asIds(q.ranked_ids || q.ranked).slice(0, k);
    const relevant = asIds(q.relevant_ids || q.relevant);
    const crystals = asIds(q.crystal_ids || []);
    const hit = relevant.some((id) => ranked.includes(id));
    const crystalHit = crystals.some((id) => ranked.includes(id));
    if (crystalHit) crystalHits++;
    scored.push({ id: q.id || q.query, hit, crystalHit });
  }
  const n = scored.length;
  return {
    k, n,
    hits: scored.filter((s) => s.hit).length,
    rate: n ? scored.filter((s) => s.hit).length / n : null,
    crystal_hit_rate: n ? crystalHits / n : null,
    misses: scored.filter((s) => !s.hit).map((s) => s.id),
  };
}

register({
  name: "gist_recall@k",
  defaults: { k: 5 },
  description: "Op C: success@k where relevant is the crystal OR any current source. NA without crystals.",
  compute(results, corpus, opts) { return gistRecallStats(results, corpus, opts).rate; },
  explain: gistRecallStats,
});

function falseGenStats(results, corpus, opts) {
  if (!hasCrystals(results, corpus)) return naResult("no crystals");
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  const queries = filterNeedleQueries(results, opts);
  if (!queries.length) return Object.assign(naResult("no needle queries"), { n_false: 0 });
  let nFalse = 0;
  const byQuery = [];
  for (const q of queries) {
    const ranked = asIds(q.ranked_ids || q.ranked).slice(0, k);
    const source = asIds(q.relevant_ids || q.source_ids);
    const crystals = asIds(q.crystal_ids || []);
    const hasCrystal = crystals.some((id) => ranked.includes(id));
    const hasSource = source.some((id) => ranked.includes(id));
    const crystalAte = hasCrystal && !hasSource;
    const nearMissInCrystal = !!q.near_miss_in_crystal;
    const bad = crystalAte || nearMissInCrystal;
    if (bad) nFalse++;
    byQuery.push({ id: q.id || q.query, crystalAte, nearMissInCrystal, bad });
  }
  return {
    n: queries.length, n_false: nFalse,
    rate: queries.length ? nFalse / queries.length : null,
    byQuery,
  };
}

register({
  name: "false_generalization_rate",
  defaults: { k: 5 },
  description: "Op C: needle top-k has a crystal and not the source, or a near-miss pair shares a crystal.",
  compute(results, corpus, opts) { return falseGenStats(results, corpus, opts).rate; },
  explain: falseGenStats,
});

function iou(a, b) {
  const A = new Set((a || []).map(String));
  const B = new Set((b || []).map(String));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function clusterMembers(c) {
  if (!c) return [];
  if (Array.isArray(c)) return c.map(String);
  return (c.members || c.ids || c.member_ids || []).map(String);
}

/*
 * Hungarian (Kuhn-Munkres) on a square cost matrix. We maximize IoU by
 * minimizing (1-IoU). n is cluster count (Op B size 3–8, a handful of
 * gold themes) so O(n³) is fine.
 */
function hungarian(cost) {
  const n = cost.length;
  if (!n) return [];
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const colOfRow = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j]) colOfRow[p[j] - 1] = j - 1;
  }
  return colOfRow;
}

function matchClusters(pred, gold, thresh) {
  const t = thresh == null ? 0.5 : thresh;
  const P = pred || [];
  const G = gold || [];
  const n = Math.max(P.length, G.length);
  if (!n) return { matches: [], unmatchedPred: [], unmatchedGold: [] };
  const cost = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const a = i < P.length ? clusterMembers(P[i]) : [];
      const b = j < G.length ? clusterMembers(G[j]) : [];
      const sim = (i < P.length && j < G.length) ? iou(a, b) : 0;
      row.push(1 - sim);
    }
    cost.push(row);
  }
  const colOfRow = hungarian(cost);
  const matches = [];
  const usedGold = new Set();
  const usedPred = new Set();
  for (let i = 0; i < P.length; i++) {
    const j = colOfRow[i];
    if (j == null || j < 0 || j >= G.length) continue;
    const sim = 1 - cost[i][j];
    if (sim >= t) {
      matches.push({ pred: i, gold: j, iou: sim });
      usedPred.add(i);
      usedGold.add(j);
    }
  }
  return {
    matches,
    unmatchedPred: P.map((_, i) => i).filter((i) => !usedPred.has(i)),
    unmatchedGold: G.map((_, i) => i).filter((i) => !usedGold.has(i)),
  };
}

function goldClusters(results, corpus) {
  if (results && Array.isArray(results.gold_clusters)) return results.gold_clusters;
  if (corpus && Array.isArray(corpus.gold_clusters)) return corpus.gold_clusters;
  if (corpus && Array.isArray(corpus.themes)) {
    return corpus.themes.map((t) => ({ id: t.id, members: t.members || t.ids || [] }));
  }
  return null;
}

function predClusters(results) {
  if (!results) return null;
  if (Array.isArray(results.predicted_clusters)) return results.predicted_clusters;
  if (Array.isArray(results.clusters)) return results.clusters;
  return null;
}

function clusterScoreStats(results, corpus, opts) {
  const pred = predClusters(results);
  const gold = goldClusters(results, corpus);
  if (pred == null) return Object.assign(naResult("no predicted clusters"), { precision: null, recall: null });
  if (!gold || !gold.length) return Object.assign(naResult("no gold clusters"), { precision: null, recall: null });
  const thresh = opts && opts.iou != null ? Number(opts.iou) : 0.5;
  const matched = matchClusters(pred, gold, thresh);
  const precision = pred.length ? matched.matches.length / pred.length : 1;
  const recall = gold.length ? matched.matches.length / gold.length : 1;
  return {
    n_pred: pred.length,
    n_gold: gold.length,
    n_matched: matched.matches.length,
    iou_threshold: thresh,
    precision,
    recall,
    matches: matched.matches,
    unmatchedPred: matched.unmatchedPred,
    unmatchedGold: matched.unmatchedGold,
  };
}

register({
  name: "cluster_precision",
  defaults: { iou: 0.5 },
  description: "Op B: fraction of predicted clusters Hungarian-matched to gold at IoU ≥ 0.5. NA without predictions.",
  compute(results, corpus, opts) {
    const s = clusterScoreStats(results, corpus, opts);
    return s.precision == null ? null : s.precision;
  },
  explain: clusterScoreStats,
});

register({
  name: "cluster_recall",
  defaults: { iou: 0.5 },
  description: "Op B: fraction of gold clusters Hungarian-matched to a prediction at IoU ≥ 0.5. NA without predictions.",
  compute(results, corpus, opts) {
    const s = clusterScoreStats(results, corpus, opts);
    return s.recall == null ? null : s.recall;
  },
  explain: clusterScoreStats,
});

function hubContaminationStats(results, corpus) {
  const pred = predClusters(results);
  if (pred == null) return naResult("no predicted clusters");
  const hubs = new Set((results && results.hub_ids || corpus && corpus.hub_ids || []).map(String));
  if (results && results.hub && results.hub.write_id) hubs.add(String(results.hub.write_id));
  if (!hubs.size && corpus && corpus.hub && corpus.hub.write_id) hubs.add(String(corpus.hub.write_id));
  let nBad = 0;
  const bad = [];
  for (let i = 0; i < pred.length; i++) {
    const members = clusterMembers(pred[i]);
    const hubMembers = members.filter((id) => hubs.has(id));
    // 4.4 / Op B: a hub cannot be the *reason* two others cluster. A
    // cluster whose remaining members drop below size 3 without the hub
    // is contamination (the hub glued a pair).
    if (hubMembers.length && members.length - hubMembers.length < 3) {
      nBad++;
      bad.push({ pred: i, members, hubs: hubMembers });
    }
  }
  return {
    n: pred.length, n_bad: nBad,
    rate: pred.length ? nBad / pred.length : 0,
    bad,
  };
}

register({
  name: "hub_contamination",
  description: "Op B / 4.4: fraction of predicted clusters that only meet size because of a hub node.",
  compute(results, corpus) {
    const s = hubContaminationStats(results, corpus);
    return s.rate == null ? null : s.rate;
  },
  explain: hubContaminationStats,
});

function provenanceIntegrityStats(results, corpus) {
  if (!hasCrystals(results, corpus)) return naResult("no crystals");
  const records = asRecordList(results);
  const byId = recordById(records);
  const crystals = (results.crystals || records.filter((r) => r && (r.kind === "crystal" || Array.isArray(r.crystal_of))));
  if (!crystals.length) return naResult("no crystals");
  let nOk = 0;
  const byCrystal = [];
  for (const c of crystals) {
    const sources = (c.crystal_of || c.sources || []).map(String);
    const current = sources.filter((id) => {
      const r = byId.get(id);
      return r && !r.deleted && !r.valid_to;
    });
    const ok = sources.length > 0 && current.length === sources.length;
    if (ok) nOk++;
    byCrystal.push({ id: c.id, n_sources: sources.length, n_current: current.length, ok });
  }
  return {
    n: crystals.length, n_ok: nOk,
    rate: crystals.length ? nOk / crystals.length : null,
    byCrystal,
  };
}

register({
  name: "provenance_integrity",
  description: "Op C: every crystal has sources covering the cluster and every source is still current.",
  compute(results, corpus) { return provenanceIntegrityStats(results, corpus).rate; },
  explain: provenanceIntegrityStats,
});

function bookQueries(results, kind) {
  return asQueryList(results).filter((q) => queryKindOf(q) === kind);
}

function bookHitStats(results, corpus, opts) {
  const queries = bookQueries(results, "temporal-nav");
  if (!queries.length) return Object.assign(naResult("no temporal-nav queries"), { k: (opts && opts.k) || 5 });
  return recallAtKStats({ queries }, corpus, opts);
}

register({
  name: "grimoire_hit_rate",
  defaults: { k: 5 },
  description: "Op D: success@k on temporal-nav queries. NA until grimoire-walk.",
  compute(results, corpus, opts) { return bookHitStats(results, corpus, opts).rate; },
  explain: bookHitStats,
});

function bookCrowdingStats(results, corpus, opts) {
  const k = opts && opts.k != null ? Number(opts.k) : 5;
  const queries = asQueryList(results).filter((q) => queryKindOf(q) !== "temporal-nav");
  const pageIds = new Set((results && results.grimoire_ids ||
    corpus && corpus.grimoire_ids || []).map(String));
  if (!pageIds.size) return Object.assign(naResult("no Grimoire nodes"), { k, n_crowded: 0 });
  if (!queries.length) return { k, n: 0, n_crowded: 0, rate: 0 };
  let nCrowded = 0;
  for (const q of queries) {
    const ranked = asIds(q.ranked_ids || q.ranked).slice(0, k);
    if (ranked.some((id) => pageIds.has(id))) nCrowded++;
  }
  return { k, n: queries.length, n_crowded: nCrowded, rate: nCrowded / queries.length };
}

register({
  name: "grimoire_crowding",
  defaults: { k: 5 },
  description: "Op D: fraction of ordinary queries whose top-k contains a page gist. Must be 0.",
  compute(results, corpus, opts) {
    const s = bookCrowdingStats(results, corpus, opts);
    return s.rate == null ? null : s.rate;
  },
  explain: bookCrowdingStats,
});

function pairKey(a, b) {
  const x = String(a), y = String(b);
  return x < y ? x + "\t" + y : y + "\t" + x;
}

function cofireStats(results, corpus, opts) {
  const matrix = results && results.cofire;
  const pairs = (results && results.true_pairs) || (corpus && corpus.true_pairs);
  if (!matrix && !Array.isArray(results && results.cofire_events)) {
    return Object.assign(naResult("no cofire matrix (4.0b sim)"), { mean: null });
  }
  const truePairs = pairs || [];
  if (!truePairs.length) return Object.assign(naResult("no true pairs"), { mean: null });
  const counts = matrix && matrix.counts ? matrix.counts : {};
  const denom = matrix && matrix.n_queries != null ? matrix.n_queries : (results.cofire_events || []).length;
  const rates = [];
  for (const pair of truePairs) {
    const ids = pairIds(pair);
    if (!ids) continue;
    const key = pairKey(ids[0], ids[1]);
    const c = counts[key] || 0;
    rates.push(denom ? c / denom : 0);
  }
  const mean = rates.length ? rates.reduce((s, x) => s + x, 0) / rates.length : null;
  return { n_pairs: rates.length, n_queries: denom, mean, rate: mean, rates };
}

register({
  name: "cofire_rate",
  description: "4.0b: mean pairwise cofire_rate on true theme pairs. NA until the fire-together sim.",
  compute(results, corpus, opts) { return cofireStats(results, corpus, opts).rate; },
  explain: cofireStats,
});

function nearMissCofireStats(results, corpus, opts) {
  const matrix = results && results.cofire;
  const pairs = (results && results.near_miss_pairs) || (corpus && corpus.near_miss_pairs) ||
    (corpus && corpus.must_not_merge);
  if (!matrix && !Array.isArray(results && results.cofire_events)) {
    return Object.assign(naResult("no cofire matrix (4.0b sim)"), { mean: null });
  }
  if (!pairs || !pairs.length) return Object.assign(naResult("no near-miss pairs"), { mean: null });
  return cofireStats({
    cofire: matrix,
    true_pairs: pairs,
    cofire_events: results.cofire_events,
  }, corpus, opts);
}

register({
  name: "near_miss_cofire",
  description: "4.0b: mean cofire of labeled near-miss pairs. NA until the fire-together sim.",
  compute(results, corpus, opts) { return nearMissCofireStats(results, corpus, opts).rate; },
  explain: nearMissCofireStats,
});

module.exports = {
  scoreSingle, scoreRepeat, containsAll, fieldSignals,
  register, getMetric, listMetrics, computeMetric, explainMetric, computeAll,
  makeRecallAtK, groupsFromWrites, parsePrimaryHits,
  normFact, isCorrectStored, isSaveRefusal,
  COVER_MAX_WORDS, coverScore,
  firstRelevantRank,
  iou, matchClusters, survivorId,
};
