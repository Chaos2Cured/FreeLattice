#!/usr/bin/env node
/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*
 * record.js - the shared memory-record schema, durable writes, and the access
 * sidecar. Owned here (not in server.js) so the MCP server and the control panel
 * agree on exactly what a record is, byte for byte.
 *
 * Three things live here:
 *
 *   1. normalize()   - the ONE definition of a memory record. Every field is
 *                      backfilled on read, so a store written by any older build
 *                      loads into the current shape with no migration step.
 *
 *   2. writeFileDurable() - write-temp -> fsync -> atomic rename. Replacing a file
 *                      with writeFileSync is NOT atomic: a crash or power loss
 *                      partway through truncates the user's entire memory. Rename
 *                      within a directory is atomic on POSIX and on Windows
 *                      (MoveFileEx), so a reader sees either the whole old file or
 *                      the whole new one - never a half-written one.
 *
 *   3. AccessLog     - retention metadata (access_count / last_access) kept OUT of
 *                      the main store. Recall used to rewrite the entire store file
 *                      just to bump a counter on ~5 rows; since these counters are
 *                      RETENTION signals that never touch ranking (see the ranking
 *                      invariant), they do not belong on the read path at all.
 *                      Same sidecar pattern as ledger.js.
 *
 * Decision helpers also live here so they stay pure and testable: constraint
 * typing, historical-query detection, RM-03 cue-gated detectSupersession,
 * RM-02.b cosine-banded detectNearDuplicate / pickMergeSurvivor, and RM-01.b
 * write-side extraction (normalizeText / splitFacts / guardSecrets /
 * prepareWrite). Callers own persistence. `normalize()` is the record schema
 * — do not overload it for incoming text; that job is `normalizeText`.
 *
 * Temporal fields (RM-04) are defined here too - see docs/proposed/0002.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// --------------------------------------------------------------- durable write
/*
 * Atomically replace `file` with `data`.
 *
 * The temp file is created in the SAME directory as the target: rename() is only
 * atomic within a filesystem, and os.tmpdir() is frequently a different mount.
 * We fsync the data before the rename so the bytes are on disk, not just in the
 * page cache, before anything points at them.
 */
function writeFileDurable(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, "." + path.basename(file) + "." + process.pid + "." + Date.now() + ".tmp");
  let fd;
  try {
    fd = fs.openSync(tmp, "w");
    fs.writeFileSync(fd, data, "utf8");
    try { fs.fsyncSync(fd); } catch { /* some filesystems (and Windows shares) refuse fsync; the rename is still atomic */ }
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);   // atomic: readers see all-old or all-new
  } catch (e) {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { } }
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { }
    throw e;
  }
}

/* Append is already atomic for a single small write on both POSIX and Windows;
 * this wrapper exists so callers never touch fs directly and get the mkdir. */
function appendLineDurable(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line, "utf8");
}

// ------------------------------------------------------------------- the record
/*
 * The canonical shape of a memory. Anything absent is backfilled, so this doubles
 * as the migration path: an old record simply gains the new fields on first read.
 *
 * Temporal model (RM-04, docs/proposed/0002) - bi-temporal, after Graphiti:
 *   valid_from     when this became true IN THE WORLD
 *   valid_to       when it stopped being true; null = still true right now
 *   last_confirmed last time we saw evidence it still holds
 *   superseded_by  id of the memory that replaced this one
 *   supersedes     back-pointer to the memory this one replaced
 *   revision       position in the supersession chain (1 = original)
 *   needs_review   an ambiguous conflict: BOTH were kept, a human should look
 *
 *   embedding_version  generation of the stored vector (Phase 0). Starts at 1;
 *                      increments only when a successful re-embed writes a new
 *                      vector. Cached semantic edges later compare this against
 *                      src_versions — a failed embed must NEVER bump it, or a
 *                      text-drifted-from-vector record looks freshly embedded
 *                      (BUG-008 class; see docs/phases/phase-0-edge-substrate.md).
 *
 * A superseded memory is never deleted. valid_to is set to the successor's
 * valid_from, producing a non-overlapping validity chain you can walk backwards.
 */
