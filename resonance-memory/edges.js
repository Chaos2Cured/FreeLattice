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
 * edges.js - the unified persistent edge substrate (Phase 0 / RM-21).
 *
 * field.js holds semantic kNN edges (ephemeral, rebuilt every recall).
 * ledger.js is the retired Hebbian sidecar (epoch-decayed `.assoc.json`);
 * this module absorbed it. One undirected edge record, two independently
 * stored signals. Slice C put this on the live recall path: EdgeStore is
 * the Hebbian source of truth (bonus / reinforce / save). Phase 0.1 persists
 * save-time semantic neighbors here (K=5, min cosine 0.25, Hebbian weight 0);
 * recall still computes the semantic kNN in field.js (minSim 0.70) and does
 * not read the cached semantic signal yet. Phase 0.2 replaced the recall-epoch
 * clock: Hebbian decay is lazy wall-clock via effectiveHebbian (computed on
 * read, never stored). recall() no longer calls tick() — that is I6.
 * Phase 0.3 materializes that computed weight onto hebbian.weight at the
 * moment of a reinforcing mutation, THEN applies α, so reinforcement cannot
 * bypass accumulated decay (the "ghost weight" of adding α to the undecayed
 * stored value after a long idle). MCP request-ID idempotency lives here too:
 * a bounded LRU of processed JSON-RPC ids is kept INSIDE the persist layer
 * so one durable write commits the dedup record and the weight change
 * together. JSON sidecar: one envelope via writeFileDurable (I5 = each write
 * durable, not the pair atomic if they were two files). SQLite adapter
 * (RM-07 slice 5): the id claim and the weight UPDATE COMMIT in ONE
 * transaction — that closes the window the envelope comment flagged.
 * Phase 0.4 soft-prunes (I8): an explicit pruneSweep() — never recall/save —
 * marks an edge inactive only when it is BOTH unreinforced (effectiveHebbian
 * ~0) AND semantically weak (below SEMANTIC_PRUNE_GATE). A strong-semantic
 * idle edge stays; that is the two-signal rule that protects constraint
 * rescue (RESULTS field experiment #2). Hard drop is vacuum(), also explicit.
 * Reactivation is a consequence of save/edit/reinforce touching an endpoint,
 * never a fifth tool (I1). reinforceRecall is retained. Semantic never fades.
 *
 * The asymmetry is load-bearing (docs/phases/phase-0-edge-substrate.md):
 *
 *   embedding            source of truth   (what the memory means)
 *   edge semantic score  derived cache     (recomputable; validity is a
 *                                          version comparison, not a flag)
 *   hebbian weight       source of truth   (irreplaceable; the only thing
 *                                          that decays; last_updated nests
 *                                          here because that's all it clocks)
 *
 * No last_accessed on the edge. Persisting it is an edge write on every
 * recall — the BUG-002 / I5 class. The transition table's Writes? column
 * is the checklist; a read must not touch this file.
 *
 * Sidecar format is versioned (`kind: "resonance-edges"`) so an old
 * {recalls, edges:{key: number}} reader can refuse rather than treat
 * records as weights (which would NaN the ledger and, on save, wipe it).
 *
 * Persistence is an adapter (RM-07 slice 5), not a second EdgeStore.
 * JsonlStore → `<store>.edges.json` (unchanged). SqliteStore → `edges` +
 * `edge_processed_ids` tables in the SAME `.db` (one WAL, one file). The
 * in-memory Map and every public method stay; only how a mutation hits
 * disk changes. effectiveHebbian is still computed on read and is NEVER
 * a column (I6). Edges mutations run in their own transaction so a
 * thrown edges write cannot poison the memories connection (crash-domain).
 */

const fs = require("fs");
const { writeFileDurable } = require("./record.js");

const SIDECAR_KIND = "resonance-edges";
const SIDECAR_VERSION = 1;

const ORIGINS = { "save-time-neighbor": true, "co-activation": true };

// Bounded LRU of processed MCP/JSON-RPC request ids (Phase 0.3). 256 covers a
// busy session of four-verb calls (retries are of the in-flight request, not
// of request 200 ago) at ~10 KB of UUID strings — negligible next to the edge
// table. After eviction a very-late retry could double-apply; that is the
// bound's job, and it also lets a client that restarts incrementing ids
// proceed instead of false-positive skipping. See acceptRequest().
const DEDUP_LRU_SIZE = 256;

// Must stay byte-identical to ledger.js's edgeKey until Slice C deletes that
// copy: migrated keys have to match the ones the Hebbian sidecar already wrote.
function edgeKey(a, b) { return [String(a), String(b)].sort().join(":"); }

function splitKey(k) {
  const s = String(k);
  const i = s.indexOf(":");
  if (i < 0) return [s, s];
  return [s.slice(0, i), s.slice(i + 1)];
}

function isoNow() { return new Date().toISOString(); }

/*
 * JSON-RPC 2.0 ids are string | number | null. Null/missing means a
 * notification (or a non-JSON-RPC caller: eval, tests, panel) — those MUST
 * apply normally, no dedup. 0 is a valid id. Number 1 and string "1" are
 * distinct (the spec identifies sameness by the id the client sent).
 */
function canonRequestId(id) {
  if (id === undefined || id === null) return null;
  if (typeof id === "number") {
    if (!Number.isFinite(id)) return null;
    return "n:" + String(id);
  }
  if (typeof id === "string") {
    if (id.length === 0) return null;
    return "s:" + id;
  }
  return null;
}

function normalizeMutationOpts(opts) {
  if (opts == null) return {};
  if (typeof opts === "string" || typeof opts === "number") return { requestId: opts };
  if (typeof opts === "object") return opts;
  return {};
}

class IncompatibleEdgeFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "IncompatibleEdgeFormatError";
  }
}

// -------------------------------------------------------------- record shape

/*
 * Canonical edge. Every field is backfilled on read (same migration posture
 * as record.normalize): an older on-disk record simply gains prune fields
 * etc. on first load. There is no stored "is-stale" flag — semantic validity
 * is `src_versions` vs the endpoints' current embedding_version.
 *
 * provenance.origin is how the edge came to exist, never what it currently
 * is. State is read off the signals (hebbian.weight === 0 = unreinforced).
 * migrated_from is a separate fact so a legacy sidecar edge can be both
 * genuinely co-activation AND bookkeeping-migrated.
 */