function normalize(r) {
  const created = r.created || r.ts || new Date().toISOString();
  const modified = r.modified || created;
  return {
    id: r.id,
    created,
    modified,
    text: r.text,
    // Array.isArray is false for Float32Array (a view, not an Array). That
    // drop is deliberate: normalize() owns the JSON-shaped schema, not the
    // store's BLOB representation. SqliteStore attaches the typed array
    // AFTER normalize() — see store-sqlite.js rowToRecord. Encode as a test.
    embedding: Array.isArray(r.embedding) ? r.embedding : null,

    // retention signals - never used in ranking
    importance: typeof r.importance === "number" ? r.importance : 0,
    access_count: typeof r.access_count === "number" ? r.access_count : 0,
    last_access: r.last_access || null,

    // temporal (RM-04)
    valid_from: r.valid_from || created,
    valid_to: r.valid_to || null,
    last_confirmed: r.last_confirmed || modified,
    superseded_by: r.superseded_by != null ? r.superseded_by : null,
    supersedes: r.supersedes != null ? r.supersedes : null,
    revision: typeof r.revision === "number" ? r.revision : 1,
    needs_review: !!r.needs_review,

    // vector generation (Phase 0). Legacy rows default to 1 so version comparison
    // is well-defined the moment an edge cache starts using it. Missing / non-numeric
    // (including JSON-null from a bad patch) backfills to 1 — same migration path
    // as revision. Never incremented here: normalize() runs on every read.
    embedding_version: typeof r.embedding_version === "number" ? r.embedding_version : 1,

    // provenance (RM-16): where this came from. Defaults to the honest answer for
    // anything written before provenance existed - the user's client said it.
    source: r.source || "user_stated",

    // constraint typing (RM-00 field experiment #2). Computed from text if not
    // explicitly set, so every record - including ones written before this existed -
    // is typed on read with no migration step.
    is_constraint: typeof r.is_constraint === "boolean" ? r.is_constraint : detectConstraint(r.text),

    deleted: !!r.deleted,
  };
}

/* Currently-true: not deleted, not superseded. This is what recall answers from. */
function isCurrent(r) { return !r.deleted && !r.valid_to; }

/*
 * Constraint / preference typing (RM-00 field experiment #2). A constraint is an
 * "apex rule" the assistant must honor even when the user did not restate it ("I'm
 * diabetic", "I'm vegetarian", "terrified of heights", "allergic to nuts"). These
 * are exactly the memories that sit at the BOTTOM of cosine ranking for the query
 * they should gate (a rule rarely restates its trigger), so they need a privileged
 * retrieval policy. The SERVER assigns this type from text at save (never the model,
 * per the small-model-safety invariant); it only widens retrieval, never deletes, so
 * a false positive is cheap. Deliberately a lexical heuristic for now; a tiny local
 * classifier is the upgrade path if recall/precision of the TYPE (not the edges)
 * ever becomes the bottleneck.
 */