function normalizeEdge(e, now) {
  const when = now || isoNow();
  const [a, b] = [String(e.a), String(e.b)].sort();
  const sem = e.semantic && typeof e.semantic === "object" ? e.semantic : {};
  const src = sem.src_versions && typeof sem.src_versions === "object" ? sem.src_versions : {};
  const heb = e.hebbian && typeof e.hebbian === "object" ? e.hebbian : {};
  const prov = e.provenance && typeof e.provenance === "object" ? e.provenance : {};
  const origin = ORIGINS[prov.origin] ? prov.origin : (prov.origin || null);
  return {
    a,
    b,
    semantic: {
      value: typeof sem.value === "number" ? sem.value : null,
      src_versions: {
        a: src.a == null ? null : src.a,
        b: src.b == null ? null : src.b,
      },
    },
    hebbian: {
      weight: typeof heb.weight === "number" ? heb.weight : 0,
      last_updated: heb.last_updated || when,
    },
    provenance: {
      origin,
      migrated_from: prov.migrated_from || null,
    },
    created_at: e.created_at || when,
    pruned_at: e.pruned_at || null,
    prune_count: typeof e.prune_count === "number" ? e.prune_count : 0,
    first_pruned_at: e.first_pruned_at || null,
    last_reactivated_at: e.last_reactivated_at || null,
  };
}

function makeEdge(a, b, opts = {}) {
  // src_versions.a / .b refer to the CANONICAL endpoints (the sorted record.a /
  // record.b), not to argument order. makeEdge(2, 1, { semantic: { src_versions:
  // { a: v2, b: v1 }}}) would tag the wrong endpoint — set semantic after
  // creation with setSemantic(edge, value, { a: ver(edge.a), b: ver(edge.b) }).
  const origin = opts.origin;
  if (!ORIGINS[origin]) {
    throw new Error('makeEdge: provenance.origin must be "save-time-neighbor" or "co-activation"');
  }
  const now = opts.now || isoNow();
  return normalizeEdge({
    a,
    b,
    semantic: opts.semantic,
    hebbian: {
      weight: typeof opts.hebbianWeight === "number" ? opts.hebbianWeight : 0,
      last_updated: opts.lastUpdated || now,
    },
    provenance: { origin, migrated_from: opts.migrated_from || null },
    created_at: opts.created_at || now,
  }, now);
}

/*
 * Derived-cache validity. An edge's semantic.value is usable iff both
 * src_versions match the endpoints' current embedding_version. Stale is
 * then structurally self-evident: bump a version, the next read fails
 * the comparison, no invalidation event has to have fired (and none can
 * be silently missed). Empty semantic (migrated edges) has null versions
 * and so is invalid against any real embedding_version (>= 1).
 *
 * verA / verB are the current versions of edge.a / edge.b, in that order.
 */
function semanticValid(edge, verA, verB) {
  const src = edge && edge.semantic && edge.semantic.src_versions;
  if (!src) return false;
  return src.a === verA && src.b === verB;
}

// Two independent setters. Each leaves the other signal's bytes alone —
// collapsing them onto one scalar is the failure the whole design exists
// to prevent (a strong-semantic rarely-recalled pair would prune).
function setSemantic(edge, value, srcVersions) {
  edge.semantic = {
    value: typeof value === "number" ? value : null,
    src_versions: {
      a: srcVersions && srcVersions.a != null ? srcVersions.a : null,
      b: srcVersions && srcVersions.b != null ? srcVersions.b : null,
    },
  };
  return edge;
}

function setHebbian(edge, weight, lastUpdated) {
  edge.hebbian = {
    weight: typeof weight === "number" ? weight : 0,
    last_updated: lastUpdated || edge.hebbian.last_updated,
  };
  return edge;
}

// -------------------------------------------------------------- wall-clock decay (Phase 0.2 / I6)
//
// Learned-edge decay is a FUNCTION of elapsed time, not a process. There is no
// background loop and no recall-count clock. Reading computes the faded weight
// from (now − hebbian.last_updated) and DOES NOT write it (transition table:
// recall computes decay, does not store it). A reinforcing mutation
// materializes that value onto hebbian.weight, then applies α (Phase 0.3).
//
// Semantic is a structural fact and never fades. Mixing this clock with the
// retired tick()/decay() epoch math is the dual-clock bug — don't.
//
// Half-lives are PARAMETERS, not hard constants (phase-0 §0.2). Units are
// seconds. λ = ln(2)/H so the law is w·2^(−Δt/H). Starting values:
//   constraint  ~30 days   apex rules should outlast a session
//   fact        ~7 days    default; most edges
//   working     ~1 hour    in-flight context (no record field yet; callers pass type)
// These are the same surface RM-08's *record* importance decay will share;
// the two decays stay distinct (edge vs record, this vs RM-08).

const SECOND = 1;
const HOUR = 3600;
const DAY = 86400;

const HALF_LIFE_SECONDS = {
  constraint: 30 * DAY,
  fact: 7 * DAY,
  working: 1 * HOUR,
};
const DEFAULT_HALF_LIFE_TYPE = "fact";

function lambdaFromHalfLife(halfLifeSeconds) {
  const h = Number(halfLifeSeconds);
  // Non-positive / non-finite → no decay (fail open; a bad parameter must
  // not wipe learned weight). Caller can still pass a custom H.
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.LN2 / h;
}

function halfLifeFor(typeOrNs, table) {
  const map = table || HALF_LIFE_SECONDS;
  if (typeOrNs != null && typeof map[typeOrNs] === "number") return map[typeOrNs];
  return map[DEFAULT_HALF_LIFE_TYPE];
}

/*
 * Pick the half-life class of an undirected edge from its endpoints.
 * A constraint on either side uses the long (30d) class — apex-rule
 * associations should outlast a session. No `working` kind exists on
 * records yet (RM-08 / Phase 3); callers that have one pass type
 * explicitly. Default is fact.
 */
function hebbianDecayType(recA, recB) {
  if ((recA && recA.is_constraint) || (recB && recB.is_constraint)) return "constraint";
  return DEFAULT_HALF_LIFE_TYPE;
}

function toEpochMs(t) {
  if (t == null) return NaN;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  return Date.parse(String(t));
}

// Clamp so a backwards clock cannot amplify a weight (I6 failure: a read
// that *raises* effective weight). Unparseable timestamps → Δt = 0, same
// fail-open as a missing last_updated: don't NaN the bonus.
function elapsedSeconds(now, lastUpdated) {
  const nowMs = toEpochMs(now);
  const thenMs = toEpochMs(lastUpdated);
  if (!Number.isFinite(nowMs) || !Number.isFinite(thenMs)) return 0;
  return Math.max(0, (nowMs - thenMs) / 1000);
}

/*
 * Computed Hebbian weight at `now`. Does not write the edge.
 *   w_eff = w · 2^(−Δt / H)     H from type/namespace, or opts.halfLife
 * Δt is in seconds, clamped ≥ 0. Semantic is not consulted.
 */
function effectiveHebbian(edge, now, opts = {}) {
  if (!edge || !edge.hebbian) return 0;
  const w = typeof edge.hebbian.weight === "number" ? edge.hebbian.weight : 0;
  if (w === 0) return 0;
  const halfLife = opts.halfLife != null
    ? opts.halfLife
    : halfLifeFor(opts.type || opts.namespace, opts.halfLives);
  if (!Number.isFinite(halfLife) || halfLife <= 0) return w;
  const dt = elapsedSeconds(now, edge.hebbian.last_updated);
  if (dt === 0) return w;
  return w * Math.pow(2, -dt / halfLife);
}

// -------------------------------------------------------------- soft prune (Phase 0.4 / I8)
//
// Two-signal rule — the reason semantic and Hebbian are stored separately.
// Prune ONLY if BOTH (a) the learned signal has faded to ~0 AND (b) the
// cached semantic score is below SEMANTIC_PRUNE_GATE. An unreinforced but
// semantically-strong edge is NOT pruned: it reverts to a plain semantic
// edge and stays available for constraint-rescue. A merged scalar would
// prune that pair and regress field experiment #2 (RESULTS.md).
//
// SEMANTIC_PRUNE_GATE = 0.25, equal to SAVE_TIME_MIN_COS (memory-core.js).
// Below this, today's save-time bind would not even create the edge; it is
// not "worth persisting as structure." Using the recall minSim (0.55) or
// the constraint-rescue gate (0.45) would drop the 0.25–0.45 persist-net
// — including bridges that stage-2 rescue (0.45) can still walk. Do not
// silently raise this. HEBBIAN_PRUNE_FLOOR is "~0" for the learned signal:
// the retired epoch floor of 0.05 would mark a single α=0.1 bump pruned
// after one half-life, which is not decayed-to-zero. tanh(1e-6)*maxBonus
// is a rounding error on any gate.
//
// Soft prune (I8): set pruned_at, bump prune_count, keep the record.
// incident()/bonus()/weight() already skip pruned_at != null. Hard drop
// is vacuum(), explicit, never on a read. pruneSweep is the same class of
// operation as JsonlStore.vacuum — startup or on demand, never recall/save.

const SEMANTIC_PRUNE_GATE = 0.25;          // = SAVE_TIME_MIN_COS; see above
const HEBBIAN_PRUNE_FLOOR = 1e-6;          // effectiveHebbian below this is ~0

function isSemanticallyWeak(edge) {
  const v = edge && edge.semantic ? edge.semantic.value : null;
  return typeof v !== "number" || !Number.isFinite(v) || v < SEMANTIC_PRUNE_GATE;
}

function isUnreinforced(edge, now, opts) {
  return effectiveHebbian(edge, now, opts || {}) < HEBBIAN_PRUNE_FLOOR;
}

function shouldPrune(edge, now, opts) {
  if (!edge || edge.pruned_at) return false;
  return isUnreinforced(edge, now, opts) && isSemanticallyWeak(edge);
}

function markPruned(edge, now) {
  if (!edge || edge.pruned_at) return edge;
  const when = now || isoNow();
  edge.pruned_at = when;
  edge.prune_count = (typeof edge.prune_count === "number" ? edge.prune_count : 0) + 1;
  if (!edge.first_pruned_at) edge.first_pruned_at = when;
  return edge;
}

// Revive in place. created_at / hebbian / prune_count / first_pruned_at
// stay put — provenance and the decayed weight survive; only current-state
// (pruned_at) flips. last_reactivated_at is the O(1) history I8 allows
// instead of an array of prune events.
function reactivateEdge(edge, now) {
  if (!edge || !edge.pruned_at) return edge;
  edge.pruned_at = null;
  edge.last_reactivated_at = now || isoNow();
  return edge;
}

// -------------------------------------------------------------- sidecar I/O

function looksLikeRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) &&
    v.hebbian && typeof v.hebbian.weight === "number";
}

function sidecarKind(j) {
  if (!j || typeof j !== "object" || Array.isArray(j)) return "unknown";
  if (j.kind === SIDECAR_KIND) return SIDECAR_KIND;
  if (j.edges && typeof j.edges === "object" && !Array.isArray(j.edges)) {
    const vals = Object.keys(j.edges).map((k) => j.edges[k]);
    if (vals.length === 0) return "legacy-assoc";
    if (vals.every((v) => typeof v === "number")) return "legacy-assoc";
    // An old Ledger.save() on a new sidecar strips `kind` but leaves the
    // records as object values (measured). Treat that as native so the
    // learned weights survive; readLegacyAssoc still refuses them.
    if (vals.every(looksLikeRecord)) return SIDECAR_KIND;
  }
  return "unknown";
}

/*
 * The old-format reader. Understands ONLY `{ recalls, edges: { key: number } }`
 * — the shape ledger.js writes today. Seeing `kind: "resonance-edges"` (or
 * object-valued edge entries) throws rather than returning a silent subset:
 * dropping even one learned weight is data loss, and treating a record as a
 * number NaNs the bonus then overwrites the sidecar on the next Ledger.save().
 */
function readLegacyAssoc(j) {
  if (j && j.kind === SIDECAR_KIND) {
    throw new IncompatibleEdgeFormatError(
      "sidecar is " + SIDECAR_KIND + " v" + (j.version == null ? "?" : j.version) +
      "; this reader only understands pre-Phase-0 {recalls, edges:{key:number}}"
    );
  }
  const edges = (j && j.edges) || {};
  const out = {};
  for (const k of Object.keys(edges)) {
    const v = edges[k];
    if (typeof v !== "number") {
      throw new IncompatibleEdgeFormatError(
        "edge " + k + " is not a numeric Hebbian weight (refusing to misparse a newer sidecar)"
      );
    }
    out[k] = v;
  }
  return { recalls: (j && j.recalls) || 0, edges: out };
}

/*
 * One-way in-memory conversion. Every key in the legacy map becomes an edge
 * record — a dropped key is the pre-declared silent-data-loss signature.
 *
 * Timestamps: we do not know when the Hebbian weight was first written, so
 * both hebbian.last_updated and created_at are stamped at migration time.
 * They are LOWER BOUNDS, not the true original times. Do not treat them as
 * age. origin stays "co-activation" (the genuine fact); migrated_from carries
 * the bookkeeping. semantic is empty — computed on first use (Slice C / 0.1).
 */
function migrateAssoc(j, now) {
  const when = now || isoNow();
  const parsed = readLegacyAssoc(j);
  const out = new Map();
  for (const k of Object.keys(parsed.edges)) {
    const [a, b] = splitKey(k);
    const rec = makeEdge(a, b, {
      origin: "co-activation",
      migrated_from: "assoc.json",
      now: when,
      hebbianWeight: parsed.edges[k],
    });
    out.set(edgeKey(a, b), rec);
  }
  return out;
}