const CONSTRAINT_RE =
  /\b(diabetic|vegan|vegetarian|pescatarian|celiac|coeliac|lactose|gluten|allerg(?:ic|y|ies)|intoleran(?:t|ce)|terrified|afraid|scared|phobi[ac]|acrophobi|kosher|halal|sober|teetotal)\b|\bno (?:sugar|meat|dairy|nuts?|gluten|shellfish|alcohol)\b|\b(?:can'?t|cannot|never) (?:eat|have|drink|stand|do)\b/i;
function detectConstraint(text) { return CONSTRAINT_RE.test(String(text || "")); }

/* Does this query explicitly ask about the past? Only then do superseded memories
 * surface. Kept deliberately narrow - a false positive here resurfaces stale facts,
 * which is exactly what the temporal model exists to prevent. */
const HISTORICAL_RE =
  /\b(used to|previous(ly)?|before|back then|in the past|formerly|history|historical|old(er)? (job|address|phone|car|name|number)|what did i (use|used) to)\b/i;
function isHistoricalQuery(q) { return HISTORICAL_RE.test(String(q || "")); }

/*
 * Explicit user-correction cues that mark a NEW memory as RETIRING a prior state.
 * Deliberately about replacement ("moved", "now", "no longer"), not history
 * ("used to"), which is a HISTORICAL_RE cue that surfaces the old fact instead of
 * retiring it. See detectSupersession for why this lexical gate is load-bearing.
 */
const SUPERSEDE_CUE_RE =
  /\b(actually|now|nowadays|no longer|anymore|as of|currently|instead|moved|relocated|switched|became|update:|correction:)\b/i;
function hasSupersedeCue(t) { return SUPERSEDE_CUE_RE.test(String(t || "")); }

/*
 * Decide whether a newly-saved memory supersedes an existing CURRENT one (RM-03).
 *
 * Measured reality (eval/RESULTS.md, "RM-03"): on the shipped embedder a same-slot
 * update ("Actually I work at Globex now" vs "I work at Acme", cos 0.57) and a
 * DIFFERENT-slot statement in the same voice ("...Globex now" vs "I live in Austin",
 * cos 0.51) are only ~0.05 apart. Cosine alone cannot tell a correction from a
 * coincidental resemblance, so we:
 *   1. require an explicit correction cue in the new text (the precision gate), and
 *   2. retire only the SINGLE most-similar current memory, and only above a floor.
 * The cue carries the precision; cosine only picks which memory the cue targets.
 *
 * Pure: returns the memory record to supersede, or null. Caller owns persistence.
 */
function detectSupersession(newRec, currentMems, cosineFn, opts = {}) {
  const minSim = typeof opts.minSim === "number" ? opts.minSim : 0.535;
  if (!newRec || !newRec.embedding) return null;      // no vector -> can't target one
  if (!hasSupersedeCue(newRec.text)) return null;     // no correction intent -> keep both
  let best = null, bestSim = -Infinity;
  for (const m of currentMems) {
    if (!m || String(m.id) === String(newRec.id) || !m.embedding) continue;
    const s = cosineFn(newRec.embedding, m.embedding);
    if (s > bestSim) { bestSim = s; best = m; }
  }
  return (best && bestSim >= minSim) ? best : null;
}

/*
 * True for a cosine-able embedding: a JSON number[] (JsonlStore) OR a
 * Float32Array (SqliteStore attaches these after normalize()). Array.isArray
 * is false for a typed array — using it here would make RM-02.b skip every
 * SQLite neighbor and silently append restatements. Length + numeric index
 * is what cosine actually reads.
 */
function isVector(v) {
  return !!(v && typeof v.length === "number" && v.length > 0 && typeof v[0] === "number");
}

function hasVector(r) {
  return r && isVector(r.embedding);
}

/*
 * Cosine-banded near-duplicate decision (RM-02.b). Pure: returns
 * `{ action, match, cosine }` or null. Caller owns persistence.
 *
 *   cosine ≥ hi  → restatement (bump the existing row, do not append)
 *   lo ≤ cosine < hi → candidate merge (keep the longer original text)
 *   cosine < lo  → not a duplicate (caller appends / runs RM-03)
 *
 * Argmax, same as detectSupersession: one save, one decision, the closest
 * current memory. Vectorless new or existing rows are skipped — without a
 * vector we cannot compare, so the caller must append rather than guess
 * (embedder-down degrade). If lo ≥ hi the merge band is empty by construction.
 *
 * Thresholds are CONFIG (defaults 0.95 / 0.88), tuned on eval/duplicates
 * against nomic-embed-text-v1.5 — see memory-core.js DEDUP_HI / DEDUP_LO
 * and eval/RESULTS.md RM-02.a geometry. ≥ hi (not >): a pair sitting
 * exactly on the restatement floor keeps the original rather than merging.
 */
function detectNearDuplicate(newRec, currentMems, cosineFn, opts = {}) {
  const hi = typeof opts.hi === "number" ? opts.hi : 0.95;
  const lo = typeof opts.lo === "number" ? opts.lo : 0.88;
  if (!hasVector(newRec)) return null;
  let best = null, bestSim = -Infinity;
  for (const m of currentMems || []) {
    if (!m || String(m.id) === String(newRec.id) || !hasVector(m)) continue;
    const s = cosineFn(newRec.embedding, m.embedding);
    if (s > bestSim) { bestSim = s; best = m; }
  }
  if (!best || !Number.isFinite(bestSim)) return null;
  if (bestSim >= hi) return { action: "restate", match: best, cosine: bestSim };
  if (bestSim >= lo) return { action: "merge", match: best, cosine: bestSim };
  return null;
}

/*
 * Survivor of a mid-band merge. MUST be one of the two original texts —
 * the duplicate_rate metric maps stored `text` back to its labeled group,
 * and recall relevance is by group, so a blended rewrite would break both
 * (RM-02.a constraint). Longer wins (more specific); equal length keeps
 * the already-stored record so a merge never rewrites without adding
 * information.
 */
function pickMergeSurvivor(existing, incoming) {
  const a = String(existing && existing.text || "");
  const b = String(incoming && incoming.text || "");
  return b.length > a.length ? incoming : existing;
}

// ------------------------------------------------- RM-01.b write-side extraction
/*
 * Tier 0 (always on, no LLM) + Tier 1 (secret/PII guard). Pure string ops.
 * `memory-core.js save()` is the only caller on the live path so eval and
 * the MCP server cannot drift (RM-00).
 *
 * Implemented against `eval/corpora/messy.jsonl` gold, NOT 0001's regexes
 * as-is. 01.a NOTES §3: 0001's `^(i think )` half-strips "I think you should
 * know that Samuel prefers concise answers" to "You should know that…",
 * which still contains the noise span and fails exact gold match. Same
 * class: 0001 missed "just so you're aware", "remember to remind me",
 * "make sure you", "don't forget to", "be sure to". Over-split is worse
 * than no-split (the `multi-nosplit` honey trap). Guard is refusal, not
 * redaction — a fact mixed with a secret is store-nothing.
 *
 * Named `normalizeText` so it never collides with `normalize()` (schema).
 */

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function recaseSentence(s) {
  const t = String(s || "");
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/*
 * Longest-first, leading-only, case-insensitive. Stacked openers
 * ("FYI, just so you know, …") are stripped in a loop. Do NOT add
 * 0001's short `^(i think )` or bare `^(also,? )` — the first leaves
 * a half-opener, the second eats a legitimate "Also …" fact.
 */
const WRITE_OPENERS = [
  /^i think you should know that\s*/i,
  /^just so you(?:['\u2019]re| are) aware,?\s*/i,
  /^just so you know,?\s*/i,
  /^it(?:['\u2019]s| is) worth noting that\s*/i,
  /^for the record,?\s*/i,
  /^fyi,?\s*/i,
  /^btw,?\s*/i,
  // Assistant-aimed framing. Payload is kept when it remains; empty
  // leftover → prepareWrite returns no facts (drop the write).
  /^remember to remind me(?: that)?\s*/i,
  /^(?:please\s+)?(?:remember|note) that\s*/i,
  /^(?:please\s+)?remember to\s*/i,
  /^make sure you\s*/i,
  /^(?:please\s+)?(?:don['\u2019]t|do not) forget to\s*/i,
  /^(?:please\s+)?be sure to\s*/i,
];

function stripWriteOpeners(text) {
  let t = collapseWhitespace(text);
  let changed = true;
  while (changed && t) {
    changed = false;
    for (const re of WRITE_OPENERS) {
      const next = t.replace(re, "").trim();
      if (next !== t) { t = next; changed = true; }
    }
  }
  return t;
}

function normalizeText(text) {
  const collapsed = collapseWhitespace(text);
  const stripped = stripWriteOpeners(collapsed);
  if (!stripped) return "";
  // Recase only when an opener actually came off. Clean facts are
  // sacrosanct (01.b control-preservation): "first" must stay "first",
  // not become "First". Leftovers like "the Friday standup…" need the
  // capital to match gold.
  return stripped !== collapsed ? recaseSentence(stripped) : stripped;
}

/*
 * Split on `; ` and ` and also ` ONLY when every half is a standalone
 * proposition. Conservative: if any half fails, keep the original.
 * `with honey` (2 words, no copula) is the measured trap — splitting
 * it drops honey from the stored text and fails q-tea-honey.
 *
 * Bare `and` is NOT a delimiter (0001's diabetic+dog example is a
 * future Tier 2 job, not a heuristic we can get right without an LLM).
 */
const STANDALONE_VERB_RE =
  /\b(is|are|was|were|has|have|likes?|prefers?|needs?|uses?|lives?|works?|owns?)\b/i;
const DEPENDENT_CLAUSE_RE = /^(which|that|who|because|so|but|then)\b/i;

function isStandaloneFact(s) {
  const t = collapseWhitespace(s);
  if (!t) return false;
  if (t.split(/\s+/).length < 4) return false;
  if (DEPENDENT_CLAUSE_RE.test(t)) return false;
  return STANDALONE_VERB_RE.test(t);
}

function splitFacts(text) {
  const src = collapseWhitespace(text);
  if (!src) return [];
  const parts = src.split(/;\s+|,\s+and also\s+|\s+and also\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return [src];
  if (!parts.every(isStandaloneFact)) return [src];
  return parts.map(recaseSentence);
}

/*
 * Card pattern is `\b[0-9]{13,16}\b` on purpose (0001 + 01.a digit traps).
 * `4821` and `1500mg` MUST survive; a false PII refusal drops a real
 * memory and tanks recall@5, which this corpus treats as worse than a
 * stored secret. Both failure directions are scored (over-refusal vs
 * under-refusal).
 *
 * Prefix + length + charset, not English. "the secret is browning the
 * butter" / "my password manager is Bitwarden" must store; a
 * `github_pat_` / `sk_live_` / `AIza…` paste must not. Assignment
 * keywords still require `:` or `=` — never `is` — because `secret is`
 * is how people talk about recipes. A false positive is silent data
 * loss (refuse-not-redact drops the whole write).
 *
 * Hyphen form (`sk-`, `ghp-`, `xoxb-`) is the 01.b shape (and the
 * original tests). Underscore form is what GitHub / Stripe actually
 * issue. Both stay. `sk-proj-` / `sk-ant-` / `sk-or-` ride the `sk-`
 * prefix; body ≥16 so `sk-learn` (5) is not an API key.
 */
const SECRET_PATTERNS = [
  { re: /\b(sk|pk|ghp|gho|xox[baprs]|xapp)-[A-Za-z0-9_-]{16,}\b/, what: "an API key" },
  // GitHub's issued shape uses underscores: classic `ghp_` + 36 alphanum
  // (no extra `_` — so a branch named `ghp_experimentation_branch` stores),
  // OAuth `gho_`, app `ghu_`/`ghs_`/`ghr_`. Fine-grained `github_pat_` is
  // a unique prefix and does contain an inner `_`; 36-char floor matches
  // the issued body (22 + `_` + 59). The hyphen pattern above never sees these.
  { re: /\bgithub_pat_[A-Za-z0-9_]{36,}\b/, what: "a GitHub token" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, what: "a GitHub token" },
  // Stripe secret / restricted (live or test) and org keys. Publishable
  // `pk_live_` is designed to sit in client code — not a secret, not refused.
  { re: /\b(?:[sr]k_(?:live|test)|sk_org)_[A-Za-z0-9]{20,}\b/, what: "an API key" },
  // Google API keys are `AIza` + 35. Case-sensitive so a name "Aiza" is fine.
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, what: "an API key" },
  // HuggingFace user tokens (`hf_` + ~37). Case-sensitive so HF_HOME
  // (the cache-dir env var this audience actually sets) is not a token.
  { re: /\bhf_[A-Za-z0-9]{20,}\b/, what: "an API key" },
  // Groq. Same audience as HF: people paste these into local-LLM setup.
  { re: /\bgsk_[A-Za-z0-9]{20,}\b/, what: "an API key" },
  // AWS access key id: AKIA long-term, ASIA STS temporary. Same 20-char
  // issued shape. "ASIA" the continent is not followed by 16 alphanumerics.
  { re: /\bA[KS]IA[0-9A-Z]{16}\b/, what: "an AWS key" },
  { re: /\b[0-9]{13,16}\b/, what: "what looks like a card number" },
  // PEM and OpenSSH (`BEGIN OPENSSH PRIVATE KEY` — [A-Z ]* eats OPENSSH ).
  // PUBLIC KEY / ssh-ed25519 one-liners are not secrets and must store.
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: "a private key" },
  // JWT: three base64url segments, header starts with eyJ (`{"`). Short
  // floors so a tiny payload still trips; English "JWT library" does not.
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\b/, what: "a token" },
  // Assignment form only (`:` / `=`). `passphrase` is the same shape as
  // `password:`; `api_key=` needs a long alphanumeric run so
  // `API_KEY=nomic-embed-text-v1.5` (dots / hyphens) still stores.
  { re: /\b(password|passwd|passphrase|secret|token)\s*[:=]\s*\S{6,}/i, what: "a credential" },
  { re: /\b(?:api[_-]?key|access[_-]?token)\s*[:=]\s*[A-Za-z0-9]{24,}\b/i, what: "a credential" },
];

function guardSecrets(text) {
  const t = String(text || "");
  for (const { re, what } of SECRET_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        what,
        message: "Not saved — that looks like " + what + ". Secrets don't belong in memory.",
      };
    }
  }
  return { ok: true };
}

/*
 * One entry for save(): whitespace → PII guard on the FULL payload
 * (mixed fact+secret is store-nothing, not salvage) → strip openers →
 * split. Empty leftover (imperative with no payload) is zero facts,
 * not a refusal.
 */
function prepareWrite(content) {
  const raw = collapseWhitespace(content);
  if (!raw) return { ok: true, facts: [], message: null };
  const g = guardSecrets(raw);
  if (!g.ok) return { ok: false, facts: [], message: g.message };
  const normalized = normalizeText(raw);
  if (!normalized) return { ok: true, facts: [], message: null };
  const facts = splitFacts(normalized).filter(Boolean);
  for (const f of facts) {
    const gf = guardSecrets(f);
    if (!gf.ok) return { ok: false, facts: [], message: gf.message };
  }
  return { ok: true, facts, message: null };
}

/*
 * Mark `oldId` superseded by `newId`. Both rows survive.
 * Returns the patches to apply; the caller owns persistence so this stays pure
 * and testable.
 */
function supersedePatches(oldRec, newRec, at) {
  const when = at || newRec.valid_from || new Date().toISOString();
  return {
    old: { valid_to: when, superseded_by: newRec.id, modified: when },
    new: { supersedes: oldRec.id, revision: (oldRec.revision || 1) + 1 },
  };
}

// -------------------------------------------------------------- access sidecar
/*
 * access_count / last_access, stored beside the main store instead of inside it.
 *
 * Why: bumping a counter on 5 rows used to rewrite the ENTIRE store file on every
 * recall - O(store) work and a full-file exposure window on what is logically a
 * read. These counters govern RETENTION only (never retrieval order), so losing
 * the tail of them to a crash costs nothing that matters, while rewriting the
 * whole memory store on every read risks everything that does.
 *
 * Flushed with the same durable write as everything else.
 */
class AccessLog {
  constructor(file) {
    this.file = file;
    this.counts = new Map();   // id -> { n, last }
    this.dirty = false;
    this.load();
  }

  load() {
    try {
      const j = JSON.parse(fs.readFileSync(this.file, "utf8"));
      for (const id in (j.counts || {})) this.counts.set(String(id), j.counts[id]);
    } catch { /* no sidecar yet - start empty */ }
  }

  save() {
    if (!this.dirty) return;
    try {
      writeFileDurable(this.file, JSON.stringify({ counts: Object.fromEntries(this.counts) }));
      this.dirty = false;
    } catch { /* non-fatal: retention metadata must never break recall */ }
  }

  bump(ids, at) {
    const when = at || new Date().toISOString();
    for (const id of ids) {
      const k = String(id);
      const cur = this.counts.get(k) || { n: 0, last: null };
      this.counts.set(k, { n: cur.n + 1, last: when });
      this.dirty = true;
    }
  }

  get(id) { return this.counts.get(String(id)) || { n: 0, last: null }; }

  /*
   * Called after the store has been rewritten with these counts already folded
   * into the records. The store file is now the authority, so the sidecar must
   * drop them - otherwise the next read adds them a SECOND time and the count
   * doubles on every mutation. (This is exactly what it did before; see the
   * regression tests in test.js.)
   */
  consolidate() {
    if (this.counts.size) { this.counts.clear(); this.dirty = true; }
  }

  /* Fold sidecar counts onto records read from the main store. The stored
   * access_count (from older builds, before the sidecar) is the baseline. */
  apply(records) {
    for (const r of records) {
      const a = this.counts.get(String(r.id));
      if (!a) continue;
      r.access_count = (r.access_count || 0) + a.n;
      r.last_access = a.last || r.last_access;
      r.importance = r.access_count;      // retention signal only; NOT used in ranking
    }
    return records;
  }

  /* Drop entries for ids that no longer exist, so the sidecar can't grow forever. */
  prune(liveIds) {
    const live = new Set([...liveIds].map(String));
    for (const k of [...this.counts.keys()]) {
      if (!live.has(k)) { this.counts.delete(k); this.dirty = true; }
    }
  }
}

module.exports = {
  writeFileDurable, appendLineDurable,
  normalize, isCurrent, isHistoricalQuery, supersedePatches,
  detectSupersession, hasSupersedeCue, SUPERSEDE_CUE_RE,
  detectNearDuplicate, pickMergeSurvivor,
  detectConstraint, CONSTRAINT_RE,
  normalizeText, splitFacts, guardSecrets, prepareWrite, isStandaloneFact,
  WRITE_OPENERS, SECRET_PATTERNS,
  AccessLog, HISTORICAL_RE, isVector, hasVector,
};