function envelope(edges, recalls, processedIds) {
  const obj = {};
  for (const [k, rec] of edges) obj[k] = rec;
  // `recalls` is leftover from the epoch-decay clock (ledger.js tick()).
  // Phase 0.2 moved decay to wall-clock via effectiveHebbian; the live path
  // no longer increments this. Kept so a sidecar round-trip does not drop a
  // field old files still carry. Mixing this with wall-clock is the
  // dual-clock bug — do not resume ticking it.
  //
  // `processed_ids` is the Phase 0.3 dedup LRU (oldest first). It lives in
  // THIS envelope so one writeFileDurable commits the id and the weight
  // change together — I5 makes each write durable, not the pair atomic, so
  // splitting them would be a lost-update window. Backfilled empty on old
  // files (normalize-on-read); no version bump.
  return {
    kind: SIDECAR_KIND,
    version: SIDECAR_VERSION,
    recalls: recalls || 0,
    processed_ids: Array.isArray(processedIds) ? processedIds : [],
    edges: obj,
  };
}

// Live path persists to <store>.edges.json. <store>.assoc.json is legacy /
// read-only-for-migration from Slice C onward: an old shipped Ledger can
// never open the new format and misparse it (downgrade-safe). A downgraded
// exe keeps reading its own stale .assoc.json; that is acceptable.
function siblingAssocPath(edgesFile) {
  if (!edgesFile || typeof edgesFile !== "string") return null;
  if (!edgesFile.endsWith(".edges.json")) return null;
  return edgesFile.slice(0, -".edges.json".length) + ".assoc.json";
}

/*
 * Parse an on-disk envelope (native or legacy-assoc) into the in-memory
 * snap EdgeStore.load() hydrates. Unknown/corrupt shapes return empty
 * (I3 fail-open) — the caller does not throw.
 */
function snapFromJson(j, now) {
  const empty = { edges: new Map(), recalls: 0, processedIds: [], migrated: false };
  const kind = sidecarKind(j);
  if (kind === SIDECAR_KIND) {
    const bag = j.edges;
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) return empty;
    const when = now || isoNow();
    const edges = new Map();
    for (const k of Object.keys(bag)) {
      const rec = normalizeEdge(bag[k], when);
      edges.set(edgeKey(rec.a, rec.b), rec);
    }
    return {
      edges,
      recalls: typeof j.recalls === "number" ? j.recalls : 0,
      processedIds: Array.isArray(j.processed_ids) ? j.processed_ids.slice() : [],
      migrated: false,
    };
  }
  if (kind === "legacy-assoc") {
    const parsed = readLegacyAssoc(j);
    return {
      edges: migrateAssoc(j, now),
      recalls: parsed.recalls,
      processedIds: [],
      migrated: true,
    };
  }
  return empty;
}

function emptySnap() {
  return { edges: new Map(), recalls: 0, processedIds: [], migrated: false };
}

// -------------------------------------------------------------- persist adapters
//
// EdgeStore owns the Map and the verbs. These classes own the disk. JSON
// sidecar is the JsonlStore companion (as long as JSONL is a live write
// path). SqliteEdgePersist shares the SqliteStore DatabaseSync so
// memories + edges + access live in ONE file (slice 5 / one-file
// sovereignty). Config stays a sidecar: prefs ≠ memory.

function isSqliteStore(store) {
  // SqliteStore exposes DatabaseSync and MUST NOT construct AccessLog
  // (BUG-007). JsonlStore has `access` and no `db`.
  return !!(store && store.db && typeof store.db.prepare === "function" && store.access === undefined);
}

function edgesSidecarCandidates(storePath, dbPath) {
  const out = [];
  const add = (p) => { if (p && out.indexOf(p) < 0) out.push(p); };
  if (storePath) add(String(storePath) + ".edges.json");
  if (dbPath) {
    add(String(dbPath) + ".edges.json");
    if (/\.db$/i.test(dbPath)) add(String(dbPath).replace(/\.db$/i, ".jsonl") + ".edges.json");
  }
  if (storePath && /\.jsonl$/i.test(storePath)) {
    add(String(storePath).replace(/\.jsonl$/i, ".db") + ".edges.json");
  }
  return out;
}

class JsonEdgePersist {
  constructor(file, opts = {}) {
    this.kind = "json";
    this.file = file;
    this.legacyFile = opts.legacyFile || null;
    this.writes = 0;
  }

  load(now) {
    try {
      if (this.file && fs.existsSync(this.file)) {
        return snapFromJson(JSON.parse(fs.readFileSync(this.file, "utf8")), now);
      }
      // Target missing: one-way lazy migrate from legacy .assoc.json if
      // present. .assoc.json is read-only-for-migration — we never write it.
      // A corrupt/missing .edges.json does NOT fall through to the sibling
      // (the new file is the authority; fail-open means empty, not "try old").
      const legacy = this.legacyFile || siblingAssocPath(this.file);
      if (legacy && fs.existsSync(legacy)) {
        return snapFromJson(JSON.parse(fs.readFileSync(legacy, "utf8")), now);
      }
    } catch {
      return emptySnap();
    }
    return emptySnap();
  }

  save(state) {
    writeFileDurable(this.file, JSON.stringify(envelope(
      state.edges, state.recalls, state.processedIds
    )));
    this.writes++;
  }
}

class SqliteEdgePersist {
  constructor(db, opts = {}) {
    this.kind = "sqlite";
    this.db = db;
    this.readOnly = !!opts.readOnly;
    this.writes = 0;
    // Test hook: throw AFTER the DML and BEFORE COMMIT so a crash in the
    // window proves the id claim and the weight UPDATE roll back together.
    this.throwBeforeCommit = opts.throwBeforeCommit || null;
    if (!this.readOnly) this._initSchema();
    this._prepare();
  }

  _initSchema() {
    // Two-signal record, byte-identical fields to the JSON envelope.
    // effectiveHebbian is NOT a column — I6: decay is math on read.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        a                     TEXT NOT NULL,
        b                     TEXT NOT NULL,
        semantic_value        REAL,
        src_version_a         TEXT,
        src_version_b         TEXT,
        hebbian_weight        REAL NOT NULL DEFAULT 0,
        hebbian_last_updated  TEXT NOT NULL,
        provenance_origin     TEXT,
        migrated_from         TEXT,
        created_at            TEXT NOT NULL,
        pruned_at             TEXT,
        prune_count           INTEGER NOT NULL DEFAULT 0,
        first_pruned_at       TEXT,
        last_reactivated_at   TEXT,
        PRIMARY KEY (a, b)
      );
      CREATE INDEX IF NOT EXISTS idx_edges_a ON edges(a);
      CREATE INDEX IF NOT EXISTS idx_edges_b ON edges(b);
      CREATE TABLE IF NOT EXISTS edge_processed_ids (
        seq INTEGER PRIMARY KEY,
        raw TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS edge_meta (
        k TEXT PRIMARY KEY,
        v TEXT
      );
    `);
  }

  _prepare() {
    try {
      this._selectAll = this.db.prepare("SELECT * FROM edges");
      this._count = this.db.prepare("SELECT COUNT(*) AS n FROM edges");
      this._upsert = this.db.prepare(
        "INSERT INTO edges (a,b,semantic_value,src_version_a,src_version_b," +
        "hebbian_weight,hebbian_last_updated,provenance_origin,migrated_from," +
        "created_at,pruned_at,prune_count,first_pruned_at,last_reactivated_at) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
        "ON CONFLICT(a,b) DO UPDATE SET " +
        "semantic_value=excluded.semantic_value," +
        "src_version_a=excluded.src_version_a," +
        "src_version_b=excluded.src_version_b," +
        "hebbian_weight=excluded.hebbian_weight," +
        "hebbian_last_updated=excluded.hebbian_last_updated," +
        "provenance_origin=excluded.provenance_origin," +
        "migrated_from=excluded.migrated_from," +
        "created_at=excluded.created_at," +
        "pruned_at=excluded.pruned_at," +
        "prune_count=excluded.prune_count," +
        "first_pruned_at=excluded.first_pruned_at," +
        "last_reactivated_at=excluded.last_reactivated_at"
      );
      this._delete = this.db.prepare("DELETE FROM edges WHERE a = ? AND b = ?");
      this._deleteAll = this.db.prepare("DELETE FROM edges");
      this._selProc = this.db.prepare("SELECT raw FROM edge_processed_ids ORDER BY seq");
      this._delProc = this.db.prepare("DELETE FROM edge_processed_ids");
      this._insProc = this.db.prepare("INSERT INTO edge_processed_ids (seq, raw) VALUES (?, ?)");
      this._selMeta = this.db.prepare("SELECT v FROM edge_meta WHERE k = ?");
      this._setMeta = this.db.prepare("INSERT INTO edge_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v");
    } catch {
      // Schema missing on a read-only open of a pre-slice-5 db: load()
      // fail-opens empty; export falls through to the sidecar.
      this._selectAll = null;
    }
  }

  edgeCount() {
    if (!this._count) return 0;
    try { return Number(this._count.get().n) || 0; } catch { return 0; }
  }

  _rowToEdge(row, now) {
    let srcA = null, srcB = null;
    try { if (row.src_version_a != null) srcA = JSON.parse(row.src_version_a); } catch { srcA = row.src_version_a; }
    try { if (row.src_version_b != null) srcB = JSON.parse(row.src_version_b); } catch { srcB = row.src_version_b; }
    return normalizeEdge({
      a: row.a,
      b: row.b,
      semantic: {
        value: row.semantic_value == null ? null : Number(row.semantic_value),
        src_versions: { a: srcA, b: srcB },
      },
      hebbian: {
        weight: typeof row.hebbian_weight === "number" ? row.hebbian_weight : Number(row.hebbian_weight) || 0,
        last_updated: row.hebbian_last_updated,
      },
      provenance: {
        origin: row.provenance_origin || null,
        migrated_from: row.migrated_from || null,
      },
      created_at: row.created_at,
      pruned_at: row.pruned_at || null,
      prune_count: Number(row.prune_count) || 0,
      first_pruned_at: row.first_pruned_at || null,
      last_reactivated_at: row.last_reactivated_at || null,
    }, now);
  }

  _bindEdge(rec) {
    const src = rec.semantic && rec.semantic.src_versions || {};
    return [
      rec.a, rec.b,
      rec.semantic && typeof rec.semantic.value === "number" ? rec.semantic.value : null,
      src.a == null ? null : JSON.stringify(src.a),
      src.b == null ? null : JSON.stringify(src.b),
      rec.hebbian && typeof rec.hebbian.weight === "number" ? rec.hebbian.weight : 0,
      rec.hebbian && rec.hebbian.last_updated || isoNow(),
      rec.provenance && rec.provenance.origin || null,
      rec.provenance && rec.provenance.migrated_from || null,
      rec.created_at,
      rec.pruned_at || null,
      typeof rec.prune_count === "number" ? rec.prune_count : 0,
      rec.first_pruned_at || null,
      rec.last_reactivated_at || null,
    ];
  }

  load(now) {
    if (!this._selectAll) return emptySnap();
    try {
      const edges = new Map();
      for (const row of this._selectAll.all()) {
        const rec = this._rowToEdge(row, now);
        edges.set(edgeKey(rec.a, rec.b), rec);
      }
      const processedIds = [];
      for (const row of this._selProc.all()) {
        try { processedIds.push(JSON.parse(row.raw)); } catch { /* skip a corrupt slot */ }
      }
      let recalls = 0;
      const meta = this._selMeta.get("recalls");
      if (meta && meta.v != null) {
        const n = Number(meta.v);
        if (Number.isFinite(n)) recalls = n;
      }
      return { edges, recalls, processedIds, migrated: false };
    } catch {
      return emptySnap();
    }
  }

  _txn(fn) {
    // Own transaction (crash-domain): a thrown edges write ROLLBACKs here
    // and must not leave the shared DatabaseSync in an aborted state that
    // would poison a later memories INSERT. We do NOT piggyback on an
    // in-flight memories txn — BEGIN failing because one is open is a
    // swallowed I3 miss, not a co-commit.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      if (typeof this.throwBeforeCommit === "function") this.throwBeforeCommit();
      this.db.exec("COMMIT");
      this.writes++;
      return out;
    } catch (e) {
      try { this.db.exec("ROLLBACK"); } catch { /* already aborted */ }
      throw e;
    }
  }

  _writeProcessed(processedIds) {
    this._delProc.run();
    const ids = Array.isArray(processedIds) ? processedIds : [];
    for (let i = 0; i < ids.length; i++) {
      this._insProc.run(i, JSON.stringify(ids[i]));
    }
  }

  _upsertOne(rec) {
    this._upsert.run(...this._bindEdge(rec));
  }

  save(state) {
    if (this.readOnly) return;
    const replaceAll = !!state.replaceAll;
    const dirty = state.dirty;
    const deleted = state.deleted;
    const processedDirty = !!state.processedDirty || replaceAll;
    const recallsDirty = !!state.recallsDirty || replaceAll;
    const hasDirty = dirty && dirty.size > 0;
    const hasDeleted = deleted && deleted.size > 0;
    if (!replaceAll && !hasDirty && !hasDeleted && !processedDirty && !recallsDirty) return;
    this._txn(() => {
      if (replaceAll) {
        this._deleteAll.run();
        for (const rec of state.edges.values()) this._upsertOne(rec);
      } else {
        if (hasDirty) {
          for (const k of dirty) {
            const rec = state.edges.get(k);
            if (rec) this._upsertOne(rec);
          }
        }
        if (hasDeleted) {
          for (const k of deleted) {
            const [a, b] = splitKey(k);
            this._delete.run(a, b);
          }
        }
      }
      if (processedDirty) this._writeProcessed(state.processedIds);
      if (recallsDirty) this._setMeta.run("recalls", String(state.recalls || 0));
    });
  }
}

/*
 * First-open ingest of a leftover `<store>.edges.json` into the edges
 * table (slice 5). Non-destructive: count-verify every edge survives,
 * then rename the sidecar → `.bak`. Fail-open if missing/corrupt (I3:
 * learned weight is gone; memories are not). Does NOT merge a leftover
 * `.assoc.json` if `.edges.json` exists (existing authority rule). If
 * only `.assoc.json` is present, ingest it and leave it untouched
 * (downgrade-safe, same as JsonEdgePersist).
 *
 * Always creates the edges schema so a fresh SqliteStore is one-file
 * from the first open, even with zero associations.
 */
function migrateEdgesSidecarIntoDb(db, opts) {
  opts = opts || {};
  const log = opts.log || function () {};
  const persist = new SqliteEdgePersist(db);
  if (persist.edgeCount() > 0) {
    return { migrated: false, reason: "table-has-rows", count: persist.edgeCount() };
  }
  const candidates = edgesSidecarCandidates(opts.storePath, opts.dbPath);
  let sidecar = null;
  for (const p of candidates) {
    if (p && fs.existsSync(p)) { sidecar = p; break; }
  }
  const now = opts.now || isoNow();
  if (sidecar) {
    try {
      const raw = JSON.parse(fs.readFileSync(sidecar, "utf8"));
      const kind = sidecarKind(raw);
      if (kind !== SIDECAR_KIND && kind !== "legacy-assoc") {
        log("RESONANCE: edges sidecar at " + sidecar + " is unreadable; leaving it, associations empty.");
        return { migrated: false, reason: "unreadable", path: sidecar };
      }
      const snap = snapFromJson(raw, now);
      const srcCount = snap.edges.size;
      persist.save({
        edges: snap.edges,
        recalls: snap.recalls,
        processedIds: snap.processedIds,
        replaceAll: true,
        processedDirty: true,
        recallsDirty: true,
      });
      if (persist.edgeCount() !== srcCount) {
        persist.save({
          edges: new Map(), recalls: 0, processedIds: [],
          replaceAll: true, processedDirty: true, recallsDirty: true,
        });
        throw new Error("edges count-verify failed: db=" + persist.edgeCount() + " sidecar=" + srcCount);
      }
      const bak = sidecar + ".bak";
      try { fs.renameSync(sidecar, bak); } catch (e) {
        log("RESONANCE: migrated " + srcCount + " edges into the db but sidecar rename failed (" +
          String(e && e.message || e) + "); table is live truth.");
      }
      log("RESONANCE: migrated " + srcCount + " edges into the store db; original kept at " + bak);
      return { migrated: true, count: srcCount, from: sidecar };
    } catch (e) {
      log("RESONANCE: edges sidecar migrate failed (" + String(e && e.message || e) +
        "); associations empty, memories stay reachable.");
      return { migrated: false, reason: "fail-open", error: e };
    }
  }
  // No .edges.json. Sibling .assoc.json is the Phase 0 one-way ingest,
  // only because the new file is missing. Leave .assoc.json untouched.
  for (const p of candidates) {
    const assoc = p && p.endsWith(".edges.json") ? p.slice(0, -".edges.json".length) + ".assoc.json" : null;
    if (!assoc || !fs.existsSync(assoc)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(assoc, "utf8"));
      const snap = snapFromJson(raw, now);
      persist.save({
        edges: snap.edges,
        recalls: snap.recalls,
        processedIds: snap.processedIds,
        replaceAll: true,
        processedDirty: true,
        recallsDirty: true,
      });
      log("RESONANCE: ingested " + snap.edges.size + " edges from legacy " + assoc +
        " into the store db; leftover sidecar left untouched.");
      return { migrated: true, count: snap.edges.size, from: assoc };
    } catch (e) {
      log("RESONANCE: legacy assoc ingest failed (" + String(e && e.message || e) +
        "); associations empty, memories stay reachable.");
      return { migrated: false, reason: "fail-open", error: e };
    }
  }
  return { migrated: false, reason: "missing", count: 0 };
}

function openEdgeStore(opts) {
  opts = opts || {};
  const store = opts.store;
  if (isSqliteStore(store)) {
    return new EdgeStore(null, {
      persist: opts.persist || new SqliteEdgePersist(store.db, { readOnly: !!store.readOnly }),
      now: opts.now,
    });
  }
  const file = opts.file || opts.edgesPath ||
    (opts.storePath ? String(opts.storePath) + ".edges.json" : null);
  return new EdgeStore(file, { now: opts.now, legacyFile: opts.legacyFile });
}

// -------------------------------------------------------------- store

/*
 * Persistent edge table. Constructed like Ledger: pass a path, get a Map.
 *
 * Fail-open (I3): a missing or corrupt sidecar loads empty and does not
 * throw. Learned weight is gone; memories are not. load() never writes
 * (I5) — even a successful in-memory migration stays in memory until an
 * explicit save(). That way a read path constructing the store cannot
 * rewrite the sidecar.
 */
class EdgeStore {
  constructor(file, opts = {}) {
    this.now = opts.now || isoNow;
    // Hebbian knobs MUST stay byte-identical to ledger.js. Moving storage
    // must not move the numbers (Slice C / I2 / I9).
    this.alphaPP = opts.alphaPP != null ? opts.alphaPP : 0.1;   // primary <-> primary
    this.alphaPN = opts.alphaPN != null ? opts.alphaPN : 0.02;  // primary <-> neighborhood
    this.beta = opts.beta != null ? opts.beta : 0.95;           // retired epoch decay retention
    this.floor = opts.floor != null ? opts.floor : 0.05;        // retired epoch prune threshold
    this.epoch = opts.epoch != null ? opts.epoch : 10;          // retired: decay every N recalls
    this.maxBonus = opts.maxBonus != null ? opts.maxBonus : 0.3;
    // Wall-clock half-lives (seconds). Override per type/namespace via
    // opts.halfLives; bonus/effectiveWeight read this table.
    this.halfLives = Object.assign({}, HALF_LIFE_SECONDS, opts.halfLives || {});
    this.legacyFile = opts.legacyFile || null;
    if (opts.persist) {
      this.persist = opts.persist;
    } else if (opts.db) {
      this.persist = new SqliteEdgePersist(opts.db, { readOnly: !!opts.readOnly });
    } else {
      this.persist = new JsonEdgePersist(file, { legacyFile: this.legacyFile });
    }
    this.file = this.persist.kind === "json" ? (file || this.persist.file) : null;
    this.edges = new Map();
    this.recalls = 0;
    this.processedIds = [];  // LRU, oldest first; raw JSON-RPC ids
    this.processedSet = new Set(); // canonRequestId keys, O(1) lookup
    this.migrated = false;   // true iff this load converted a legacy .assoc.json
    this._dirty = new Set();
    this._deleted = new Set();
    this._processedDirty = false;
    this._recallsDirty = false;
    this.load();
    // Lazy one-way persist: if we ingested a sibling .assoc.json because
    // <store>.edges.json did not exist, write the new file now. load() itself
    // never writes (I5). Never rewrite the legacy sidecar — a downgraded exe
    // still reads its own stale weights from it.
    if (this.migrated && this.persist.kind === "json" && this.file && !fs.existsSync(this.file)) this.save();
  }

  _reset() {
    this.edges = new Map();
    this.migrated = false;
    this.recalls = 0;
    this.processedIds = [];
    this.processedSet = new Set();
    this._dirty = new Set();
    this._deleted = new Set();
    this._processedDirty = false;
    this._recallsDirty = false;
  }

  _touch(k) {
    this._dirty.add(k);
    this._deleted.delete(k);
  }

  _remember(rawId) {
    const key = canonRequestId(rawId);
    if (key == null) return;
    if (this.processedSet.has(key)) return;
    this.processedIds.push(rawId);
    this.processedSet.add(key);
    while (this.processedIds.length > DEDUP_LRU_SIZE) {
      const evicted = this.processedIds.shift();
      const ek = canonRequestId(evicted);
      if (ek) this.processedSet.delete(ek);
    }
    this._processedDirty = true;
  }

  _loadProcessedIds(raw) {
    this.processedIds = [];
    this.processedSet = new Set();
    if (!Array.isArray(raw)) return;
    for (const id of raw) this._remember(id);
  }

  /*
   * Dedup gate for one mutation transaction. No id (eval, tests, panel,
   * notifications) → apply; never recorded. A seen id → skip. A new id is
   * remembered NOW, in memory, BEFORE the caller mutates — so an in-process
   * retry cannot double-apply even if save() has not yet run. Persistence
   * is the subsequent save(): the id and the weight change share one
   * writeFileDurable. That is the one-write form the spec prefers over
   * dedup-first-as-a-separate-file (a missed reinforcement decays out;
   * a doubled one is corrupted learning that never self-corrects — and
   * splitting the writes would reopen that window).
   */
  acceptRequest(requestId) {
    const key = canonRequestId(requestId);
    if (key == null) return true;
    if (this.processedSet.has(key)) return false;
    this._remember(requestId);
    return true;
  }

  hasProcessed(requestId) {
    const key = canonRequestId(requestId);
    return key != null && this.processedSet.has(key);
  }

  _ingest(j) {
    const snap = snapFromJson(j, this.now());
    this.edges = snap.edges;
    this.recalls = snap.recalls;
    this._loadProcessedIds(snap.processedIds);
    this.migrated = snap.migrated;
    this._processedDirty = false;
    this._recallsDirty = false;
    this._dirty = new Set();
    this._deleted = new Set();
  }

  load() {
    this._reset();
    try {
      const snap = this.persist.load(this.now());
      this.edges = snap.edges || new Map();
      this.recalls = snap.recalls || 0;
      this._loadProcessedIds(snap.processedIds);
      this.migrated = !!snap.migrated;
      this._processedDirty = false;
      this._recallsDirty = false;
    } catch {
      this._reset();
    }
  }

  save() {
    try {
      this.persist.save({
        edges: this.edges,
        recalls: this.recalls,
        processedIds: this.processedIds,
        dirty: this._dirty,
        deleted: this._deleted,
        processedDirty: this._processedDirty,
        recallsDirty: this._recallsDirty,
      });
      this._dirty = new Set();
      this._deleted = new Set();
      this._processedDirty = false;
      this._recallsDirty = false;
    } catch { /* non-fatal: the field must never break recall (I3) */ }
  }

  get(a, b) { return this.edges.get(edgeKey(a, b)); }

  has(a, b) { return this.edges.has(edgeKey(a, b)); }

  put(edge) {
    const rec = normalizeEdge(edge, this.now());
    const k = edgeKey(rec.a, rec.b);
    this.edges.set(k, rec);
    this._touch(k);
    return rec;
  }

  all() { return [...this.edges.values()]; }

  get size() { return this.edges.size; }

  // Incident edges for an id. Slice C uses this to absorb field.js's
  // Map<id, [{id, sim}]> neighbour lists without scanning the store twice.
  // Pruned edges are excluded from retrieval (I8: the record stays; this
  // is the "does not participate" half). reactivateIncident scans the
  // full table because this helper cannot see them.
  incident(id) {
    const s = String(id);
    const out = [];
    for (const e of this.edges.values()) {
      if (e.pruned_at) continue;
      if (e.a === s || e.b === s) out.push(e);
    }
    return out;
  }

  hasPruned() {
    for (const e of this.edges.values()) if (e.pruned_at) return true;
    return false;
  }

  /*
   * Explicit maintenance sweep (Phase 0.4). Mirror JsonlStore.vacuum:
   * startup or on demand, NEVER recall/save. Marks (does not drop) every
   * edge that is both unreinforced and semantically weak. Returns how
   * many newly pruned. Writes the sidecar only if something changed, so
   * a no-op sweep at MCP start does not bump mtime.
   */
  pruneSweep(opts = {}) {
    const now = opts.now != null ? opts.now : this.now();
    const hebOpts = {
      type: opts.type,
      namespace: opts.namespace,
      halfLife: opts.halfLife,
      halfLives: opts.halfLives || this.halfLives,
    };
    let n = 0;
    for (const e of this.edges.values()) {
      const type = typeof opts.typeFn === "function" ? opts.typeFn(e.a, e.b) : hebOpts.type;
      if (shouldPrune(e, now, Object.assign({}, hebOpts, { type }))) {
        markPruned(e, now);
        this._touch(edgeKey(e.a, e.b));
        n++;
      }
    }
    if (n) this.save();
    return n;
  }

  /*
   * Hard compaction: actually drop pruned records. Explicit, like
   * JsonlStore.vacuum. Never called from recall/save, never from
   * pruneSweep, never from the constructor. I8 forbids silent removal;
   * this is the operator saying "yes, drop them."
   */
  vacuum() {
    let dropped = 0;
    for (const [k, e] of [...this.edges]) {
      if (e.pruned_at) {
        this.edges.delete(k);
        this._deleted.add(k);
        this._dirty.delete(k);
        dropped++;
      }
    }
    if (dropped) this.save();
    return this.edges.size;
  }

  /*
   * Revive every pruned edge incident to `id`. Returns the number revived.
   * Caller persists (same posture as _bump — the mutation's save() is the
   * write). Does not walk incident() because that helper skips pruned_at.
   */
  reactivateIncident(id, now) {
    const s = String(id);
    const when = now != null ? now : this.now();
    let n = 0;
    for (const e of this.edges.values()) {
      if (!e.pruned_at) continue;
      if (e.a === s || e.b === s) {
        reactivateEdge(e, when);
        this._touch(edgeKey(e.a, e.b));
        n++;
      }
    }
    return n;
  }

  // ------------------------------------------------ Hebbian (ex-ledger.js)
  // Live-path contract memory-core.js calls: bonus / reinforceRecall / save.
  // bonus uses effectiveHebbian (wall-clock, computed, not stored).
  // reinforceRecall is the 0.1/2b differentiator — RETAINED. Phase 0.3
  // materializes decay onto the stored weight before applying α, and
  // gates the whole call on acceptRequest (MCP request-ID idempotency).
  // tick() is retired from the live path (I6); kept below so Ledger-parity
  // tests and eval/decay-probe.js can still replay the epoch math.

  // Stored source of truth — not decayed. Discovery must not read this
  // for the bonus; use effectiveWeight / bonus, which go through
  // effectiveHebbian.
  weight(a, b) {
    const e = this.get(a, b);
    if (!e || e.pruned_at) return 0;
    const w = e.hebbian && e.hebbian.weight;
    return typeof w === "number" ? w : 0;
  }

  effectiveWeight(a, b, opts = {}) {
    const e = this.get(a, b);
    if (!e || e.pruned_at) return 0;
    return effectiveHebbian(e, opts.now != null ? opts.now : this.now(), {
      type: opts.type,
      namespace: opts.namespace,
      halfLife: opts.halfLife,
      halfLives: opts.halfLives || this.halfLives,
    });
  }

  // bounded Hebbian bonus: 0 at weight 0, asymptotic to maxBonus, never exceeds it.
  // Uses the *effective* (wall-clock-decayed) weight so discovery sees faded
  // associations without a write (I6). Under a frozen clock or Δt≈0 this is
  // byte-identical to tanh(stored), which is why the golden can stay put.
  bonus(a, b, opts) {
    const w = this.effectiveWeight(a, b, opts || {});
    return w > 0 ? this.maxBonus * Math.tanh(w) : 0;
  }

  _bump(a, b, alpha, opts = {}) {
    if (alpha <= 0 || String(a) === String(b)) return;
    const existing = this.get(a, b);
    const now = this.now();
    if (existing) {
      // Materialize decay FIRST, then apply α (transition table `reinforce`
      // row; Phase 0.3). Adding α to the stored (undecayed) weight after a
      // long idle is the "ghost weight": reinforcement would bypass the
      // fade that reads already see via effectiveHebbian. After this
      // write, stored weight and effective weight coincide at `now`.
      // setHebbian leaves semantic / provenance alone (two-signal rule).
      // A pruned edge is revived in place first (transition table:
      // reinforce → pruned_at = null); created_at and the decayed weight
      // are not reset.
      if (existing.pruned_at) reactivateEdge(existing, now);
      const type = typeof opts.typeFn === "function" ? opts.typeFn(a, b) : opts.type;
      const wEff = effectiveHebbian(existing, now, {
        type,
        namespace: opts.namespace,
        halfLife: opts.halfLife,
        halfLives: opts.halfLives || this.halfLives,
      });
      setHebbian(existing, wEff + alpha, now);
      this._touch(edgeKey(existing.a, existing.b));
      return;
    }
    this.put(makeEdge(a, b, {
      origin: "co-activation",
      hebbianWeight: alpha,
      now,
    }));
  }

  // Reinforce one recall event given the provenance of the returned ids.
  // Co-recall is the differentiator I6 preserves. Third arg is a request
  // id (string|number) or `{ requestId, type, typeFn, halfLife, pairScale }`.
  // pairScale(a, b) => number in [0, 1]: cosine-gated / entity-mismatch
  // multiplier applied to α. Omitted = 1 (byte-identical to the old equal
  // bump, so ledger-parity tests stay put). 0 skips the pair — a near-miss
  // below field minSim, or a same-name different-entity pair, earns no
  // Hebbian weight. Measured: equal bump saturates tanh (bonus ratio 1.00×);
  // cosine-gated (α × how far doc-doc sits above the gate) is 6.18× weight
  // on fire-together haystack, unrelated 0.028.
  // Returns false iff this request id was already applied (caller should
  // skip save()); true/undefined otherwise so a duck-typed mock that
  // returns nothing still triggers the existing save().
  reinforceRecall(primaryIds, neighborhoodIds, opts) {
    const o = normalizeMutationOpts(opts);
    if (!this.acceptRequest(o.requestId)) return false;
    const bumpOpts = { type: o.type, typeFn: o.typeFn, halfLife: o.halfLife };
    const scale = typeof o.pairScale === "function" ? o.pairScale : () => 1;
    for (let i = 0; i < primaryIds.length; i++)
      for (let j = i + 1; j < primaryIds.length; j++) {
        const s = scale(primaryIds[i], primaryIds[j]);
        if (s > 0) this._bump(primaryIds[i], primaryIds[j], this.alphaPP * s, bumpOpts);
      }
    for (const p of primaryIds)
      for (const n of neighborhoodIds) {
        const s = scale(p, n);
        if (s > 0) this._bump(p, n, this.alphaPN * s, bumpOpts);
      }
    // neighborhood <-> neighborhood: alpha 0, intentionally skipped
    return true;
  }

  // RETIRED from the live path in 0.2 (I6). Recall-count, not wall-clock.
  // memory-core no longer calls this. Kept so tests can prove EdgeStore's
  // copy of Ledger's epoch math is byte-identical, and so decay-probe.js
  // can replay the old timescale. Do not mix with effectiveHebbian.
  tick() {
    this.recalls += 1;
    this._recallsDirty = true;
    if (this.epoch > 0 && this.recalls % this.epoch === 0) this.decay();
  }

  decay() {
    for (const [k, e] of [...this.edges]) {
      const w = e.hebbian && typeof e.hebbian.weight === "number" ? e.hebbian.weight : 0;
      const nw = w * this.beta;
      if (nw < this.floor) {
        this.edges.delete(k);
        this._deleted.add(k);
        this._dirty.delete(k);
      } else {
        e.hebbian.weight = nw;   // in-place: do NOT stamp last_updated
        this._touch(k);
      }
    }
  }
}

module.exports = {
  edgeKey,
  makeEdge,
  normalizeEdge,
  semanticValid,
  setSemantic,
  setHebbian,
  sidecarKind,
  readLegacyAssoc,
  migrateAssoc,
  siblingAssocPath,
  IncompatibleEdgeFormatError,
  SIDECAR_KIND,
  SIDECAR_VERSION,
  EdgeStore,
  DEDUP_LRU_SIZE,
  canonRequestId,
  effectiveHebbian,
  lambdaFromHalfLife,
  halfLifeFor,
  hebbianDecayType,
  elapsedSeconds,
  HALF_LIFE_SECONDS,
  DEFAULT_HALF_LIFE_TYPE,
  DAY,
  HOUR,
  SEMANTIC_PRUNE_GATE,
  HEBBIAN_PRUNE_FLOOR,
  isSemanticallyWeak,
  isUnreinforced,
  shouldPrune,
  markPruned,
  reactivateEdge,
  JsonEdgePersist,
  SqliteEdgePersist,
  openEdgeStore,
  migrateEdgesSidecarIntoDb,
  isSqliteStore,
  edgesSidecarCandidates,
  snapFromJson,
  envelope,
};
