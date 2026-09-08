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
 * test.js - dependency-free tests. Run:  node test.js
 *
 * Covers the record schema, durable writes, the access sidecar, the temporal
 * model (RM-04), and the Phase 0 unified edge store (edges.js, standalone).
 * Deliberately no framework: this project ships as a single Node binary with
 * zero dependencies, and the tests keep that property.
 *
 * Phase 0 contract (0.5): section headers are keyed to the sub-phase /
 * invariant they defend. Every edge state-transition row asserts the
 * state change AND the Writes? column (I5). Every pre-declared failure
 * signature has a test that fails if that bug is reintroduced. Timing
 * tests use a fake/injectable clock — never real Date.now().
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const {
  writeFileDurable, appendLineDurable,
  normalize, isCurrent, isHistoricalQuery, supersedePatches, AccessLog,
  detectSupersession, hasSupersedeCue,
  detectNearDuplicate, pickMergeSurvivor,
  normalizeText, splitFacts, guardSecrets, prepareWrite, isStandaloneFact,
  isVector, hasVector,
} = require("./record.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ok   " + name); passed++; }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); failed++; }
}
function section(s) { console.log("\n" + s); }
// Async variant: same reporting, awaited before the summary block runs.
async function atest(name, fn) {
  try { await fn(); console.log("  ok   " + name); passed++; }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); failed++; }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rm-test-"));
const tmp = (n) => path.join(tmpRoot, n);

// ------------------------------------------------------------------ schema
section("record schema / migration");

test("normalize backfills temporal fields on a legacy record", () => {
  const r = normalize({ id: 1, text: "hi", created: "2026-01-01T00:00:00Z" });
  assert.strictEqual(r.valid_from, "2026-01-01T00:00:00Z", "valid_from defaults to created");
  assert.strictEqual(r.valid_to, null, "valid_to null = still true");
  assert.strictEqual(r.last_confirmed, "2026-01-01T00:00:00Z");
  assert.strictEqual(r.superseded_by, null);
  assert.strictEqual(r.supersedes, null);
  assert.strictEqual(r.revision, 1);
  assert.strictEqual(r.needs_review, false);
  assert.strictEqual(r.source, "user_stated");
});

test("normalize handles the oldest shape (ts instead of created)", () => {
  const r = normalize({ id: 1, text: "hi", ts: "2025-06-01T00:00:00Z" });
  assert.strictEqual(r.created, "2025-06-01T00:00:00Z");
  assert.strictEqual(r.valid_from, "2025-06-01T00:00:00Z");
});

test("normalize is idempotent", () => {
  const once = normalize({ id: 1, text: "hi" });
  assert.deepStrictEqual(normalize(once), once);
});

test("normalize preserves explicit temporal values", () => {
  const r = normalize({ id: 2, text: "x", valid_from: "A", valid_to: "B", superseded_by: 3, revision: 2 });
  assert.strictEqual(r.valid_to, "B");
  assert.strictEqual(r.superseded_by, 3);
  assert.strictEqual(r.revision, 2);
});

test("normalize backfills embedding_version on a legacy record (Phase 0)", () => {
  const r = normalize({ id: 1, text: "hi", created: "2026-01-01T00:00:00Z" });
  assert.strictEqual(r.embedding_version, 1, "missing field defaults to 1");
});

test("normalize preserves an explicit embedding_version", () => {
  const r = normalize({ id: 1, text: "hi", embedding_version: 4 });
  assert.strictEqual(r.embedding_version, 4);
});

test("normalize treats a JSON-null embedding_version as missing (defaults to 1)", () => {
  // A bad patch that Object.assigned embedding_version: null would persist as
  // JSON null. Next read must not keep null — version comparison needs a number.
  const r = normalize({ id: 1, text: "hi", embedding_version: null });
  assert.strictEqual(r.embedding_version, 1);
});

test("normalize DROPS a Float32Array embedding (typed array is not Array.isArray)", () => {
  // Spike trap: SqliteStore stored NULLs for a whole run because normalize()
  // only keeps Array.isArray embeddings. The drop is the schema's job; the
  // store attaches the typed array AFTER. This test fails if someone "fixes"
  // normalize() to accept ArrayLike without updating the store contract.
  const f32 = new Float32Array([1, 0, 0.5]);
  const r = normalize({ id: 1, text: "x", embedding: f32 });
  assert.strictEqual(r.embedding, null, "Float32Array must not survive normalize()");
  const arr = normalize({ id: 2, text: "y", embedding: [1, 0, 0.5] });
  assert.deepStrictEqual(arr.embedding, [1, 0, 0.5], "JSON number[] still kept");
});

test("isVector accepts both JSON number[] and Float32Array", () => {
  assert.strictEqual(isVector([1, 0]), true);
  assert.strictEqual(isVector(new Float32Array([1, 0])), true);
  assert.strictEqual(isVector(null), false);
  assert.strictEqual(isVector([]), false);
  assert.strictEqual(hasVector({ embedding: new Float32Array([0.1, 0.2]) }), true);
  assert.strictEqual(hasVector({ embedding: null }), false);
});

test("detectNearDuplicate sees a Float32Array neighbor (SqliteStore cache form)", () => {
  const incoming = normalize({ id: 99, text: "I prefer tea", embedding: [1, 0] });
  const stored = {
    id: 1, text: "I prefer tea", embedding: new Float32Array([1, 0]),
    deleted: false, valid_to: null,
  };
  const cosineFn = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  };
  const hit = detectNearDuplicate(incoming, [stored], cosineFn, { hi: 0.95, lo: 0.88 });
  assert.ok(hit, "typed-array neighbor must participate");
  assert.strictEqual(hit.action, "restate");
  assert.strictEqual(hit.match.id, 1);
});

test("isCurrent: superseded and deleted are both excluded", () => {
  assert.strictEqual(isCurrent(normalize({ id: 1, text: "a" })), true);
  assert.strictEqual(isCurrent(normalize({ id: 2, text: "b", valid_to: "2026-01-01" })), false);
  assert.strictEqual(isCurrent(normalize({ id: 3, text: "c", deleted: true })), false);
});

test("supersedePatches builds a non-overlapping validity chain", () => {
  const oldR = normalize({ id: 1, text: "Acme", valid_from: "T0" });
  const newR = normalize({ id: 2, text: "Globex", valid_from: "T2" });
  const p = supersedePatches(oldR, newR);
  assert.strictEqual(p.old.valid_to, "T2", "old closes exactly where new opens");
  assert.strictEqual(p.old.superseded_by, 2);
  assert.strictEqual(p.new.supersedes, 1);
  assert.strictEqual(p.new.revision, 2);
  // Neither patch may carry embedding / embedding_version: Object.assign would
  // clobber the live vector (BUG-008 class) or reset the generation counter.
  assert.strictEqual("embedding" in p.old, false);
  assert.strictEqual("embedding" in p.new, false);
  assert.strictEqual("embedding_version" in p.old, false);
  assert.strictEqual("embedding_version" in p.new, false);
});

// ------------------------------------------------------- supersession detection
section("supersession detection (RM-03)");

// A deterministic stand-in for cosine: the "similarity" of a candidate is just the
// first element of its embedding, so a test can dial in an exact geometry. detect-
// Supersession only ever calls cosineFn(newRec.embedding, m.embedding).
const simStub = (_new, mem) => mem[0];
const mem = (id, text, sim) => ({ id, text, embedding: [sim] });

test("hasSupersedeCue fires on correction language, not on history", () => {
  assert.strictEqual(hasSupersedeCue("Actually I work at Globex now"), true);
  assert.strictEqual(hasSupersedeCue("I moved to Denver last month"), true);
  assert.strictEqual(hasSupersedeCue("I no longer eat meat"), true);
  assert.strictEqual(hasSupersedeCue("I have a cat named Whiskers"), false);
  assert.strictEqual(hasSupersedeCue("I used to work at Acme"), false, "'used to' is historical, not a retirement cue");
});

test("detectSupersession: cue + above floor retires the most-similar memory", () => {
  const newRec = { id: 2, text: "Actually I work at Globex now", embedding: [1] };
  const cur = [mem(1, "I work at Acme", 0.57)];
  assert.strictEqual(detectSupersession(newRec, cur, simStub), cur[0]);
});

test("detectSupersession: no correction cue -> keep both (additive)", () => {
  const newRec = { id: 2, text: "I have a cat named Whiskers", embedding: [1] };
  const cur = [mem(1, "I have a dog named Rex", 0.9)];   // geometrically very close
  assert.strictEqual(detectSupersession(newRec, cur, simStub), null);
});

test("detectSupersession: cue but below floor -> cross-slot, keep both", () => {
  const newRec = { id: 2, text: "Actually I work at Globex now", embedding: [1] };
  const cur = [mem(1, "I live in Austin", 0.51)];        // 0.51 < 0.535 floor
  assert.strictEqual(detectSupersession(newRec, cur, simStub), null);
});

test("detectSupersession: picks the argmax, not just any above-floor memory", () => {
  const newRec = { id: 3, text: "Actually I work at Globex now", embedding: [1] };
  const cur = [mem(1, "I live in Austin", 0.54), mem(2, "I work at Acme", 0.57)];
  assert.strictEqual(detectSupersession(newRec, cur, simStub), cur[1], "the employer, not the city");
});

test("detectSupersession: a vectorless new memory can't target anything", () => {
  const newRec = { id: 2, text: "Actually I work at Globex now", embedding: null };
  const cur = [mem(1, "I work at Acme", 0.99)];
  assert.strictEqual(detectSupersession(newRec, cur, simStub), null);
});

test("detectSupersession: honors a custom minSim", () => {
  const newRec = { id: 2, text: "I switched to decaf now", embedding: [1] };
  const cur = [mem(1, "I drink regular coffee", 0.60)];
  assert.strictEqual(detectSupersession(newRec, cur, simStub, { minSim: 0.7 }), null);
  assert.strictEqual(detectSupersession(newRec, cur, simStub, { minSim: 0.5 }), cur[0]);
});

// ------------------------------------------------ cosine-banded dedup (RM-02.b)
section("cosine-banded dedup detection (RM-02.b)");

test("detectNearDuplicate: cosine ≥ hi is restatement", () => {
  const newRec = { id: 2, text: "I am allergic to penicillin", embedding: [1] };
  const cur = [mem(1, "I'm allergic to penicillin", 0.96)];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.action, "restate");
  assert.strictEqual(d.match, cur[0]);
  assert.strictEqual(d.cosine, 0.96);
});

test("detectNearDuplicate: cosine exactly hi is restatement (≥, not >)", () => {
  // Equality case is hypothetical on the corpus (tea is 0.9522) but the
  // spec is ≥ HI: keep the original rather than merge/rewrite.
  const newRec = { id: 2, text: "paraphrase", embedding: [1] };
  const cur = [mem(1, "original", 0.95)];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.action, "restate");
});

test("detectNearDuplicate: lo ≤ cosine < hi is merge", () => {
  const newRec = { id: 2, text: "I work as a software architect, mostly on games", embedding: [1] };
  const cur = [mem(1, "I work as a software architect", 0.926)];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.action, "merge");
  assert.strictEqual(d.match, cur[0]);
});

test("detectNearDuplicate: cosine < lo is not a duplicate (control)", () => {
  // dog/cat live pair ~0.69; peanuts/peanut-allergy ~0.67. Must NOT merge.
  const newRec = { id: 2, text: "I have a cat named Whiskers", embedding: [1] };
  const cur = [mem(1, "I have a dog named Rex", 0.69)];
  assert.strictEqual(detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 }), null);
});

test("detectNearDuplicate: cosine exactly lo is merge (≥ lo, < hi)", () => {
  const newRec = { id: 2, text: "incoming", embedding: [1] };
  const cur = [mem(1, "existing", 0.88)];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.action, "merge");
});

test("detectNearDuplicate: a vectorless new memory can't compare (append, don't crash)", () => {
  const newRec = { id: 2, text: "I am allergic to penicillin", embedding: null };
  const cur = [mem(1, "I'm allergic to penicillin", 0.99)];
  assert.strictEqual(detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 }), null);
});

test("detectNearDuplicate: skips vectorless existing rows", () => {
  const newRec = { id: 3, text: "incoming", embedding: [1] };
  const cur = [
    { id: 1, text: "no vector", embedding: null },
    mem(2, "has vector", 0.96),
  ];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.match, cur[1], "the vectored row, not the hole");
});

test("detectNearDuplicate: argmax, not the first above the floor", () => {
  const newRec = { id: 3, text: "incoming", embedding: [1] };
  const cur = [mem(1, "control", 0.69), mem(2, "paraphrase", 0.96)];
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.95, lo: 0.88 });
  assert.strictEqual(d.action, "restate");
  assert.strictEqual(d.match, cur[1]);
});

test("detectNearDuplicate: honors injected thresholds (config, not constants)", () => {
  const newRec = { id: 2, text: "incoming", embedding: [1] };
  const cur = [mem(1, "existing", 0.96)];
  // 0.96 is HI at default 0.95, but below a raised hi=0.99 / lo=0.97 → append
  assert.strictEqual(detectNearDuplicate(newRec, cur, simStub, { hi: 0.99, lo: 0.97 }), null);
  const d = detectNearDuplicate(newRec, cur, simStub, { hi: 0.99, lo: 0.90 });
  assert.strictEqual(d.action, "merge", "same pair is merge when hi is raised past it");
});

test("pickMergeSurvivor: longer text wins; equal length keeps existing", () => {
  const short = { id: 1, text: "I have a cat named Koneko" };
  const longer = { id: 2, text: "I have a black cat named Koneko" };
  assert.strictEqual(pickMergeSurvivor(short, longer), longer);
  assert.strictEqual(pickMergeSurvivor(longer, short), longer);
  const a = { id: 1, text: "same length!!" }; // 13
  const b = { id: 2, text: "also 13 chars" }; // 13
  assert.strictEqual(pickMergeSurvivor(a, b), a, "tie keeps the already-stored record");
});

// ------------------------------------------------------------- historical query
section("historical query detection");

for (const q of ["where did I used to work", "what was my previous address",
                 "my old phone number", "where did I work before"]) {
  test(`historical: "${q}"`, () => assert.strictEqual(isHistoricalQuery(q), true));
}
for (const q of ["where do I work", "what is my address", "what should I cook",
                 "remind me about the dog"]) {
  test(`not historical: "${q}"`, () => assert.strictEqual(isHistoricalQuery(q), false));
}

// ------------------------------------------------------------- durable writes
section("durable writes");

test("writeFileDurable writes the exact content", () => {
  const f = tmp("d1.txt");
  writeFileDurable(f, "hello\nworld\n");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "hello\nworld\n");
});

test("writeFileDurable replaces existing content atomically", () => {
  const f = tmp("d2.txt");
  writeFileDurable(f, "first");
  writeFileDurable(f, "second");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "second");
});

test("writeFileDurable leaves no temp files behind", () => {
  const f = tmp("d3.txt");
  writeFileDurable(f, "x");
  const strays = fs.readdirSync(tmpRoot).filter((n) => n.includes(".tmp"));
  assert.deepStrictEqual(strays, [], "found stray temp files: " + strays.join(", "));
});

test("writeFileDurable creates missing directories", () => {
  const f = tmp("nested/deep/d4.txt");
  writeFileDurable(f, "y");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "y");
});

test("a large write is never observed truncated", () => {
  // The property that matters: readers see all-old or all-new, never a partial
  // file. Rename is atomic, so any successful read is a complete document.
  const f = tmp("d5.jsonl");
  const big = Array.from({ length: 5000 }, (_, i) => JSON.stringify({ id: i, text: "m" + i })).join("\n") + "\n";
  writeFileDurable(f, big);
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  assert.strictEqual(lines.length, 5000);
  assert.doesNotThrow(() => lines.forEach((l) => JSON.parse(l)), "every line parses");
});

test("interrupted write: leftover .tmp is ignored; the target is still the complete previous document", () => {
  // Crash window: temp written, rename not yet. Readers must see all-old,
  // never the partial tmp (BUG-001 class). The tmp name is pid+Date.now();
  // a leftover from a dead attempt uses a different suffix.
  const f = tmp("d-interrupt.txt");
  writeFileDurable(f, "complete-old");
  const leftover = path.join(path.dirname(f), "." + path.basename(f) + ".999.1.tmp");
  fs.writeFileSync(leftover, "PARTIAL-NEW");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "complete-old", "target unmoved by a sibling tmp");
  writeFileDurable(f, "complete-new");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "complete-new", "subsequent durable write recovers");
  assert.strictEqual(fs.readFileSync(leftover, "utf8"), "PARTIAL-NEW",
    "a leftover tmp is not consumed as the store (new writes use a fresh tmp name)");
  fs.unlinkSync(leftover);  // crash leftover is not auto-reaped; don't poison later stray-tmp checks
});

test("failed writeFileDurable does not clobber the target and cleans its temp", () => {
  const blocker = tmp("d-fail-blocker");
  writeFileDurable(blocker, "original");
  // Parent is a file, not a directory: mkdir/open of a nested path throws.
  const nested = path.join(blocker, "child.txt");
  assert.throws(() => writeFileDurable(nested, "must-not-land"));
  assert.strictEqual(fs.readFileSync(blocker, "utf8"), "original", "failed write must not touch the live file");
  const strays = fs.readdirSync(tmpRoot).filter((n) => n.includes(".tmp"));
  assert.deepStrictEqual(strays, [], "failed write must unlink its temp: " + strays.join(", "));
});

test("writeFileDurable onto a directory throws, leaves the directory, cleans the temp", () => {
  const d = tmp("d-fail-dir");
  fs.mkdirSync(d);
  assert.throws(() => writeFileDurable(d, "payload"));
  assert.ok(fs.statSync(d).isDirectory(), "rename-onto-dir must not replace the directory");
  const strays = fs.readdirSync(path.dirname(d)).filter((n) =>
    n.startsWith("." + path.basename(d)) && n.endsWith(".tmp"));
  assert.deepStrictEqual(strays, [], "temp cleaned after rename failure");
});

test("appendLineDurable appends without rewriting", () => {
  const f = tmp("d6.jsonl");
  appendLineDurable(f, "a\n");
  appendLineDurable(f, "b\n");
  assert.strictEqual(fs.readFileSync(f, "utf8"), "a\nb\n");
});

// -------------------------------------------------------------- access sidecar
section("access sidecar");

test("bump/apply folds counts onto records", () => {
  const a = new AccessLog(tmp("a1.json"));
  a.bump([1, 2]); a.bump([1]);
  const recs = [normalize({ id: 1, text: "x" }), normalize({ id: 2, text: "y" }), normalize({ id: 3, text: "z" })];
  a.apply(recs);
  assert.strictEqual(recs[0].access_count, 2);
  assert.strictEqual(recs[1].access_count, 1);
  assert.strictEqual(recs[2].access_count, 0);
  assert.ok(recs[0].last_access, "last_access set");
});

test("sidecar round-trips through disk", () => {
  const f = tmp("a2.json");
  const a = new AccessLog(f); a.bump([7]); a.bump([7]); a.save();
  const b = new AccessLog(f);
  assert.strictEqual(b.get(7).n, 2);
});

test("a corrupt sidecar degrades to empty instead of throwing", () => {
  const f = tmp("a3.json");
  fs.writeFileSync(f, "{ not json");
  const a = new AccessLog(f);
  assert.strictEqual(a.get(1).n, 0, "starts empty rather than crashing recall");
});

test("prune drops entries for deleted memories", () => {
  const a = new AccessLog(tmp("a4.json"));
  a.bump([1, 2, 3]);
  a.prune([1, 3]);
  assert.strictEqual(a.get(2).n, 0, "pruned");
  assert.strictEqual(a.get(1).n, 1, "kept");
});

test("importance mirrors access_count (retention signal only)", () => {
  const a = new AccessLog(tmp("a5.json"));
  a.bump([1]); a.bump([1]); a.bump([1]);
  const recs = [normalize({ id: 1, text: "x" })];
  a.apply(recs);
  assert.strictEqual(recs[0].importance, recs[0].access_count);
});

// ------------------------------------------------------------------ store
section("JsonlStore (via a temp store path)");

const { JsonlStore } = require("./store.js");

function freshStore() {
  const dir = tmp("store-" + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return new JsonlStore(path.join(dir, "mem.jsonl"));
}

test("add + current round-trips with temporal fields", () => {
  const s = freshStore();
  const now = new Date().toISOString();
  s.add(normalize({ id: 1, text: "I work at Acme", created: now, valid_from: now }));
  const cur = s.current();
  assert.strictEqual(cur.length, 1);
  assert.strictEqual(cur[0].valid_to, null);
});

test("current() excludes superseded; active() includes it", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "Acme", valid_to: "2026-07-01T00:00:00Z", superseded_by: 2 }));
  s.add(normalize({ id: 2, text: "Globex", supersedes: 1, revision: 2 }));
  assert.strictEqual(s.current().length, 1, "only the current one");
  assert.strictEqual(s.current()[0].text, "Globex");
  assert.strictEqual(s.active().length, 2, "history preserved");
});

test("updateMany applies a supersession in one write", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "Acme" }));
  s.add(normalize({ id: 2, text: "Globex" }));
  const p = supersedePatches(s.get(1), s.get(2), "T2");
  const n = s.updateMany({ "1": p.old, "2": p.new });
  assert.strictEqual(n, 2);
  assert.strictEqual(s.get(1).valid_to, "T2");
  assert.strictEqual(s.get(1).superseded_by, 2);
  assert.strictEqual(s.get(2).supersedes, 1);
  assert.strictEqual(s.current().length, 1);
});

test("recall does NOT rewrite the store (the whole point of the sidecar)", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "a", embedding: [1, 0] }));
  s.add(normalize({ id: 2, text: "b", embedding: [0, 1] }));
  const before = fs.statSync(s.file).mtimeMs;
  const bytesBefore = fs.readFileSync(s.file, "utf8");
  s.applyRecall([1, 2], new Map());           // steady state: nothing to backfill
  assert.strictEqual(fs.readFileSync(s.file, "utf8"), bytesBefore, "store bytes unchanged");
  assert.strictEqual(fs.statSync(s.file).mtimeMs, before, "store not rewritten at all");
  assert.strictEqual(s.get(1).access_count, 1, "but the access bump still landed");
});

test("recall DOES persist backfilled embeddings (legacy rows)", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "a" }));      // no embedding
  s.applyRecall([1], new Map([["1", [0.5, 0.5]]]));
  assert.deepStrictEqual(s.get(1).embedding, [0.5, 0.5]);
});

test("vacuum drops deleted rows and prunes their access entries", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "keep" }));
  s.add(normalize({ id: 2, text: "gone", deleted: true }));
  s.applyRecall([1, 2], new Map());
  assert.strictEqual(s.vacuum(), 1);
  assert.strictEqual(s.all().length, 1);
  assert.strictEqual(s.access.get(2).n, 0, "sidecar pruned with the store");
});

test("a corrupt line is skipped, not fatal", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "good" }));
  fs.appendFileSync(s.file, "{ truncated\n");
  s.add(normalize({ id: 2, text: "also good" }));
  assert.strictEqual(s.all().length, 2, "bad line skipped, good ones survive");
});

// --- regressions for the double-count bug (found by adversarial audit) ---------
// all() folds sidecar counts into records; _writeAll then persisted those folded
// values while the sidecar kept its own copy, so the next read added them again.
// Two recalls + an edit reported 4, then 6, then 8...
test("access_count does not double after an edit", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "x" }));
  s.applyRecall([1], new Map());
  s.applyRecall([1], new Map());
  assert.strictEqual(s.get(1).access_count, 2, "two recalls");
  s.update(1, { text: "edited" });
  assert.strictEqual(s.get(1).access_count, 2, "an edit must not inflate the count");
  s.update(1, { text: "edited again" });
  assert.strictEqual(s.get(1).access_count, 2, "and must not compound");
});

test("access_count does not double after vacuum", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "keep" }));
  s.add(normalize({ id: 2, text: "gone", deleted: true }));
  s.applyRecall([1], new Map());
  s.applyRecall([1], new Map());
  s.applyRecall([1], new Map());
  assert.strictEqual(s.get(1).access_count, 3);
  s.vacuum();
  assert.strictEqual(s.get(1).access_count, 3, "vacuum must not inflate the count");
});

test("counts survive a rewrite (consolidated into the store, not lost)", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "x" }));
  s.applyRecall([1], new Map());
  s.update(1, { text: "edited" });
  // reopen from disk: the total must have been persisted, not dropped with the sidecar
  const reopened = new JsonlStore(s.file);
  assert.strictEqual(reopened.get(1).access_count, 1, "consolidated into the store file");
});

test("recall after a rewrite keeps counting from the consolidated total", () => {
  const s = freshStore();
  s.add(normalize({ id: 1, text: "x" }));
  s.applyRecall([1], new Map());
  s.update(1, { text: "edited" });          // consolidate -> store has 1, sidecar empty
  s.applyRecall([1], new Map());            // sidecar -> 1
  assert.strictEqual(s.get(1).access_count, 2, "1 consolidated + 1 new");
});

test("nextId stays unique under rapid saves (same-millisecond collisions)", () => {
  // Date.now() alone would collide; nextId falls back to max+1 within a tick.
  const s = freshStore();
  const ids = [];
  for (let i = 0; i < 200; i++) { const id = s.nextId(); ids.push(String(id)); s.add(normalize({ id, text: "m" + i })); }
  assert.strictEqual(new Set(ids).size, 200, "all ids distinct");
  assert.strictEqual(s.all().length, 200);
});

test("nextId stays monotonic if the clock jumps backwards", () => {
  const s = freshStore();
  // Capture the id once: calling Date.now() again in the assertion races the
  // clock, and a 1ms tick between the two calls makes the comparison off by one.
  const future = Date.now() + 60000;
  s.add(normalize({ id: future, text: "from the future" }));
  assert.ok(s.nextId() > future, "never reuses an existing id");
});

test("legacy store with no temporal fields loads as all-current", () => {
  const s = freshStore();
  fs.writeFileSync(s.file,
    JSON.stringify({ id: 1, text: "old one", created: "2026-01-01T00:00:00Z" }) + "\n" +
    JSON.stringify({ id: 2, text: "old two", ts: "2026-01-02T00:00:00Z" }) + "\n");
  const cur = s.current();
  assert.strictEqual(cur.length, 2, "no migration step needed");
  assert.ok(cur.every((r) => r.valid_from && r.valid_to === null));
});

test("legacy store with no embedding_version loads as version 1", () => {
  const s = freshStore();
  fs.writeFileSync(s.file,
    JSON.stringify({ id: 1, text: "old one", embedding: [1, 0] }) + "\n");
  assert.strictEqual(s.get(1).embedding_version, 1);
  assert.deepStrictEqual(s.get(1).embedding, [1, 0], "vector untouched by the backfill");
});

test("recall backfill of a vectorless row does NOT increment embedding_version", () => {
  // First-time embed of current text is generation 1, not a re-embed. Bumping
  // here would make a save-time embedder outage look like an edit() mutation.
  const s = freshStore();
  s.add(normalize({ id: 1, text: "a" }));      // no embedding, version 1
  assert.strictEqual(s.get(1).embedding_version, 1);
  s.applyRecall([1], new Map([["1", [0.5, 0.5]]]));
  assert.deepStrictEqual(s.get(1).embedding, [0.5, 0.5]);
  assert.strictEqual(s.get(1).embedding_version, 1, "backfill is not a re-embed");
});

// ------------------------------------------------- RM-07 SqliteStore + conformance
section("SqliteStore (RM-07 drop-in) + Store conformance");

const {
  SqliteStore, openStore, resolveStoreBackend, sqlitePathFor,
} = require("./store.js");

function sqliteAvailable() {
  try { require("node:sqlite"); return true; } catch { return false; }
}

function freshSqlite(name) {
  const dir = tmp("sqlite-" + (name || Math.random().toString(36).slice(2)));
  fs.mkdirSync(dir, { recursive: true });
  const s = new SqliteStore(path.join(dir, "mem.db"));
  return s;
}

function embClose(a, b, eps) {
  eps = eps == null ? 1e-5 : eps;
  if (a == null && b == null) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}

function recFields(r) {
  return {
    id: String(r.id),
    created: r.created,
    text: r.text,
    valid_from: r.valid_from,
    valid_to: r.valid_to,
    superseded_by: r.superseded_by == null ? null : String(r.superseded_by),
    supersedes: r.supersedes == null ? null : String(r.supersedes),
    revision: r.revision,
    deleted: !!r.deleted,
    is_constraint: !!r.is_constraint,
    source: r.source,
    embedding_version: r.embedding_version,
    access_count: r.access_count,
  };
}

if (!sqliteAvailable()) {
  test("SqliteStore SKIPPED (node:sqlite not in this Node)", () => {
    assert.ok(true);
  });
} else {

test("resolveStoreBackend defaults to sqlite; jsonl pin stays", () => {
  const prev = process.env.RESONANCE_STORE;
  try {
    delete process.env.RESONANCE_STORE;
    assert.strictEqual(resolveStoreBackend(null), "sqlite");
    assert.strictEqual(resolveStoreBackend({}), "sqlite");
    assert.strictEqual(resolveStoreBackend({ store: "jsonl" }), "jsonl", "live-config pin");
    assert.strictEqual(resolveStoreBackend({ store: "sqlite" }), "sqlite");
    process.env.RESONANCE_STORE = "jsonl";
    assert.strictEqual(resolveStoreBackend(null), "jsonl", "env pin");
    assert.strictEqual(resolveStoreBackend({ store: "sqlite" }), "sqlite", "config beats env");
    process.env.RESONANCE_STORE = "sqlite";
    assert.strictEqual(resolveStoreBackend(null), "sqlite");
    assert.strictEqual(sqlitePathFor("C:/data/resonance-memory.jsonl").replace(/\\/g, "/"),
      "C:/data/resonance-memory.db");
    assert.strictEqual(sqlitePathFor("mem.db"), "mem.db");
  } finally {
    if (prev == null) delete process.env.RESONANCE_STORE;
    else process.env.RESONANCE_STORE = prev;
  }
});

test("SqliteStore NEVER constructs AccessLog (BUG-007 trap)", () => {
  const s = freshSqlite("no-access");
  assert.strictEqual(s.access, undefined, "no AccessLog on the instance");
  assert.ok(!fs.existsSync(s.file + ".access.json"), "must not create a sidecar");
  // A leftover live sidecar next to the .db is ignored — counts come from the row.
  fs.writeFileSync(s.file + ".access.json", JSON.stringify({ counts: { "1": { n: 99, last: "X" } } }));
  s.add(normalize({ id: 1, text: "x", created: "2026-01-01T00:00:00.000Z" }));
  assert.strictEqual(s.get(1).access_count, 0, "leftover sidecar must not fold in");
  s.applyRecall([1], new Map());
  assert.strictEqual(s.get(1).access_count, 1, "in-table bump only");
  assert.notStrictEqual(s.get(1).access_count, 100, "99 + 1 would be the doubling costume");
  s.close();
});

test("SqliteStore preserves the opaque id (never AUTOINCREMENT-renumbers)", () => {
  const s = freshSqlite("ids");
  const id = 1700000000001;
  s.add(normalize({ id, text: "keep this id", created: "2026-01-01T00:00:00.000Z" }));
  assert.strictEqual(Number(s.get(id).id), id);
  assert.strictEqual(Number(s.current()[0].id), id);
  s.add(normalize({ id: 7, text: "small id", created: "2026-01-01T00:00:00.000Z" }));
  assert.strictEqual(Number(s.get(7).id), 7, "a small explicit id is not reassigned to 1 or 2");
  assert.strictEqual(s.all().length, 2);
  s.close();
});

test("SqliteStore preserves created as a real column", () => {
  const s = freshSqlite("created");
  const created = "2020-06-15T12:34:56.000Z";
  s.add(normalize({ id: 1, text: "old fact", created, modified: "2021-01-01T00:00:00.000Z" }));
  assert.strictEqual(s.get(1).created, created);
  s.update(1, { text: "edited", modified: "2022-01-01T00:00:00.000Z" });
  assert.strictEqual(s.get(1).created, created, "an edit must not rewrite created");
  s.close();
  const reopened = new SqliteStore(s.file);
  assert.strictEqual(reopened.get(1).created, created, "created survives reopen");
  reopened.close();
});

test("SqliteStore attaches Float32Array AFTER normalize() (typed-array trap)", () => {
  const s = freshSqlite("f32");
  const f32 = new Float32Array([1, 0, 0.25]);
  s.add({
    id: 1, text: "vec", created: "2026-01-01T00:00:00.000Z",
    modified: "2026-01-01T00:00:00.000Z", embedding: f32,
  });
  const got = s.get(1);
  assert.ok(got.embedding instanceof Float32Array, "store returns typed array, not number[]");
  assert.ok(embClose(got.embedding, f32), "round-trip within 1e-5");
  assert.strictEqual(normalize({ embedding: got.embedding }).embedding, null,
    "normalize still drops it — attach-after is the store's job");
  s.close();
});

test("I5-SQLite / BUG-002: recall updates only retention columns on returned rows", () => {
  const s = freshSqlite("bug002");
  const created = "2026-01-01T00:00:00.000Z";
  s.add(normalize({ id: 1, text: "a", embedding: [1, 0], created, source: "user_stated" }));
  s.add(normalize({ id: 2, text: "b", embedding: [0, 1], created, source: "user_stated" }));
  const snap = (r) => ({
    id: Number(r.id), created: r.created, modified: r.modified, text: r.text,
    valid_from: r.valid_from, valid_to: r.valid_to, last_confirmed: r.last_confirmed,
    superseded_by: r.superseded_by, supersedes: r.supersedes, revision: r.revision,
    needs_review: r.needs_review, embedding_version: r.embedding_version,
    source: r.source, is_constraint: r.is_constraint, deleted: r.deleted,
    embedding: Array.from(r.embedding || []),
  });
  const before1 = snap(s.get(1));
  const before2 = snap(s.get(2));
  const nBefore = s.all().length;
  s.applyRecall([1], new Map());
  assert.strictEqual(s.all().length, nBefore, "row count unchanged");
  const after1 = s.get(1);
  const after2 = s.get(2);
  assert.strictEqual(after1.access_count, 1, "returned row was bumped");
  assert.ok(after1.last_access, "last_access stamped");
  assert.deepStrictEqual(snap(after1), before1, "no non-retention column on id 1 changed");
  assert.strictEqual(after2.access_count, 0, "non-returned row not bumped");
  assert.strictEqual(after2.last_access, null);
  assert.deepStrictEqual(snap(after2), before2, "id 2 entirely untouched");
  s.close();
});

test("SqliteStore: access_count does not double after an edit (BUG-007 class)", () => {
  const s = freshSqlite("no-double");
  s.add(normalize({ id: 1, text: "x", created: "2026-01-01T00:00:00.000Z" }));
  s.applyRecall([1], new Map());
  s.applyRecall([1], new Map());
  assert.strictEqual(s.get(1).access_count, 2);
  s.update(1, { text: "edited" });
  assert.strictEqual(s.get(1).access_count, 2, "edit must not inflate");
  s.close();
});

test("SqliteStore vacuum drops deleted rows, keeps counts on survivors", () => {
  const s = freshSqlite("vac");
  s.add(normalize({ id: 1, text: "keep", created: "2026-01-01T00:00:00.000Z" }));
  s.add(normalize({ id: 2, text: "gone", deleted: true, created: "2026-01-01T00:00:00.000Z" }));
  s.applyRecall([1], new Map());
  assert.strictEqual(s.hasDeleted(), true);
  assert.strictEqual(s.vacuum(), 1);
  assert.strictEqual(s.all().length, 1);
  assert.strictEqual(s.get(1).access_count, 1);
  assert.strictEqual(s.hasDeleted(), false);
  s.close();
});

test("SqliteStore nextId stays unique under rapid saves", () => {
  const s = freshSqlite("nextid");
  const ids = [];
  for (let i = 0; i < 200; i++) {
    const id = s.nextId();
    ids.push(String(id));
    s.add(normalize({ id, text: "m" + i, created: "2026-01-01T00:00:00.000Z" }));
  }
  assert.strictEqual(new Set(ids).size, 200);
  assert.strictEqual(s.all().length, 200);
  s.close();
});

test("conformance: add/get/current/active/updateMany/vacuum match JsonlStore", () => {
  const created = "2026-03-01T00:00:00.000Z";
  const jsonl = freshStore();
  const sqlite = freshSqlite("conf");
  const recs = [
    normalize({ id: 1, text: "I work at Acme", embedding: [1, 0, 0], created }),
    normalize({ id: 2, text: "I prefer tea", embedding: [0, 1, 0], created }),
    normalize({ id: 3, text: "gone", deleted: true, embedding: [0, 0, 1], created }),
  ];
  for (const r of recs) { jsonl.add(r); sqlite.add(r); }

  const cmp = (a, b, label) => {
    assert.strictEqual(a.length, b.length, label + " length");
    const A = a.map(recFields).sort((x, y) => x.id.localeCompare(y.id));
    const B = b.map(recFields).sort((x, y) => x.id.localeCompare(y.id));
    assert.deepStrictEqual(A, B, label + " fields");
    for (let i = 0; i < a.length; i++) {
      const ja = jsonl.get(A[i].id), sa = sqlite.get(A[i].id);
      assert.ok(embClose(ja.embedding, sa.embedding), label + " embedding id " + A[i].id);
    }
  };
  cmp(jsonl.current(), sqlite.current(), "current");
  cmp(jsonl.active(), sqlite.active(), "active");
  cmp(jsonl.all(), sqlite.all(), "all");

  const p = supersedePatches(jsonl.get(1), jsonl.get(2), "T2");
  assert.strictEqual(jsonl.updateMany({ "1": p.old, "2": p.new }), 2);
  assert.strictEqual(sqlite.updateMany({ "1": p.old, "2": p.new }), 2);
  cmp(jsonl.current(), sqlite.current(), "after supersession current");
  cmp(jsonl.active(), sqlite.active(), "after supersession active");
  assert.strictEqual(jsonl.get(1).valid_to, sqlite.get(1).valid_to);
  assert.strictEqual(String(jsonl.get(1).superseded_by), String(sqlite.get(1).superseded_by));

  jsonl.applyRecall([2], new Map());
  sqlite.applyRecall([2], new Map());
  assert.strictEqual(jsonl.get(2).access_count, sqlite.get(2).access_count);
  assert.strictEqual(jsonl.get(1).access_count, sqlite.get(1).access_count);

  assert.strictEqual(jsonl.vacuum(), sqlite.vacuum());
  cmp(jsonl.all(), sqlite.all(), "after vacuum");
  sqlite.close();
});

} // sqliteAvailable

// ------------------------------------------------- associative field topology
section("associative field: reciprocal kNN (RM-00)");

const { buildEdges, reachableConstraints } = require("./field.js");
const entity = require("./entity.js");
const invoke = require("./embed-invoke.js");

// Three points on a circle so the nearest-neighbor graph is deliberately one-sided:
//   A(0deg) - B(20deg) - C(35deg).  Gaps: A-B=20, B-C=15, A-C=35.
// With k=1: A's nearest is B, but B's nearest is C (15 < 20), and C's nearest is B.
// So A->B is NOT reciprocated: directional kNN gives A an edge, mutual kNN isolates A.
const rad = (d) => (d * Math.PI) / 180;
const ring = [
  { id: "A", text: "A", embedding: [Math.cos(rad(0)), Math.sin(rad(0))] },
  { id: "B", text: "B", embedding: [Math.cos(rad(20)), Math.sin(rad(20))] },
  { id: "C", text: "C", embedding: [Math.cos(rad(35)), Math.sin(rad(35))] },
];

section("entity ids / polarity (server-assigned, I4)");

test("sister-Naima chemist and Sunday-call share one entity (over-split guard)", () => {
  const recs = [
    { id: "t3_m1", text: "My sister Naima teaches chemistry at the local high school" },
    { id: "t3_m2", text: "Naima is my sister and she works as a high school chemistry teacher" },
    { id: "t3_m3", text: "I call my sister Naima every Sunday evening to catch up" },
    { id: "t3_nm", text: "My coworker Naima is a frontend engineer on the infrastructure team" },
  ];
  const r = entity.resolveEntities(recs);
  const e1 = r.get("t3_m1").entity_ids;
  const e2 = r.get("t3_m2").entity_ids;
  const e3 = r.get("t3_m3").entity_ids;
  const nm = r.get("t3_nm").entity_ids;
  assert.ok(e1.length && e2.length && e3.length, "true members resolved");
  assert.strictEqual(e1[0], e2[0], "chemist restatement is the same person");
  assert.strictEqual(e1[0], e3[0], "Sunday call binds to sister-Naima, not a new id");
  assert.ok(nm.length, "coworker resolved");
  assert.notStrictEqual(nm[0], e1[0], "coworker-Naima is a different entity");
  assert.strictEqual(entity.logicalConflict(r.get("t3_m1"), r.get("t3_nm")), true);
  assert.strictEqual(entity.logicalConflict(r.get("t3_m1"), r.get("t3_m3")), false);
  assert.strictEqual(entity.logicalConflict(r.get("t3_m3"), r.get("t3_nm")), true);
});

test("brother-Omar vs neighbor-Omar split; same-person restatement does not", () => {
  const recs = [
    { id: "A2a", text: "My brother Omar is a dentist in Portland" },
    { id: "A2b", text: "My neighbor Omar is a dentist in Portland" },
    { id: "Ap2", text: "Omar, my brother, runs a dental practice in Portland" },
    { id: "A3a", text: "My wife Priya is a painter who shows at the downtown gallery" },
    { id: "A3b", text: "My colleague Priya is a painter who shows at the downtown gallery" },
  ];
  const r = entity.resolveEntities(recs);
  assert.notStrictEqual(r.get("A2a").entity_ids[0], r.get("A2b").entity_ids[0], "Omar split");
  assert.strictEqual(r.get("A2a").entity_ids[0], r.get("Ap2").entity_ids[0], "Omar restatement merged");
  assert.ok(entity.logicalConflict(r.get("A2a"), r.get("A2b")));
  assert.ok(!entity.logicalConflict(r.get("A2a"), r.get("Ap2")));
  assert.ok(entity.logicalConflict(r.get("A3a"), r.get("A3b")), "Priya wife vs colleague");
});

test("different names, same role: Naima vs Layla are different entities", () => {
  const recs = [
    { id: "B1a", text: "My sister Naima teaches chemistry at the local high school" },
    { id: "B1b", text: "My sister Layla teaches chemistry at the local high school" },
  ];
  const r = entity.resolveEntities(recs);
  assert.notStrictEqual(r.get("B1a").entity_ids[0], r.get("B1b").entity_ids[0]);
  // No shared name → not an entity-mismatch (that's the B1 ceiling: geometry
  // still sees paraphrases; the field filter is name-keyed, not role-keyed).
  assert.strictEqual(entity.logicalConflict(r.get("B1a"), r.get("B1b")), false);
});

test("polarity clash on the same object; different objects do not clash", () => {
  const recs = [
    { id: "p1", text: "Ibuprofen is incompatible with this blood thinner" },
    { id: "p2", text: "Ibuprofen is synergistic with this blood thinner" },
    { id: "p3", text: "I have a severe allergic reaction to penicillin and amoxicillin" },
    { id: "p4", text: "I take daily vitamin D and zinc supplements with breakfast" },
  ];
  const r = entity.resolveEntities(recs);
  assert.ok(entity.logicalConflict(r.get("p1"), r.get("p2")), "incompatible vs synergistic");
  assert.ok(!entity.logicalConflict(r.get("p3"), r.get("p4")), "penicillin vs vitamins: different objects");
});

test("query 'my sister Naima' conflicts with coworker, not with Sunday-call", () => {
  const recs = [
    { id: "q", text: "tell me about my sister Naima" },
    { id: "sis", text: "My sister Naima teaches chemistry at the local high school" },
    { id: "call", text: "I call my sister Naima every Sunday evening to catch up" },
    { id: "job", text: "My coworker Naima is a frontend engineer on the infrastructure team" },
  ];
  const r = entity.resolveEntities(recs);
  assert.ok(!entity.logicalConflict(r.get("q"), r.get("sis")));
  assert.ok(!entity.logicalConflict(r.get("q"), r.get("call")));
  assert.ok(entity.logicalConflict(r.get("q"), r.get("job")));
});

test("buildEdges drops a high-cosine entity-mismatch (Omar class)", () => {
  // Cosine 1.0, well above 0.70. Without the conflict callback this is an edge.
  const recs = [
    { id: "a", text: "My brother Omar is a dentist in Portland", embedding: [1, 0] },
    { id: "b", text: "My neighbor Omar is a dentist in Portland", embedding: [1, 0] },
  ];
  const raw = buildEdges(recs, { k: 2, minSim: 0.70 });
  assert.ok((raw.get("a") || []).some((e) => e.id === "b"), "geometry alone would link them");
  const filtered = buildEdges(recs, {
    k: 2, minSim: 0.70,
    conflict: entity.pairConflictFn(entity.resolveEntities(recs)),
  });
  assert.strictEqual((filtered.get("a") || []).length, 0, "entity mismatch drops the edge");
});

section("embedder invocation (per-model prefixes)");

test("nomic stays raw for query and document", () => {
  assert.strictEqual(invoke.detectEmbedderFamily("text-embedding-nomic-embed-text-v1.5", null), "nomic");
  assert.strictEqual(invoke.formatEmbedInput("hello", "query", "nomic"), "hello");
  assert.strictEqual(invoke.formatEmbedInput("hello", "document", "nomic"), "hello");
});

test("Qwen wraps queries, leaves documents raw", () => {
  assert.strictEqual(invoke.detectEmbedderFamily("Qwen/Qwen3-Embedding-0.6B", null), "qwen");
  assert.ok(invoke.formatEmbedInput("hello", "query", "qwen").startsWith("Instruct:"));
  assert.ok(invoke.formatEmbedInput("hello", "query", "qwen").endsWith("hello"));
  assert.strictEqual(invoke.formatEmbedInput("hello", "document", "qwen"), "hello");
});

test("jina applies Query:/Document: roles; panel key wins over model id", () => {
  assert.strictEqual(invoke.detectEmbedderFamily("anything", "jina-embeddings-v5"), "jina");
  assert.strictEqual(invoke.formatEmbedInput("hello", "query", "jina"), "Query: hello");
  assert.strictEqual(invoke.formatEmbedInput("hello", "document", "jina"), "Document: hello");
  // A nomic env model with a jina panel selection is still jina — LM Studio
  // serves whatever is loaded and ignores the request's model field.
  assert.strictEqual(invoke.detectEmbedderFamily("text-embedding-nomic-embed-text-v1.5", "jina-embeddings-v5"), "jina");
});

test("directional kNN gives A a one-sided edge to B", () => {
  const e = buildEdges(ring, { k: 1, minSim: 0.5 });
  assert.deepStrictEqual(e.get("A").map((x) => x.id), ["B"]);
  assert.deepStrictEqual(e.get("B").map((x) => x.id), ["C"], "B prefers C, not A");
});

test("mutual kNN prunes the one-sided edge, isolating A", () => {
  const e = buildEdges(ring, { k: 1, minSim: 0.5, mutual: true });
  assert.deepStrictEqual(e.get("A"), [], "A->B dropped: B does not reciprocate");
  assert.deepStrictEqual(e.get("B").map((x) => x.id), ["C"], "B<->C is reciprocal, kept");
  assert.deepStrictEqual(e.get("C").map((x) => x.id), ["B"], "C<->B is reciprocal, kept");
});

test("mutual kNN never keeps an edge directional kNN dropped (it only prunes)", () => {
  const dir = buildEdges(ring, { k: 2, minSim: 0.5 });
  const mut = buildEdges(ring, { k: 2, minSim: 0.5, mutual: true });
  for (const id of ["A", "B", "C"]) {
    const dset = new Set(dir.get(id).map((x) => String(x.id)));
    for (const e of mut.get(id)) assert.ok(dset.has(String(e.id)), "mutual is a subset of directional");
  }
});

// --- constraint rescue (RM-00 experiment #2) --------------------------------
// C is the constraint. B is its bridge (cos 0.60). D is a far node (cos 0.40).
const C = { id: "C", is_constraint: true, embedding: [1, 0] };
const B = { id: "B", is_constraint: false, embedding: [0.6, 0.8] };       // cos(C,B)=0.60
const D = { id: "D", is_constraint: false, embedding: [0.4, Math.sqrt(1 - 0.16)] }; // cos(C,D)=0.40
const recs = [C, B, D];
const ids = (out) => out.map((e) => String(e.id));

test("reachableConstraints: rescues a constraint via a bridge in the seed pool", () => {
  const out = reachableConstraints(recs, ["B"], { gate: 0.55, exclude: [] });
  assert.deepStrictEqual(ids(out), ["C"], "C reachable because its bridge B is a seed");
});

test("reachableConstraints: a pooled constraint with NO bridge stays quiet (small-store guard)", () => {
  // Adversarial finding (adv-offtopic-quiet): when the store <= k_search the pool is the
  // whole store, so mere pool membership is not relevance. Without a bridge >= gate in the
  // pool, a constraint must NOT surface - else a shellfish allergy fires for an oil-change.
  const out = reachableConstraints([C, D], ["C", "D"], { gate: 0.55, exclude: [] });
  assert.deepStrictEqual(ids(out), [], "existence in the pool is not relevance; needs a real bridge");
});

test("reachableConstraints: never re-surfaces an already-RETURNED constraint", () => {
  const out = reachableConstraints(recs, ["C", "B"], { gate: 0.55, exclude: ["C"] });
  assert.deepStrictEqual(ids(out), [], "C is already shown to the model; don't repeat it");
});

test("reachableConstraints: only constraints are ever surfaced", () => {
  const out = reachableConstraints(recs, ["C", "D"], { gate: 0.35, exclude: [] });
  assert.ok(!ids(out).includes("B") && !ids(out).includes("D"), "non-constraints never appended");
});

test("reachableConstraints: the gate governs whether a bridge counts", () => {
  // C's only seed-neighbor is D at cos 0.40. Above a 0.55 gate D is not a bridge.
  assert.deepStrictEqual(reachableConstraints([C, D], ["D"], { gate: 0.55, exclude: [] }), []);
  // Drop the gate to 0.35 and the same link now rescues C (the stage-2 mechanic).
  assert.deepStrictEqual(ids(reachableConstraints([C, D], ["D"], { gate: 0.35, exclude: [] })), ["C"]);
});

// ------------------------------------------------- Phase 0 contract (RM-21)
// Section headers keyed to sub-phase / invariant. Slice C wired EdgeStore
// into recall: module-level cases still fail without edges.js; live-path
// cases (I3/I5/I9, migration-numbers, constraint-rescue) fail without the
// memory-core wiring. 0.5 fills remaining transition-table Writes? cells
// and the atomic-recovery tests; it does not re-add coverage that 0.0–0.4
// already hold.
section("Phase 0.0 unified edge record + migration");

const {
  edgeKey, makeEdge, normalizeEdge, semanticValid, setSemantic, setHebbian,
  sidecarKind, readLegacyAssoc, migrateAssoc, siblingAssocPath,
  IncompatibleEdgeFormatError,
  SIDECAR_KIND, SIDECAR_VERSION, EdgeStore,
  DEDUP_LRU_SIZE, canonRequestId,
  SqliteEdgePersist, openEdgeStore, migrateEdgesSidecarIntoDb, isSqliteStore, envelope,
  effectiveHebbian, lambdaFromHalfLife, halfLifeFor, hebbianDecayType,
  elapsedSeconds, HALF_LIFE_SECONDS, DEFAULT_HALF_LIFE_TYPE, DAY, HOUR,
  SEMANTIC_PRUNE_GATE, HEBBIAN_PRUNE_FLOOR,
  isSemanticallyWeak, isUnreinforced, shouldPrune, markPruned, reactivateEdge,
} = require("./edges.js");
const { Ledger } = require("./ledger.js");

const T0 = "2026-09-05T00:00:00.000Z";
function plusIso(iso, seconds) {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

// RM-07 slice 5: the Phase 0.2–0.5 edge matrix runs against BOTH persistence
// adapters. JSON sidecar stays the JsonlStore companion; sqlite shares the
// SqliteStore connection. Behaviour must be identical (the API did not move).
function persistKinds() {
  const kinds = ["json"];
  if (typeof sqliteAvailable === "function" && sqliteAvailable()) kinds.push("sqlite");
  return kinds;
}

function makeEdgeStore(kind, name, opts) {
  opts = opts || {};
  if (kind === "sqlite") {
    const dir = tmp("edb-" + name);
    fs.mkdirSync(dir, { recursive: true });
    const store = new SqliteStore(path.join(dir, "mem.db"));
    const persist = new SqliteEdgePersist(store.db);
    const E = new EdgeStore(null, Object.assign({}, opts, { persist }));
    E._ownedStore = store;
    return E;
  }
  return new EdgeStore(tmp(name + ".edges.json"), opts);
}

function reopenEdgeStore(E, opts) {
  opts = opts || {};
  const now = opts.now || E.now;
  if (E.persist && E.persist.kind === "sqlite") {
    const file = E._ownedStore.file;
    try { E._ownedStore.close(); } catch { /* reopening */ }
    const store = new SqliteStore(file);
    const E2 = new EdgeStore(null, Object.assign({}, opts, {
      persist: new SqliteEdgePersist(store.db),
      now,
    }));
    E2._ownedStore = store;
    return E2;
  }
  return new EdgeStore(E.file, Object.assign({ now }, opts));
}

function ptest(name, fn) {
  for (const kind of persistKinds()) {
    test(name + " [" + kind + "]", () => fn(kind));
  }
}

test("edgeKey is undirected: A↔B and B↔A are one edge", () => {
  assert.strictEqual(edgeKey(1, 2), edgeKey(2, 1));
  assert.strictEqual(edgeKey("b", "a"), edgeKey("a", "b"));
  assert.strictEqual(edgeKey(1, 2), "1:2");
});

test("makeEdge sets the spec fields with sane defaults", () => {
  const e = makeEdge(2, 1, { origin: "save-time-neighbor", now: T0 });
  assert.strictEqual(e.a, "1", "endpoints canonicalized (sorted)");
  assert.strictEqual(e.b, "2");
  assert.strictEqual(e.semantic.value, null, "semantic empty until computed");
  assert.deepStrictEqual(e.semantic.src_versions, { a: null, b: null });
  assert.strictEqual(e.hebbian.weight, 0, "unreinforced: Hebbian is genuinely zero");
  assert.strictEqual(e.hebbian.last_updated, T0, "last_updated nests inside hebbian");
  assert.strictEqual(e.provenance.origin, "save-time-neighbor");
  assert.strictEqual(e.provenance.migrated_from, null);
  assert.strictEqual(e.created_at, T0);
  assert.strictEqual(e.pruned_at, null, "null = active");
  assert.strictEqual(e.prune_count, 0);
  assert.strictEqual(e.first_pruned_at, null);
  assert.strictEqual(e.last_reactivated_at, null);
  assert.strictEqual("last_accessed" in e, false, "last_accessed is deliberately absent (I5 / BUG-002)");
  assert.strictEqual("last_updated" in e, false, "no bare last_updated — it clocks hebbian only");
});

test("makeEdge requires a typed origin (no silent default)", () => {
  assert.throws(() => makeEdge(1, 2, { now: T0 }), /origin/);
  assert.throws(() => makeEdge(1, 2, { origin: "migrated", now: T0 }), /origin/);
});

test("the two signals are independent: raising hebbian leaves semantic untouched", () => {
  const e = makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0,
    semantic: { value: 0.72, src_versions: { a: 1, b: 1 } },
  });
  const snap = JSON.parse(JSON.stringify(e.semantic));
  setHebbian(e, 1.4, "2026-09-05T01:00:00.000Z");
  assert.deepStrictEqual(e.semantic, snap, "semantic bytes unmoved");
  assert.strictEqual(e.hebbian.weight, 1.4);
  assert.strictEqual(e.hebbian.last_updated, "2026-09-05T01:00:00.000Z");
  assert.strictEqual(e.created_at, T0, "created_at is provenance only");
});

test("the two signals are independent: setting semantic leaves hebbian untouched", () => {
  const e = makeEdge(1, 2, {
    origin: "co-activation", now: T0, hebbianWeight: 0.5,
  });
  const snap = JSON.parse(JSON.stringify(e.hebbian));
  setSemantic(e, 0.81, { a: 2, b: 2 });
  assert.deepStrictEqual(e.hebbian, snap, "hebbian bytes unmoved");
  assert.strictEqual(e.semantic.value, 0.81);
  assert.deepStrictEqual(e.semantic.src_versions, { a: 2, b: 2 });
});

test("src_versions.a/b follow canonical endpoints, not makeEdge argument order", () => {
  const e = makeEdge(2, 1, {
    origin: "save-time-neighbor", now: T0,
    semantic: { value: 0.5, src_versions: { a: 10, b: 20 } },
  });
  assert.strictEqual(e.a, "1");
  assert.strictEqual(e.b, "2");
  assert.deepStrictEqual(e.semantic.src_versions, { a: 10, b: 20 }, "a=10 is endpoint 1's version");
  assert.strictEqual(semanticValid(e, 10, 20), true);
  assert.strictEqual(semanticValid(e, 20, 10), false);
});

test("semantic validity is a version comparison, not a stored flag", () => {
  const e = makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0,
    semantic: { value: 0.8, src_versions: { a: 1, b: 1 } },
  });
  assert.strictEqual(semanticValid(e, 1, 1), true, "src_versions match both endpoints");
  // Bump endpoint b's embedding_version. No invalidate() is called — there
  // isn't one. Stale is structurally self-evident on the next read.
  assert.strictEqual(semanticValid(e, 1, 2), false, "one endpoint moved; cache is stale");
  assert.strictEqual(e.semantic.value, 0.8, "stale cache still physically present");
  assert.deepStrictEqual(e.semantic.src_versions, { a: 1, b: 1 }, "no invalidation event rewrote the edge");
  assert.strictEqual(semanticValid(e, 2, 1), false, "the other endpoint moving is also stale");
});

test("empty (migrated) semantic is invalid against real embedding_versions", () => {
  const e = makeEdge(1, 2, { origin: "co-activation", now: T0, migrated_from: "assoc.json", hebbianWeight: 0.3 });
  assert.strictEqual(semanticValid(e, 1, 1), false);
  assert.strictEqual(e.semantic.value, null);
});

test("normalizeEdge backfills prune fields and never invents last_accessed", () => {
  const n = normalizeEdge({ a: 3, b: 1, hebbian: { weight: 0.2, last_updated: T0 } }, T0);
  assert.strictEqual(n.a, "1");
  assert.strictEqual(n.pruned_at, null);
  assert.strictEqual(n.prune_count, 0);
  assert.strictEqual("last_accessed" in n, false);
});

// --- migration from .assoc.json --------------------------------------------
const LEGACY_EDGES = {
  "1:2": 0.4,
  "1:3": 0.1,
  "2:5": 1.2,
  "10:2": 0.05,   // lexicographic key (same as ledger.js); must not be dropped
  "7:8": 0,
  "4:9": 0.33,
  "6:11": 0.9,
};
const LEGACY_N = Object.keys(LEGACY_EDGES).length;

function writeLegacyAssoc(file, edges) {
  fs.writeFileSync(file, JSON.stringify({ recalls: 40, edges }));
}

test("migrateAssoc: every .assoc.json edge survives (count + spot-check)", () => {
  const mapped = migrateAssoc({ recalls: 40, edges: LEGACY_EDGES }, T0);
  assert.strictEqual(mapped.size, LEGACY_N, "dropped edge = silent data loss");
  const spot = mapped.get(edgeKey(2, 5));
  assert.ok(spot, "2:5 present");
  assert.strictEqual(spot.hebbian.weight, 1.2, "weight lands on hebbian.weight");
  assert.strictEqual(spot.hebbian.last_updated, T0, "last_updated stamped at migration (lower bound)");
  assert.strictEqual(spot.created_at, T0, "created_at stamped at migration (lower bound)");
  assert.strictEqual(spot.provenance.origin, "co-activation", "genuine origin, not a bookkeeping value");
  assert.strictEqual(spot.provenance.migrated_from, "assoc.json");
  assert.strictEqual(spot.semantic.value, null, "semantic empty; computed on first use");
  assert.strictEqual(spot.pruned_at, null);
  // zero-weight edges survive too — lossless means the key, not a floor.
  assert.strictEqual(mapped.get(edgeKey(7, 8)).hebbian.weight, 0);
  assert.ok(mapped.get(edgeKey(10, 2)), "lexicographic 10:2 survived");
});

test("EdgeStore loads a fixture .assoc.json in memory without writing (I5)", () => {
  const file = tmp("legacy.assoc.json");
  writeLegacyAssoc(file, LEGACY_EDGES);
  const bytes = fs.readFileSync(file, "utf8");
  const mtime = fs.statSync(file).mtimeMs;
  const store = new EdgeStore(file, { now: () => T0 });
  assert.strictEqual(store.size, LEGACY_N);
  assert.strictEqual(store.migrated, true);
  assert.strictEqual(store.get(2, 5).hebbian.weight, 1.2);
  assert.strictEqual(fs.readFileSync(file, "utf8"), bytes, "load must not rewrite the sidecar");
  assert.strictEqual(fs.statSync(file).mtimeMs, mtime);
});

test("EdgeStore save of a migrated sidecar is the new format, still N edges", () => {
  const file = tmp("migrated.assoc.json");
  writeLegacyAssoc(file, LEGACY_EDGES);
  const store = new EdgeStore(file, { now: () => T0 });
  store.save();
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.strictEqual(j.kind, SIDECAR_KIND);
  assert.strictEqual(j.version, SIDECAR_VERSION);
  assert.strictEqual(j.recalls, 40, "epoch clock survives migration");
  assert.strictEqual(Object.keys(j.edges).length, LEGACY_N);
  const reloaded = new EdgeStore(file, { now: () => T0 });
  assert.strictEqual(reloaded.migrated, false, "second load is native, not a re-migration");
  assert.strictEqual(reloaded.size, LEGACY_N);
  assert.strictEqual(reloaded.get(2, 5).hebbian.weight, 1.2);
  assert.strictEqual(reloaded.get(2, 5).provenance.migrated_from, "assoc.json");
});

test("one-way: an old-format reader fails cleanly on the new sidecar", () => {
  const file = tmp("new-format.assoc.json");
  const store = new EdgeStore(file, { now: () => T0 });
  store.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.7 }));
  store.save();
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.strictEqual(sidecarKind(j), SIDECAR_KIND);
  assert.throws(
    () => readLegacyAssoc(j),
    (err) => err instanceof IncompatibleEdgeFormatError && /resonance-edges/.test(err.message),
    "must throw, not return a silent subset of edges"
  );
  // Belt: object-valued edges without the kind still refuse (misparse = NaN weights).
  assert.throws(
    () => readLegacyAssoc({ recalls: 0, edges: { "1:2": j.edges["1:2"] } }),
    IncompatibleEdgeFormatError
  );
});

test("readLegacyAssoc still accepts a real .assoc.json", () => {
  const parsed = readLegacyAssoc({ recalls: 7, edges: { "1:2": 0.4, "3:4": 0.1 } });
  assert.strictEqual(parsed.recalls, 7);
  assert.strictEqual(parsed.edges["1:2"], 0.4);
  assert.strictEqual(sidecarKind({ recalls: 7, edges: { "1:2": 0.4 } }), "legacy-assoc");
});

ptest("persistence round-trip: write → reload → identical records", (kind) => {
  const a = makeEdgeStore(kind, "roundtrip", { now: () => T0 });
  const e1 = makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0,
    semantic: { value: 0.61, src_versions: { a: 1, b: 3 } },
  });
  const e2 = makeEdge(4, 5, { origin: "co-activation", now: T0, hebbianWeight: 0.25, migrated_from: "assoc.json" });
  a.put(e1);
  a.put(e2);
  a.save();
  const b = reopenEdgeStore(a, { now: () => T0 });
  assert.strictEqual(b.size, 2);
  assert.deepStrictEqual(b.get(2, 1), a.get(1, 2));
  assert.deepStrictEqual(b.get(4, 5), a.get(5, 4));
  assert.strictEqual("last_accessed" in b.get(1, 2), false);
  assert.strictEqual(b.get(1, 2).semantic.value, 0.61);
  assert.strictEqual(b.get(4, 5).hebbian.weight, 0.25);
});

test("corrupt sidecar fails open: empty store, does not throw (I3)", () => {
  const cases = [
    ["truncated.json", "{ not json"],
    ["empty.json", ""],
    ["null.json", "null"],
    ["array.json", "[1,2,3]"],
    ["unknown.json", JSON.stringify({ foo: 1, edges: "nope" })],
    ["kind-but-array.json", JSON.stringify({ kind: SIDECAR_KIND, version: 1, edges: [1, 2] })],
  ];
  for (const [name, body] of cases) {
    const file = tmp("corrupt-" + name);
    fs.writeFileSync(file, body);
    let store;
    assert.doesNotThrow(() => { store = new EdgeStore(file, { now: () => T0 }); }, "corrupt " + name + " must not throw");
    assert.strictEqual(store.size, 0, name + " fails open to empty, not a throw");
  }
  // Missing file is the same posture as Ledger: start empty.
  const missing = new EdgeStore(tmp("no-such-sidecar.json"), { now: () => T0 });
  assert.strictEqual(missing.size, 0);
});

test("old Ledger.save stripping kind does not drop records (envelope recovery)", () => {
  // Attack: shipped Ledger.load stores object-valued edges as "weights", then
  // save() writes {recalls, edges} with no kind. Without recovery, sidecarKind
  // would return "unknown" and EdgeStore would fail-open empty — silent loss
  // of irreplaceable Hebbian weight. Slice C must still stop Ledger writing
  // this file; this is the load-side belt.
  const file = tmp("stripped-kind.assoc.json");
  const first = new EdgeStore(file, { now: () => T0 });
  first.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.7 }));
  first.put(makeEdge(3, 4, { origin: "save-time-neighbor", now: T0, hebbianWeight: 0.2 }));
  first.save();
  const native = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ recalls: 0, edges: native.edges }));
  const recovered = new EdgeStore(file, { now: () => T0 });
  assert.strictEqual(recovered.size, 2, "stripped envelope must not fail-open empty");
  assert.strictEqual(recovered.get(1, 2).hebbian.weight, 0.7);
  assert.strictEqual(recovered.get(3, 4).hebbian.weight, 0.2);
  assert.throws(() => readLegacyAssoc(JSON.parse(fs.readFileSync(file, "utf8"))), IncompatibleEdgeFormatError);
});

ptest("incident() lists unpruned edges for an endpoint (Slice C absorption helper)", (kind) => {
  const store = makeEdgeStore(kind, "incident", { now: () => T0 });
  store.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.2 }));
  store.put(makeEdge(1, 3, { origin: "save-time-neighbor", now: T0 }));
  store.put(makeEdge(4, 5, { origin: "co-activation", now: T0 }));
  const inc = store.incident(1);
  assert.strictEqual(inc.length, 2);
  assert.deepStrictEqual(inc.map((e) => edgeKey(e.a, e.b)).sort(), ["1:2", "1:3"]);
});

test("siblingAssocPath maps <store>.edges.json → <store>.assoc.json", () => {
  assert.strictEqual(siblingAssocPath("store.jsonl.edges.json"), "store.jsonl.assoc.json");
  assert.strictEqual(siblingAssocPath("x.assoc.json"), null);
});

test("missing .edges.json migrates a sibling .assoc.json, leaves it untouched", () => {
  const base = tmp("sibstore.jsonl");
  const assoc = base + ".assoc.json";
  const edges = base + ".edges.json";
  writeLegacyAssoc(assoc, LEGACY_EDGES);
  const bytes = fs.readFileSync(assoc, "utf8");
  const mtime = fs.statSync(assoc).mtimeMs;
  const store = new EdgeStore(edges, { now: () => T0 });
  assert.strictEqual(store.migrated, true);
  assert.strictEqual(store.size, LEGACY_N);
  assert.strictEqual(store.get(2, 5).hebbian.weight, 1.2);
  assert.strictEqual(store.recalls, 40, "epoch clock imported");
  assert.strictEqual(fs.readFileSync(assoc, "utf8"), bytes, ".assoc.json is read-only-for-migration");
  assert.strictEqual(fs.statSync(assoc).mtimeMs, mtime);
  assert.ok(fs.existsSync(edges), "migrated table persisted to .edges.json");
  const j = JSON.parse(fs.readFileSync(edges, "utf8"));
  assert.strictEqual(j.kind, SIDECAR_KIND);
  assert.strictEqual(j.recalls, 40);
});

test("existing .edges.json is the authority: a sibling .assoc.json is not merged", () => {
  const base = tmp("authstore.jsonl");
  const assoc = base + ".assoc.json";
  const edges = base + ".edges.json";
  // Write the NEW file first so load() never looks at the sibling.
  const only = makeEdge(8, 9, { origin: "co-activation", now: T0, hebbianWeight: 0.01 });
  fs.writeFileSync(edges, JSON.stringify({
    kind: SIDECAR_KIND, version: SIDECAR_VERSION, recalls: 0,
    edges: { [edgeKey(8, 9)]: only },
  }));
  writeLegacyAssoc(assoc, LEGACY_EDGES);
  const reloaded = new EdgeStore(edges, { now: () => T0 });
  assert.strictEqual(reloaded.size, 1, "must not pull in the leftover .assoc.json");
  assert.ok(reloaded.get(8, 9));
  assert.strictEqual(reloaded.get(2, 5), undefined);
});

test("corrupt .edges.json fails open and does NOT fall back to .assoc.json", () => {
  const base = tmp("corrupt-fallback.jsonl");
  const assoc = base + ".assoc.json";
  const edges = base + ".edges.json";
  writeLegacyAssoc(assoc, LEGACY_EDGES);
  fs.writeFileSync(edges, "{ not json");
  const store = new EdgeStore(edges, { now: () => T0 });
  assert.strictEqual(store.size, 0, "fail-open is empty, not a silent merge of stale weights");
  assert.strictEqual(store.migrated, false);
});

// --- Hebbian math: moving storage must not move the numbers -----------------
ptest("EdgeStore.bonus matches shipped Ledger.bonus on the same weights (tanh bound)", (kind) => {
  const L = new Ledger(tmp("math-l-" + kind + ".assoc.json"));
  const E = makeEdgeStore(kind, "math-e", { now: () => T0 });
  L.edges.set("1:2", 0.4);
  L.edges.set("1:3", 1.2);
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.4 }));
  E.put(makeEdge(1, 3, { origin: "co-activation", now: T0, hebbianWeight: 1.2 }));
  assert.strictEqual(E.bonus(1, 2), L.bonus(1, 2));
  assert.strictEqual(E.bonus(1, 3), L.bonus(1, 3));
  assert.strictEqual(E.bonus(2, 3), 0, "missing edge is bonus 0");
  assert.strictEqual(E.bonus(1, 2), 0.3 * Math.tanh(0.4));
  assert.strictEqual(E.bonus(9, 9), 0);
});

ptest("EdgeStore.reinforceRecall + tick match Ledger on the same event (alphaPP/PN/NN + epoch decay)", (kind) => {
  const L = new Ledger(tmp("reinf-l-" + kind + ".assoc.json"));
  const E = makeEdgeStore(kind, "reinf-e", { now: () => T0 });
  L.reinforceRecall(["1", "2"], ["3", "4"]);
  E.reinforceRecall(["1", "2"], ["3", "4"]);
  assert.strictEqual(E.weight(1, 2), L.weight(1, 2), "primary<->primary alphaPP");
  assert.strictEqual(E.weight(1, 3), L.weight(1, 3), "primary<->neighborhood alphaPN");
  assert.strictEqual(E.weight(2, 4), L.weight(2, 4));
  assert.strictEqual(E.weight(3, 4), 0, "neighborhood<->neighborhood is zero");
  assert.strictEqual(L.weight(3, 4), 0);
  for (let i = 0; i < 10; i++) { L.tick(); E.tick(); }
  assert.strictEqual(E.recalls, L.recalls);
  assert.strictEqual(E.weight(1, 2), L.weight(1, 2), "epoch decay applied on the 10th tick");
  assert.strictEqual(E.weight(1, 3), L.weight(1, 3));
});

test("migrated .assoc.json produces the same Hebbian bonuses as shipped Ledger", () => {
  const base = tmp("same-numbers.jsonl");
  const assoc = base + ".assoc.json";
  const edges = base + ".edges.json";
  const fixture = { "1:2": 0.4, "1:3": 1.2, "10:2": 0.05, "7:8": 0 };
  writeLegacyAssoc(assoc, fixture);
  const L = new Ledger(assoc);
  const E = new EdgeStore(edges, { now: () => T0 });
  for (const k of Object.keys(fixture)) {
    const [a, b] = k.split(":");
    assert.strictEqual(E.bonus(a, b), L.bonus(a, b), "bonus " + k + " drifted");
    assert.strictEqual(E.weight(a, b), L.weight(a, b), "weight " + k + " drifted");
  }
  assert.strictEqual(E.recalls, L.recalls, "epoch clock imported");
});

ptest("retired epoch decay does not stamp hebbian.last_updated (live clock is wall-clock)", (kind) => {
  // tick() is off the live path as of 0.2; this only proves the retired copy
  // still matches Ledger and does not mix clocks if someone replays it.
  const E = makeEdgeStore(kind, "decay-stamp", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 }));
  for (let i = 0; i < 10; i++) E.tick();
  assert.ok(E.weight(1, 2) < 1.0, "decayed");
  assert.strictEqual(E.get(1, 2).hebbian.last_updated, T0, "epoch decay must not mix in wall-clock");
});

// --- Phase 0.2: lazy wall-clock Hebbian decay (I6) -------------------------
// Fake/injectable clock throughout. Decay is COMPUTED, never stored.
section("Phase 0.2 lazy wall-clock decay (I6)");

test("half-life parameters are seconds and match the spec starting values", () => {
  assert.strictEqual(HALF_LIFE_SECONDS.constraint, 30 * DAY, "constraints ~30 days");
  assert.strictEqual(HALF_LIFE_SECONDS.fact, 7 * DAY, "facts ~7 days");
  assert.strictEqual(HALF_LIFE_SECONDS.working, 1 * HOUR, "working ~1 hour");
  assert.strictEqual(DEFAULT_HALF_LIFE_TYPE, "fact");
  assert.strictEqual(halfLifeFor("constraint"), 30 * DAY);
  assert.strictEqual(halfLifeFor("working"), 1 * HOUR);
  assert.strictEqual(halfLifeFor("no-such-type"), HALF_LIFE_SECONDS.fact, "unknown type → fact");
  assert.strictEqual(halfLifeFor("ns-custom", { "ns-custom": 99, fact: 7 * DAY }), 99, "namespace lookup");
  const lam = lambdaFromHalfLife(HALF_LIFE_SECONDS.fact);
  assert.ok(Math.abs(lam - Math.LN2 / HALF_LIFE_SECONDS.fact) < 1e-15, "λ = ln(2)/H");
  assert.strictEqual(lambdaFromHalfLife(0), 0, "non-positive H → no decay (fail open)");
  assert.strictEqual(lambdaFromHalfLife(-10), 0);
});

test("hebbianDecayType: a constraint endpoint gets the long half-life class", () => {
  assert.strictEqual(hebbianDecayType({ is_constraint: true }, { is_constraint: false }), "constraint");
  assert.strictEqual(hebbianDecayType({ is_constraint: false }, { is_constraint: true }), "constraint");
  assert.strictEqual(hebbianDecayType({ is_constraint: false }, { is_constraint: false }), "fact");
  assert.strictEqual(hebbianDecayType(null, null), "fact");
});

ptest("I6 proof: 100 reads under a FROZEN clock leave stored weight + last_updated unmoved; then reinforce does change them", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "i6-frozen", { now: () => now });
  const e0 = E.put(makeEdge(1, 2, {
    origin: "co-activation", now: T0, hebbianWeight: 1.0,
    semantic: { value: 0.72, src_versions: { a: 1, b: 1 } },
  }));
  const hebSnap = JSON.parse(JSON.stringify(e0.hebbian));
  const semSnap = JSON.parse(JSON.stringify(e0.semantic));
  for (let i = 0; i < 100; i++) {
    E.bonus(1, 2);
    E.effectiveWeight(1, 2);
    E.weight(1, 2);
    effectiveHebbian(E.get(1, 2), now);
  }
  const after = E.get(1, 2);
  assert.deepStrictEqual(after.hebbian, hebSnap, "stored Hebbian bytes unmoved by reads (I6)");
  assert.deepStrictEqual(after.semantic, semSnap, "semantic unmoved by reads");
  assert.strictEqual(effectiveHebbian(after, now), 1.0, "frozen clock → effective == stored");
  assert.strictEqual(E.persist.writes, 0, "a read must not persist (SELECT is not an UPDATE)");
  // Genuine reinforcement, after the clock has moved, MUST change both.
  now = plusIso(T0, 60);
  E.reinforceRecall(["1", "2"], []);
  const bumped = E.get(1, 2);
  assert.ok(bumped.hebbian.weight > 1.0, "reinforceRecall still strengthens (retained path)");
  assert.strictEqual(bumped.hebbian.last_updated, now, "reinforce stamps last_updated");
  assert.deepStrictEqual(bumped.semantic, semSnap, "reinforce leaves semantic alone");
});

test("weight halves at exactly one half-life (w·2^(−Δt/H))", () => {
  const e = makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.8 });
  const H = HALF_LIFE_SECONDS.fact;
  assert.strictEqual(effectiveHebbian(e, T0, { type: "fact" }), 0.8, "Δt=0 → stored");
  assert.strictEqual(effectiveHebbian(e, plusIso(T0, H), { type: "fact" }), 0.4, "exactly one H → half");
  assert.strictEqual(effectiveHebbian(e, plusIso(T0, 2 * H), { type: "fact" }), 0.2, "two H → quarter");
  // λ form agrees with the power-of-two form at one half-life.
  const viaLambda = 0.8 * Math.exp(-lambdaFromHalfLife(H) * H);
  assert.ok(Math.abs(viaLambda - 0.4) < 1e-12, "w·exp(−λH) ≈ w/2");
});

test("decay at multiple elapsed times; monotonic in Δt", () => {
  const e = makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 });
  const H = HALF_LIFE_SECONDS.fact;
  const samples = [0, H / 4, H / 2, H, 2 * H, 10 * H].map((dt) => ({
    dt, w: effectiveHebbian(e, plusIso(T0, dt), { type: "fact" }),
  }));
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].w < samples[i - 1].w,
      "monotonic: Δt=" + samples[i].dt + " must be strictly smaller than Δt=" + samples[i - 1].dt);
  }
  assert.strictEqual(samples[0].w, 1.0);
  assert.ok(samples[samples.length - 1].w < 0.01, "long elapsed → nearly gone (not pruned; that's 0.4)");
});

test("negative clock delta clamps to no decay (cannot amplify)", () => {
  const e = makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.6 });
  const past = plusIso(T0, -86400);
  assert.strictEqual(elapsedSeconds(past, T0), 0);
  assert.strictEqual(effectiveHebbian(e, past, { type: "fact" }), 0.6, "backwards clock → stored, not amplified");
  assert.ok(effectiveHebbian(e, plusIso(T0, 1), { type: "fact" }) < 0.6, "forward still decays");
});

ptest("semantic does NOT decay while Hebbian does", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "sem-vs-heb", { now: () => now });
  E.put(makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0, hebbianWeight: 1.0,
    semantic: { value: 0.81, src_versions: { a: 1, b: 1 } },
  }));
  const semSnap = JSON.parse(JSON.stringify(E.get(1, 2).semantic));
  now = plusIso(T0, HALF_LIFE_SECONDS.fact);
  assert.strictEqual(E.weight(1, 2), 1.0, "stored Hebbian unmoved (computed, not written)");
  assert.strictEqual(E.effectiveWeight(1, 2), 0.5);
  assert.deepStrictEqual(E.get(1, 2).semantic, semSnap, "semantic is structural and does not fade");
  assert.strictEqual(E.get(1, 2).hebbian.last_updated, T0, "read must not stamp last_updated");
});

ptest("bonus uses effectiveHebbian, not the stored weight", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "bonus-eff", { now: () => now });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 }));
  assert.strictEqual(E.bonus(1, 2), 0.3 * Math.tanh(1.0), "Δt=0 → tanh(stored)");
  now = plusIso(T0, HALF_LIFE_SECONDS.fact);
  assert.strictEqual(E.weight(1, 2), 1.0, "stored still 1");
  assert.ok(Math.abs(E.bonus(1, 2) - 0.3 * Math.tanh(0.5)) < 1e-12, "bonus tracks faded weight");
});

test("per-type/namespace half-lives: constraint fades slower than fact, fact slower than working", () => {
  const e = makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 });
  const t = plusIso(T0, HOUR);   // 1 hour elapsed
  const wC = effectiveHebbian(e, t, { type: "constraint" });
  const wF = effectiveHebbian(e, t, { type: "fact" });
  const wW = effectiveHebbian(e, t, { type: "working" });
  const wNs = effectiveHebbian(e, t, { namespace: "working" });
  assert.ok(wC > wF && wF > wW, "30d > 7d > 1h at the same Δt");
  assert.strictEqual(wW, 0.5, "working half-life is 1 hour → exactly half");
  assert.strictEqual(wNs, wW, "namespace uses the same table as type");
  // Custom table override.
  assert.strictEqual(effectiveHebbian(e, plusIso(T0, 10), { halfLife: 10 }), 0.5);
});

// --- Phase 0.3: materialize-on-mutation + request-ID idempotency ----------
// Fake/injectable clock and injectable ids. Both live on the MUTATION path.
section("Phase 0.3 materialize-on-mutation + request-ID idempotency");

test("canonRequestId: missing/null/empty are no-id; 0 is a real id; 1 and \"1\" differ", () => {
  assert.strictEqual(canonRequestId(undefined), null);
  assert.strictEqual(canonRequestId(null), null);
  assert.strictEqual(canonRequestId(""), null);
  assert.strictEqual(canonRequestId(0), "n:0", "JSON-RPC id 0 is valid");
  assert.strictEqual(canonRequestId(1), "n:1");
  assert.strictEqual(canonRequestId("1"), "s:1", "number 1 and string \"1\" are distinct requests");
  assert.strictEqual(canonRequestId("req-abc"), "s:req-abc");
});

ptest("reinforce after a long idle materializes decay first (no ghost weight)", (kind) => {
  // Failure signature: stored becomes original+α instead of decayed+α.
  let now = T0;
  const E = makeEdgeStore(kind, "m-idle", { now: () => now });
  const e0 = E.put(makeEdge(1, 2, {
    origin: "co-activation", now: T0, hebbianWeight: 1.0,
    semantic: { value: 0.77, src_versions: { a: 1, b: 1 } },
  }));
  const originSnap = JSON.parse(JSON.stringify(e0.provenance));
  const semSnap = JSON.parse(JSON.stringify(e0.semantic));
  const created = e0.created_at;
  now = plusIso(T0, HALF_LIFE_SECONDS.fact);   // exactly one fact half-life
  assert.strictEqual(E.weight(1, 2), 1.0, "stored still original before the mutation");
  assert.strictEqual(E.effectiveWeight(1, 2), 0.5, "reads already see the fade");
  E.reinforceRecall(["1", "2"], []);
  const after = E.get(1, 2);
  assert.strictEqual(after.hebbian.weight, 0.5 + E.alphaPP,
    "stored = decayed + α, NOT original + α (ghost weight)");
  assert.notStrictEqual(after.hebbian.weight, 1.0 + E.alphaPP, "must not bypass decay");
  assert.strictEqual(after.hebbian.last_updated, now, "stamp last_updated at reinforce");
  assert.strictEqual(effectiveHebbian(after, now), after.hebbian.weight,
    "after reinforce, stored and effective coincide");
  assert.deepStrictEqual(after.semantic, semSnap, "semantic unmoved");
  assert.deepStrictEqual(after.provenance, originSnap, "provenance preserved");
  assert.strictEqual(after.created_at, created, "created_at is provenance only");
  assert.strictEqual(after.pruned_at, null, "already-active edge: reactivate is a no-op");
});

ptest("Δt=0 reinforce is byte-identical to the pre-0.3 stored+α rule (why the golden holds)", (kind) => {
  const E = makeEdgeStore(kind, "m-dt0", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 }));
  E.reinforceRecall(["1", "2"], []);
  assert.strictEqual(E.weight(1, 2), 1.0 + E.alphaPP, "fresh edge: materialize is a no-op");
  assert.strictEqual(E.get(1, 2).hebbian.last_updated, T0);
  // Ledger parity at Δt=0: same number the retired path would have written.
  const L = new Ledger(tmp("m-dt0-" + kind + ".assoc.json"));
  L.edges.set("1:2", 1.0);
  L.reinforceRecall(["1", "2"], []);
  assert.strictEqual(E.weight(1, 2), L.weight(1, 2), "Δt=0 matches Ledger.reinforceRecall");
});

ptest("same request id retried applies exactly once", (kind) => {
  const E = makeEdgeStore(kind, "m-once", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0 }));
  const first = E.reinforceRecall(["1", "2"], [], "req-1");
  const w = E.weight(1, 2);
  assert.strictEqual(first, true);
  assert.strictEqual(w, E.alphaPP);
  const retry = E.reinforceRecall(["1", "2"], [], "req-1");
  assert.strictEqual(retry, false, "duplicate id is a no-op");
  assert.strictEqual(E.weight(1, 2), w, "weight unmoved on retry");
  assert.ok(E.hasProcessed("req-1"));
});

ptest("two distinct request ids reinforcing the same pair both apply", (kind) => {
  const E = makeEdgeStore(kind, "m-two", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0 }));
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], "req-A"), true);
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], "req-B"), true);
  assert.strictEqual(E.weight(1, 2), 2 * E.alphaPP);
});

ptest("no-id caller applies every time (eval / non-JSON-RPC must not dedup or crash)", (kind) => {
  const E = makeEdgeStore(kind, "m-noid", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0 }));
  assert.strictEqual(E.reinforceRecall(["1", "2"], []), true);
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], undefined), true);
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], { requestId: null }), true);
  assert.strictEqual(E.weight(1, 2), 3 * E.alphaPP, "three no-id calls → three α");
  assert.strictEqual(E.processedIds.length, 0, "no-id is never recorded");
});

ptest("dedup record and weight land in one durable write", (kind) => {
  const E = makeEdgeStore(kind, "m-atomic", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.4 }));
  E.reinforceRecall(["1", "2"], [], 42);
  E.save();
  if (kind === "json") {
    const j = JSON.parse(fs.readFileSync(E.file, "utf8"));
    assert.strictEqual(j.kind, SIDECAR_KIND);
    assert.deepStrictEqual(j.processed_ids, [42], "id is in the same envelope as the edges");
    assert.strictEqual(j.edges["1:2"].hebbian.weight, 0.4 + E.alphaPP);
  } else {
    const n = E.persist.db.prepare("SELECT COUNT(*) AS n FROM edge_processed_ids").get().n;
    assert.strictEqual(Number(n), 1, "id claimed in the same db as the edges");
    const row = E.persist.db.prepare("SELECT hebbian_weight FROM edges WHERE a='1' AND b='2'").get();
    assert.strictEqual(row.hebbian_weight, 0.4 + E.alphaPP);
  }
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.ok(E2.hasProcessed(42));
  assert.strictEqual(E2.weight(1, 2), 0.4 + E.alphaPP);
  assert.strictEqual(E2.reinforceRecall(["1", "2"], [], 42), false, "survives process restart");
});

ptest("DEDUP_LRU_SIZE bound: the oldest id is evicted and can apply again", (kind) => {
  assert.strictEqual(DEDUP_LRU_SIZE, 256, "bound is a named constant, not a magic number");
  const E = makeEdgeStore(kind, "m-lru", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0 }));
  for (let i = 0; i < DEDUP_LRU_SIZE; i++) {
    assert.strictEqual(E.reinforceRecall(["1", "2"], [], "id-" + i), true);
  }
  assert.strictEqual(E.processedIds.length, DEDUP_LRU_SIZE);
  assert.ok(E.hasProcessed("id-0"), "oldest still in the window at capacity");
  // One more distinct id evicts the oldest.
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], "id-new"), true);
  assert.strictEqual(E.processedIds.length, DEDUP_LRU_SIZE, "never grows past the bound");
  assert.strictEqual(E.hasProcessed("id-0"), false, "oldest evicted");
  assert.ok(E.hasProcessed("id-new"));
  const w = E.weight(1, 2);
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], "id-0"), true, "evicted id applies again");
  assert.strictEqual(E.weight(1, 2), w + E.alphaPP);
});

ptest("materialize uses the caller-supplied half-life class (constraint vs working)", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "m-type", { now: () => now });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 }));
  now = plusIso(T0, HOUR);
  E.reinforceRecall(["1", "2"], [], { type: "working" });
  assert.strictEqual(E.weight(1, 2), 0.5 + E.alphaPP,
    "working H=1h → one hour fades to half, then +α");
});

ptest("numeric 0 is a real request id (not treated as no-id)", (kind) => {
  const E = makeEdgeStore(kind, "m-zero", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0 }));
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], 0), true);
  assert.strictEqual(E.reinforceRecall(["1", "2"], [], 0), false);
  assert.strictEqual(E.weight(1, 2), E.alphaPP);
});

ptest("decay-to-zero (computed) leaves the edge alive with semantic intact", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "decay-zero", { now: () => now });
  E.put(makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0, hebbianWeight: 0.4,
    semantic: { value: 0.66, src_versions: { a: 1, b: 1 } },
  }));
  now = plusIso(T0, 100 * HALF_LIFE_SECONDS.fact);   // ~700 days
  assert.ok(E.effectiveWeight(1, 2) < 1e-12, "Hebbian faded to ~0");
  assert.ok(E.get(1, 2), "edge still present (prune is 0.4, not this slice)");
  assert.strictEqual(E.get(1, 2).semantic.value, 0.66, "semantic intact at computed-zero");
  assert.strictEqual(E.weight(1, 2), 0.4, "stored weight is the source of truth, unmoved");
});

// --- Phase 0.4: soft prune + reactivation ----------------------------------
section("Phase 0.4 soft prune + reactivation (I8)");

test("SEMANTIC_PRUNE_GATE matches SAVE_TIME_MIN_COS (below it, bind wouldn't create the edge)", () => {
  const { SAVE_TIME_MIN_COS: minCos } = require("./memory-core.js");
  assert.strictEqual(SEMANTIC_PRUNE_GATE, 0.25);
  assert.strictEqual(SEMANTIC_PRUNE_GATE, minCos,
    "prune gate must stay glued to the save-time bind floor (Risk #2: do not raise to 0.55)");
  assert.ok(SEMANTIC_PRUNE_GATE < 0.45, "must stay below the constraint-rescue gate");
  assert.ok(HEBBIAN_PRUNE_FLOOR < 1e-3, "~0, not the retired epoch floor of 0.05");
});

function putCombo(store, a, b, heb, sem) {
  return store.put(makeEdge(a, b, {
    origin: "save-time-neighbor", now: T0, hebbianWeight: heb,
    semantic: { value: sem, src_versions: { a: 1, b: 1 } },
  }));
}

ptest("pruneSweep fires only for unreinforced AND semantically weak (4 combinations)", (kind) => {
  // Failure signature: a merged scalar prunes the strong-semantic rarely-recalled
  // pair and constraint rescue regresses (RESULTS field experiment #2).
  const E = makeEdgeStore(kind, "p-4combo", { now: () => T0 });
  putCombo(E, 1, 2, 1.0, 0.70);   // reinforced + strong
  putCombo(E, 3, 4, 1.0, 0.10);   // reinforced + weak
  putCombo(E, 5, 6, 0, 0.70);     // unreinforced + strong  ← must SURVIVE
  putCombo(E, 7, 8, 0, 0.10);     // unreinforced + weak    ← only this prunes
  const n = E.pruneSweep();
  assert.strictEqual(n, 1, "exactly one of the four combinations prunes");
  assert.strictEqual(E.get(1, 2).pruned_at, null, "reinforced+strong stays");
  assert.strictEqual(E.get(3, 4).pruned_at, null, "reinforced+weak stays (Hebbian is enough)");
  assert.strictEqual(E.get(5, 6).pruned_at, null, "unreinforced+strong stays (the two-signal rule)");
  assert.strictEqual(E.get(7, 8).pruned_at, T0, "unreinforced+weak is the only prune");
  assert.strictEqual(E.get(7, 8).prune_count, 1);
  assert.strictEqual(E.get(7, 8).first_pruned_at, T0);
});

ptest("semantic exactly at the prune gate survives (same >= as save-time bind)", (kind) => {
  const E = makeEdgeStore(kind, "p-gate", { now: () => T0 });
  putCombo(E, 1, 2, 0, SEMANTIC_PRUNE_GATE);          // 0.25 on the gate
  putCombo(E, 3, 4, 0, SEMANTIC_PRUNE_GATE - 1e-9);    // just under
  E.pruneSweep();
  assert.strictEqual(E.get(1, 2).pruned_at, null, "0.25 is worth persisting");
  assert.ok(E.get(3, 4).pruned_at, "just under 0.25 prunes when unreinforced");
});

ptest("null/empty semantic is weak: unreinforced migrated edges prune", (kind) => {
  const E = makeEdgeStore(kind, "p-nullsem", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0, migrated_from: "assoc.json" }));
  E.put(makeEdge(3, 4, { origin: "co-activation", now: T0, hebbianWeight: 0.8, migrated_from: "assoc.json" }));
  E.pruneSweep();
  assert.ok(E.get(1, 2).pruned_at, "no semantic + no Hebbian → prune");
  assert.strictEqual(E.get(3, 4).pruned_at, null, "no semantic but still reinforced → keep");
});

ptest("decayed-to-~0 Hebbian counts as unreinforced (effective, not stored)", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "p-decayed", { now: () => now });
  putCombo(E, 1, 2, 0.4, 0.10);   // will be unreinforced+weak after idle
  putCombo(E, 3, 4, 0.4, 0.70);   // will be unreinforced+strong after idle
  now = plusIso(T0, 100 * HALF_LIFE_SECONDS.fact);
  assert.ok(E.effectiveWeight(1, 2) < HEBBIAN_PRUNE_FLOOR);
  assert.ok(E.effectiveWeight(3, 4) < HEBBIAN_PRUNE_FLOOR);
  assert.strictEqual(E.weight(1, 2), 0.4, "stored is unmoved until a mutation");
  const n = E.pruneSweep();
  assert.strictEqual(n, 1);
  assert.ok(E.get(1, 2).pruned_at, "faded + weak prunes");
  assert.strictEqual(E.get(3, 4).pruned_at, null, "faded + strong survives (constraint-rescue case)");
  assert.strictEqual(E.get(1, 2).hebbian.weight, 0.4, "soft prune keeps the decayed stored weight");
  assert.strictEqual(E.get(1, 2).hebbian.last_updated, T0, "prune does not stamp last_updated");
});

ptest("a semantically-strong unreinforced edge still serves constraint-rescue after a sweep", (kind) => {
  // The live field.js walk rebuilds from embeddings (it does not yet read
  // this table), but the failure signature is about THIS record vanishing.
  // incident() is the retrieval surface a later rescue walk would use.
  const E = makeEdgeStore(kind, "p-rescue", { now: () => T0 });
  putCombo(E, "lemon", "diabetic", 0, 0.60);   // >= CONSTRAINT_GATE 0.45
  putCombo(E, "lemon", "noise", 0, 0.10);
  E.pruneSweep();
  assert.strictEqual(E.get("lemon", "diabetic").pruned_at, null, "bridge survived");
  const inc = E.incident("lemon");
  assert.strictEqual(inc.length, 1, "weak noise pruned out of retrieval");
  assert.strictEqual(inc[0].b === "diabetic" || inc[0].a === "diabetic", true);
  assert.ok(inc[0].semantic.value >= 0.45, "surviving bridge still clears the rescue gate");
});

ptest("I8: pruned edges are excluded from retrieval but the record persists and reloads", (kind) => {
  const E = makeEdgeStore(kind, "p-i8", { now: () => T0 });
  putCombo(E, 1, 2, 0, 0.10);
  putCombo(E, 1, 3, 0, 0.70);
  E.pruneSweep();
  assert.strictEqual(E.size, 2, "soft prune does not drop the record");
  assert.ok(E.get(1, 2), "get() still returns the pruned row");
  assert.ok(E.get(1, 2).pruned_at);
  assert.strictEqual(E.incident(1).length, 1, "incident() skips pruned_at != null");
  assert.strictEqual(E.weight(1, 2), 0, "weight() of a pruned edge is 0");
  assert.strictEqual(E.bonus(1, 2), 0, "bonus() of a pruned edge is 0");
  assert.ok(E.hasPruned());
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.strictEqual(E2.size, 2);
  assert.ok(E2.get(1, 2).pruned_at);
  assert.strictEqual(E2.get(1, 2).prune_count, 1);
  assert.strictEqual(E2.incident(1).length, 1);
});

ptest("a second pruneSweep of an already-pruned edge is a no-op (prune_count stays 1)", (kind) => {
  const E = makeEdgeStore(kind, "p-twice", { now: () => T0 });
  putCombo(E, 1, 2, 0, 0.10);
  assert.strictEqual(E.pruneSweep(), 1);
  assert.strictEqual(E.pruneSweep(), 0);
  assert.strictEqual(E.get(1, 2).prune_count, 1);
});

ptest("reactivate preserves created_at, prune_count, first_pruned_at, and the decayed weight", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "p-re", { now: () => now });
  const created = T0;
  E.put(makeEdge(1, 2, {
    origin: "co-activation", now: created, hebbianWeight: 1.0,
    semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
  }));
  now = plusIso(T0, 100 * HALF_LIFE_SECONDS.fact);
  const faded = E.effectiveWeight(1, 2);
  assert.ok(faded < HEBBIAN_PRUNE_FLOOR);
  E.pruneSweep();
  const prunedAt = E.get(1, 2).pruned_at;
  now = plusIso(now, 60);
  const n = E.reactivateIncident(1);
  assert.strictEqual(n, 1);
  const after = E.get(1, 2);
  assert.strictEqual(after.pruned_at, null);
  assert.strictEqual(after.created_at, created, "created_at is provenance — never reset");
  assert.strictEqual(after.prune_count, 1, "bounded history keeps the count");
  assert.strictEqual(after.first_pruned_at, prunedAt);
  assert.strictEqual(after.last_reactivated_at, now);
  assert.strictEqual(after.hebbian.weight, 1.0, "stored weight is not snapped to a new full value");
  assert.strictEqual(after.hebbian.last_updated, created, "last_updated unmoved — that would make it 'full' again");
  assert.ok(effectiveHebbian(after, now) < HEBBIAN_PRUNE_FLOOR, "effective still decayed");
  assert.strictEqual(E.incident(1).length, 1, "back in retrieval");
});

ptest("reactivate of an already-active edge is a no-op (last_reactivated_at stays null)", (kind) => {
  const E = makeEdgeStore(kind, "p-re-noop", { now: () => T0 });
  putCombo(E, 1, 2, 0, 0.70);
  assert.strictEqual(E.reactivateIncident(1), 0);
  assert.strictEqual(E.get(1, 2).last_reactivated_at, null);
  assert.strictEqual(E.get(1, 2).pruned_at, null);
});

ptest("reinforce of a pruned edge reactivates then materializes+α (does not reset to original)", (kind) => {
  let now = T0;
  const E = makeEdgeStore(kind, "p-re-bump", { now: () => now });
  putCombo(E, 1, 2, 1.0, 0.10);
  now = plusIso(T0, HALF_LIFE_SECONDS.fact);   // effective = 0.5; still above floor, so force-mark
  markPruned(E.get(1, 2), now);
  E.reinforceRecall(["1", "2"], []);
  const after = E.get(1, 2);
  assert.strictEqual(after.pruned_at, null, "reinforce revives");
  assert.strictEqual(after.last_reactivated_at, now);
  assert.strictEqual(after.hebbian.weight, 0.5 + E.alphaPP, "decayed+α, not original+α");
  assert.strictEqual(after.created_at, T0);
});

ptest("hard vacuum drops pruned edges and is explicit (does not run from pruneSweep)", (kind) => {
  const E = makeEdgeStore(kind, "p-vac", { now: () => T0 });
  putCombo(E, 1, 2, 0, 0.10);
  putCombo(E, 3, 4, 0, 0.70);
  E.pruneSweep();
  assert.strictEqual(E.size, 2, "sweep is soft");
  assert.strictEqual(E.vacuum(), 1, "vacuum returns remaining count, like JsonlStore");
  assert.strictEqual(E.get(1, 2), undefined, "pruned row is gone");
  assert.ok(E.get(3, 4), "active row kept");
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.strictEqual(E2.size, 1);
  assert.strictEqual(E2.get(1, 2), undefined);
});

ptest("pruneSweep with nothing to prune does not rewrite persistence", (kind) => {
  const E = makeEdgeStore(kind, "p-nowrite", { now: () => T0 });
  putCombo(E, 1, 2, 1.0, 0.70);
  E.save();
  const writes = E.persist.writes;
  assert.strictEqual(E.pruneSweep(), 0);
  assert.strictEqual(E.persist.writes, writes, "no-op sweep must not persist");
});

test("shouldPrune helpers: the two-signal conjunction is the whole predicate", () => {
  const strong = makeEdge(1, 2, {
    origin: "save-time-neighbor", now: T0, hebbianWeight: 0,
    semantic: { value: 0.70, src_versions: { a: 1, b: 1 } },
  });
  const weak = makeEdge(3, 4, {
    origin: "save-time-neighbor", now: T0, hebbianWeight: 0,
    semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
  });
  assert.strictEqual(isSemanticallyWeak(strong), false);
  assert.strictEqual(isSemanticallyWeak(weak), true);
  assert.strictEqual(isUnreinforced(strong, T0), true);
  assert.strictEqual(shouldPrune(strong, T0), false, "strong unreinforced must not prune");
  assert.strictEqual(shouldPrune(weak, T0), true);
  markPruned(weak, T0);
  assert.strictEqual(shouldPrune(weak, T0), false, "already pruned → sweep no-op");
  reactivateEdge(weak, T0);
  assert.strictEqual(weak.pruned_at, null);
  assert.strictEqual(weak.prune_count, 1);
});

// --- Phase 0.5: remaining transition-table Writes? cells + atomic recovery --
// Gaps the earlier slices left: interrupted sidecar recovery, the hard-compaction
// write, pruneSweep's positive write, and the full soft-prune column set.
// Failure signatures that already have a guarding test are not re-added.
section("Phase 0.5 contract (transition-table Writes? + atomic recovery)");

test("transition: leftover .tmp sibling is not the store (interrupted persist, EdgeStore)", () => {
  const file = tmp("p05-tmp-sibling.edges.json");
  const E = new EdgeStore(file, { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.7 }));
  E.save();
  const leftover = path.join(path.dirname(file), "." + path.basename(file) + ".999.1.tmp");
  fs.writeFileSync(leftover, "{ this is a partial write");
  const reloaded = new EdgeStore(file, { now: () => T0 });
  assert.strictEqual(reloaded.size, 1, "load reads the target, not the leftover tmp");
  assert.strictEqual(reloaded.get(1, 2).hebbian.weight, 0.7);
});

test("transition: a leftover .tmp with no target is NOT ingested (fail-open empty)", () => {
  // Recovery is "all-old or all-new", never "promote the temp". A crash
  // before the first rename leaves no target; I3 fail-open is empty, not
  // a guess at a partial file. Learned weight in that tmp is gone — the
  // same cost as a corrupt sidecar.
  const file = tmp("p05-tmp-only.edges.json");
  const leftover = path.join(path.dirname(file), "." + path.basename(file) + ".999.1.tmp");
  const ghost = makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.99 });
  fs.writeFileSync(leftover, JSON.stringify({
    kind: SIDECAR_KIND, version: SIDECAR_VERSION, recalls: 0,
    edges: { [edgeKey(1, 2)]: ghost },
  }));
  const E = new EdgeStore(file, { now: () => T0 });
  assert.strictEqual(E.size, 0, "tmp is not the store; a missing target fail-opens empty");
  assert.strictEqual(E.get(1, 2), undefined);
});

test("transition: EdgeStore.save failure does not throw and does not empty the in-memory table (I3)", () => {
  // save() swallows write errors so a full disk cannot break recall.
  // In-memory learned weight is kept; the next successful save persists it.
  const dir = tmp("p05-save-fail-dir");
  fs.mkdirSync(dir);
  const E = new EdgeStore(dir, { now: () => T0 });   // path is a directory → rename fails
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.4 }));
  assert.doesNotThrow(() => E.save(), "I3: sidecar write must never throw into recall");
  assert.strictEqual(E.size, 1, "failed persist must not wipe the in-memory table");
  assert.strictEqual(E.get(1, 2).hebbian.weight, 0.4);
});

ptest("transition: soft prune writes; semantic + hebbian + created_at + last_updated unmoved", (kind) => {
  const E = makeEdgeStore(kind, "p05-soft-cols", { now: () => T0 });
  const e0 = putCombo(E, 1, 2, 0, 0.10);
  const created = e0.created_at;
  const hebSnap = JSON.parse(JSON.stringify(e0.hebbian));
  const semSnap = JSON.parse(JSON.stringify(e0.semantic));
  E.save();
  const writes = E.persist.writes;
  assert.strictEqual(E.pruneSweep(), 1);
  const after = E.get(1, 2);
  assert.ok(E.persist.writes > writes, "Writes? yes");
  assert.deepStrictEqual(after.semantic, semSnap, "semantic unchanged");
  assert.deepStrictEqual(after.hebbian, hebSnap, "stored Hebbian unchanged (keeps the decayed value)");
  assert.strictEqual(after.created_at, created);
  assert.strictEqual(after.pruned_at, T0);
  assert.strictEqual(after.prune_count, 1);
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.strictEqual(E2.get(1, 2).pruned_at, T0);
});

ptest("transition: hard compaction writes and drops both signals", (kind) => {
  const E = makeEdgeStore(kind, "p05-vac-write", { now: () => T0 });
  putCombo(E, 1, 2, 0, 0.10);
  putCombo(E, 3, 4, 0.8, 0.70);
  E.pruneSweep();
  const writes = E.persist.writes;
  assert.ok(E.get(1, 2), "soft-pruned row still in the table");
  assert.strictEqual(E.vacuum(), 1);
  assert.ok(E.persist.writes > writes, "Writes? yes");
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.strictEqual(E2.get(1, 2), undefined, "pruned row dropped (both signals gone)");
  assert.ok(E2.get(3, 4), "active row kept");
  assert.strictEqual(E2.get(3, 4).hebbian.weight, 0.8);
  assert.strictEqual(E2.get(3, 4).semantic.value, 0.70);
});

ptest("transition: vacuum of nothing does not rewrite persistence", (kind) => {
  const E = makeEdgeStore(kind, "p05-vac-nowrite", { now: () => T0 });
  putCombo(E, 1, 2, 1.0, 0.70);
  E.save();
  const writes = E.persist.writes;
  assert.strictEqual(E.vacuum(), 1, "remaining count, nothing dropped");
  assert.strictEqual(E.persist.writes, writes);
});

// --- RM-07 slice 5: edges-in-db (persistence adapter, not a second EdgeStore)
section("RM-07 slice 5 — EdgeStore SQLite adapter + one-file sovereignty");

if (sqliteAvailable()) {

test("openEdgeStore selects sqlite persist when the Store is SqliteStore", () => {
  const s = freshSqlite("open-edge");
  const E = openEdgeStore({ store: s, storePath: tmp("open-edge.jsonl") });
  assert.strictEqual(E.persist.kind, "sqlite");
  assert.ok(isSqliteStore(s));
  s.close();
});

test("openEdgeStore keeps the JSON sidecar for JsonlStore", () => {
  const file = tmp("open-jsonl.jsonl");
  const s = new JsonlStore(file);
  const E = openEdgeStore({ store: s, storePath: file });
  assert.strictEqual(E.persist.kind, "json");
  assert.ok(E.file.endsWith(".edges.json"));
});

test("edges-migration lossless: every sidecar edge survives into the table", () => {
  const dir = tmp("mig-edges");
  fs.mkdirSync(dir, { recursive: true });
  const jsonl = path.join(dir, "store.jsonl");
  const sidecar = jsonl + ".edges.json";
  const s = new SqliteStore(path.join(dir, "store.db"));
  s.add(normalize({ id: 1, text: "keep me", created: T0, embedding: [1, 0] }));
  const src = new EdgeStore(sidecar, { now: () => T0 });
  src.put(makeEdge(1, 2, {
    origin: "co-activation", now: T0, hebbianWeight: 0.42,
    semantic: { value: 0.61, src_versions: { a: 1, b: 3 } },
  }));
  src.put(makeEdge(3, 4, { origin: "save-time-neighbor", now: T0, hebbianWeight: 0 }));
  src.processedIds = [42, "rpc-1"];
  src.save();
  const srcN = src.size;
  const result = migrateEdgesSidecarIntoDb(s.db, { storePath: jsonl, dbPath: s.file, log() {} });
  assert.strictEqual(result.migrated, true);
  assert.strictEqual(result.count, srcN);
  assert.ok(!fs.existsSync(sidecar), "sidecar renamed off the live path");
  assert.ok(fs.existsSync(sidecar + ".bak"), "recovery snapshot kept");
  const E = openEdgeStore({ store: s });
  assert.strictEqual(E.size, srcN, "count-verify: every edge survived");
  assert.strictEqual(E.get(1, 2).hebbian.weight, 0.42);
  assert.strictEqual(E.get(1, 2).semantic.value, 0.61);
  assert.deepStrictEqual(E.get(1, 2).semantic.src_versions, { a: 1, b: 3 });
  assert.strictEqual(E.get(3, 4).hebbian.weight, 0);
  assert.ok(E.hasProcessed(42));
  assert.ok(E.hasProcessed("rpc-1"));
  s.close();
});

test("edges-migration does not merge leftover .assoc.json when .edges.json exists", () => {
  const dir = tmp("mig-auth");
  fs.mkdirSync(dir, { recursive: true });
  const jsonl = path.join(dir, "store.jsonl");
  const sidecar = jsonl + ".edges.json";
  const assoc = jsonl + ".assoc.json";
  fs.writeFileSync(sidecar, JSON.stringify({
    kind: SIDECAR_KIND, version: SIDECAR_VERSION, recalls: 0,
    edges: { "8:9": makeEdge(8, 9, { origin: "co-activation", now: T0, hebbianWeight: 0.01 }) },
  }));
  fs.writeFileSync(assoc, JSON.stringify({ recalls: 40, edges: { "2:5": 1.2, "1:3": 0.4 } }));
  const s = new SqliteStore(path.join(dir, "store.db"));
  migrateEdgesSidecarIntoDb(s.db, { storePath: jsonl, dbPath: s.file, log() {} });
  const E = openEdgeStore({ store: s });
  assert.strictEqual(E.size, 1, "must not pull in the leftover .assoc.json");
  assert.ok(E.get(8, 9));
  assert.strictEqual(E.get(2, 5), undefined);
  assert.ok(fs.existsSync(assoc), ".assoc.json left untouched");
  s.close();
});

test("edges-migration fail-open: missing sidecar leaves memories reachable", () => {
  const s = freshSqlite("mig-missing");
  s.add(normalize({ id: 7, text: "still here", created: T0 }));
  const result = migrateEdgesSidecarIntoDb(s.db, {
    storePath: tmp("no-such-store.jsonl"), dbPath: s.file, log() {},
  });
  assert.strictEqual(result.migrated, false);
  assert.strictEqual(s.get(7).text, "still here");
  s.close();
});

test("0.3 atomicity fix: throw-before-commit rolls back BOTH the id claim and the weight", () => {
  // Failure signature the JSON envelope flagged: durable-each, not atomic-as-a-pair.
  // SQLite: one txn. Crash after the DML and before COMMIT must restore BOTH.
  const E = makeEdgeStore("sqlite", "atomic-crash", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.4 }));
  E.save();
  E.persist.throwBeforeCommit = () => { throw new Error("injected crash"); };
  E.reinforceRecall(["1", "2"], [], 42);
  const writes = E.persist.writes;
  E.save(); // I3: swallowed
  assert.strictEqual(E.persist.writes, writes, "COMMIT must not have landed");
  // In-memory still has the mutation (I3: failed persist must not wipe the Map).
  assert.strictEqual(E.weight(1, 2), 0.4 + E.alphaPP);
  assert.ok(E.hasProcessed(42));
  // Disk / reopen: neither fact committed.
  const E2 = reopenEdgeStore(E, { now: () => T0 });
  assert.strictEqual(E2.weight(1, 2), 0.4, "weight rolled back with the id");
  assert.strictEqual(E2.hasProcessed(42), false, "id claim rolled back with the weight");
  assert.strictEqual(E2.reinforceRecall(["1", "2"], [], 42), true, "retry applies once after the crash");
});

test("crash-domain: an edges write failure leaves memories recallable", () => {
  const s = freshSqlite("crash-domain");
  s.add(normalize({
    id: 1, text: "do not lose me", created: T0, embedding: [1, 0],
  }));
  const E = openEdgeStore({ store: s });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.5 }));
  E.save();
  // Poison only the edges table. A subsequent edges save fails; memories
  // INSERT/SELECT on the same connection must still work (own txn, I3).
  s.db.exec("DROP TABLE edges");
  E.put(makeEdge(3, 4, { origin: "co-activation", now: T0, hebbianWeight: 0.1 }));
  assert.doesNotThrow(() => E.save(), "I3: edges persist must never throw into recall");
  assert.strictEqual(s.get(1).text, "do not lose me", "memory survived the edges failure");
  s.add(normalize({ id: 2, text: "new fact after edges boom", created: T0 }));
  assert.strictEqual(s.get(2).text, "new fact after edges boom", "connection not poisoned");
  assert.strictEqual(s.all().length, 2);
  s.close();
});

test("one-file sovereignty: memories + edges + access live in the single .db", () => {
  const s = freshSqlite("one-file");
  s.add(normalize({
    id: 1, text: "tea", created: T0, embedding: [1, 0],
  }));
  s.applyRecall([1], new Map());
  const E = openEdgeStore({ store: s });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 0.3 }));
  E.reinforceRecall(["1", "2"], [], "rpc-onefile");
  E.save();
  s.checkpoint();
  assert.ok(!fs.existsSync(s.file + ".edges.json"), "no edges sidecar next to the db");
  assert.ok(!fs.existsSync(s.file + ".access.json"), "no access sidecar next to the db");
  assert.strictEqual(s.rowCount(), 1);
  assert.strictEqual(s.get(1).access_count, 1, "access is in the row");
  const nEdges = Number(s.db.prepare("SELECT COUNT(*) AS n FROM edges").get().n);
  assert.strictEqual(nEdges, 1, "edges table in the same file");
  const nProc = Number(s.db.prepare("SELECT COUNT(*) AS n FROM edge_processed_ids").get().n);
  assert.strictEqual(nProc, 1, "dedup LRU in the same file");
  const dbPath = s.file;
  s.close();
  assert.ok(fs.existsSync(dbPath));
  assert.ok(!fs.existsSync(dbPath + "-wal") || fs.statSync(dbPath + "-wal").size === 0,
    "checkpointed: the .db is the whole store");
});

test("I6 sqlite: 100 reads do not UPDATE hebbian_weight or last_updated on disk", () => {
  const E = makeEdgeStore("sqlite", "i6-disk", { now: () => T0 });
  E.put(makeEdge(1, 2, { origin: "co-activation", now: T0, hebbianWeight: 1.0 }));
  E.save();
  const rowBefore = E.persist.db.prepare(
    "SELECT hebbian_weight AS w, hebbian_last_updated AS t FROM edges WHERE a='1' AND b='2'"
  ).get();
  const writes = E.persist.writes;
  for (let i = 0; i < 100; i++) {
    E.bonus(1, 2);
    E.effectiveWeight(1, 2);
    effectiveHebbian(E.get(1, 2), T0);
  }
  const rowAfter = E.persist.db.prepare(
    "SELECT hebbian_weight AS w, hebbian_last_updated AS t FROM edges WHERE a='1' AND b='2'"
  ).get();
  assert.strictEqual(rowAfter.w, rowBefore.w);
  assert.strictEqual(rowAfter.t, rowBefore.t);
  assert.strictEqual(E.persist.writes, writes, "a SELECT is not an UPDATE");
});

} // sqliteAvailable

// ------------------------------------------------- ROC/TBR field signals (RM-00)
section("field signals: ROC / TBR (RM-00)");

const {
  fieldSignals,
  register, listMetrics, computeMetric, explainMetric, makeRecallAtK, parsePrimaryHits,
  isCorrectStored, COVER_MAX_WORDS,
} = require("./eval/metrics.js");

const relOut =
  "1. [id 1] I'm diabetic, so no sugary desserts for me\n" +
  "2. [id 9] The potluck is on Friday\n\n" +
  "Related:\n- [id 2] I always bring lemon bars\n- [id 3] Someone booked the room";

test("fieldSignals: rescued reflects whether the constraint surfaced", () => {
  assert.strictEqual(fieldSignals({ expect: { contains: ["diabetic"] } }, relOut).rescued, true);
  assert.strictEqual(fieldSignals({ expect: { contains: ["vegetarian"] } }, relOut).rescued, false);
});

test("fieldSignals: bled counts forbidden terms that leaked", () => {
  assert.strictEqual(fieldSignals({ expect: { excludes: ["mechanic"] } }, relOut).bled, 0);
  const bledOut = relOut + "\n- [id 4] The mechanic said Thursday";
  assert.strictEqual(fieldSignals({ expect: { excludes: ["mechanic"] } }, bledOut).bled, 1);
});

test("fieldSignals: appended counts the field's Related nodes (tangent surface)", () => {
  assert.strictEqual(fieldSignals({ expect: {} }, relOut).appended, 2);
  const noRel = "1. [id 1] just a direct cosine hit, no field additions";
  assert.strictEqual(fieldSignals({ expect: {} }, noRel).appended, 0);
});

// --------------------------------------- reporting metric registry (RM-02.a)
section("eval metric registry (RM-02.a)");

const REGISTRY_QUERIES = {
  queries: [
    { id: "q1", ranked_ids: ["a", "b", "c"], relevant_ids: ["b"] },  // hit @2, miss @1
    { id: "q2", ranked_ids: ["x", "y"], relevant_ids: ["z"] },        // miss
    { id: "q3", ranked_ids: ["p"], relevant_ids: ["p"] },              // hit @1
  ],
};

test("recall_at_k on a hand-built result set (success@k)", () => {
  assert.strictEqual(computeMetric("recall_at_k", REGISTRY_QUERIES, null, { k: 5 }), 2 / 3);
  assert.strictEqual(computeMetric("recall_at_k", REGISTRY_QUERIES, null, { k: 2 }), 2 / 3);
  assert.strictEqual(computeMetric("recall_at_k", REGISTRY_QUERIES, null, { k: 1 }), 1 / 3);
  const expl = explainMetric("recall_at_k", REGISTRY_QUERIES, null, { k: 1 });
  assert.deepStrictEqual(expl.misses, ["q1", "q2"]);
  assert.strictEqual(expl.hits, 1);
});

test("recall_at_k skips unlabeled queries and defaults k=5", () => {
  const mixed = { queries: [
    { ranked_ids: ["a"], relevant_ids: ["a"] },
    { ranked_ids: ["b"], relevant_ids: [] },          // unlabeled
    { ranked_ids: ["c"] },                            // unlabeled
  ] };
  assert.strictEqual(computeMetric("recall_at_k", mixed, null), 1);
  assert.strictEqual(explainMetric("recall_at_k", mixed, null).n, 1);
});

test("mrr on a tiny known-ranked set", () => {
  // q1 hit @2 → 1/2; q2 miss → 0; q3 hit @1 → 1. MRR = 1.5/3 = 0.5
  assert.strictEqual(computeMetric("mrr", REGISTRY_QUERIES, null), 0.5);
  const expl = explainMetric("mrr", REGISTRY_QUERIES, null);
  assert.strictEqual(expl.n, 3);
  assert.strictEqual(expl.n_found, 2);
  assert.strictEqual(expl.n_missed, 1);
  assert.deepStrictEqual(expl.misses, ["q2"]);
  assert.strictEqual(expl.mean_rank, 1.5);          // (2+1)/2 over found
  assert.strictEqual(expl.median_rank, 1.5);
  assert.strictEqual(expl.byQuery[0].rank, 2);
  assert.strictEqual(expl.byQuery[0].reciprocal, 0.5);
  assert.strictEqual(expl.byQuery[1].rank, null);
  assert.strictEqual(expl.byQuery[2].rank, 1);
});

test("mrr skips unlabeled queries; miss contributes 0 not NaN", () => {
  const mixed = { queries: [
    { id: "hit", ranked_ids: ["a", "b"], relevant_ids: ["b"] },
    { id: "unlabeled", ranked_ids: ["x"], relevant_ids: [] },
    { id: "miss", ranked_ids: ["y"], relevant_ids: ["z"] },
  ] };
  assert.strictEqual(computeMetric("mrr", mixed, null), 0.25); // (0.5 + 0) / 2
  const expl = explainMetric("mrr", mixed, null);
  assert.strictEqual(expl.n, 2);
  assert.deepStrictEqual(expl.misses, ["miss"]);
});

test("mrr is registered alongside recall_at_k", () => {
  assert.ok(listMetrics().some((m) => m.name === "mrr"));
});

test("duplicate_rate on a known-labeled set", () => {
  const records = [{ text: "a1" }, { text: "a2" }, { text: "b1" }, { text: "c1" }];
  const corpus = { groups: { A: ["a1", "a2"], B: ["b1"], C: ["c1"] } };
  assert.strictEqual(computeMetric("duplicate_rate", { records }, corpus), 0.25);
  const expl = explainMetric("duplicate_rate", { records }, corpus);
  assert.strictEqual(expl.n, 4);
  assert.strictEqual(expl.gStar, 3);
  assert.strictEqual(expl.extras, 1);
  assert.strictEqual(expl.byGroup.A.extras, 1);
  assert.strictEqual(expl.byGroup.B.extras, 0);
});

test("duplicate_rate: collapsed exact pair is not redundant; unmatched is not either", () => {
  const collapsed = { records: [{ text: "same" }] };
  const coffee = { groups: { coffee: ["same", "same"] } };
  assert.strictEqual(computeMetric("duplicate_rate", collapsed, coffee), 0);
  const withMystery = { records: [{ text: "a1" }, { text: "mystery" }] };
  const labeled = { groups: { A: ["a1"] } };
  assert.strictEqual(computeMetric("duplicate_rate", withMystery, labeled), 0,
    "unmatched records count as their own singleton, not as extras");
  assert.strictEqual(computeMetric("duplicate_rate", { records: [] }, labeled), 0);
});

test("registering a new metric works; duplicate names throw", () => {
  register({ name: "rm02a_always_half", compute() { return 0.5; } });
  assert.strictEqual(computeMetric("rm02a_always_half", {}, {}), 0.5);
  assert.ok(listMetrics().some((m) => m.name === "rm02a_always_half"));
  assert.throws(() => register({ name: "rm02a_always_half", compute() { return 0; } }),
    /duplicate name/);
  assert.throws(() => register({ name: "nope" }), /compute/);
  register(makeRecallAtK(1));
  assert.strictEqual(computeMetric("recall@1", REGISTRY_QUERIES, null), 1 / 3);
});

test("parsePrimaryHits reads the cosine list and ignores Related:", () => {
  const out = "1. [id 12] I'm allergic to penicillin\n2. [id 7] I live in Texas\n\nRelated:\n- [id 99] junk";
  const hits = parsePrimaryHits(out);
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits[0].id, "12");
  assert.strictEqual(hits[1].id, "7");
});

test("duplicates corpus loads with all three RM-02 bands plus queries", () => {
  const { loadScenarios } = require("./eval/measure.js");
  const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "duplicates.jsonl"));
  assert.strictEqual(scenarios.length, 1);
  const s = scenarios[0];
  const bands = new Set(s.writes.map((w) => w.band));
  assert.ok(bands.has("hi") && bands.has("mid") && bands.has("control") && bands.has("exact"),
    "corpus covers hi / mid / control / exact");
  assert.ok(s.queries.length >= 8, "enough queries for recall@k");
  const gids = new Set(s.writes.map((w) => w.dup_group));
  for (const q of s.queries) {
    assert.ok(Array.isArray(q.relevant_groups) && q.relevant_groups.length, q.id + " needs relevant_groups");
    for (const g of q.relevant_groups) assert.ok(gids.has(g), q.id + " group " + g + " missing from writes");
  }
  const multi = [...gids].filter((g) => s.writes.filter((w) => w.dup_group === g).length > 1);
  assert.ok(multi.length >= 3, "several multi-member dup groups");
});

test("extraction_precision on a tiny hand-labeled set with a known answer", () => {
  const results = { cases: [
    { stored: [{ text: "I have a dog named Rex" }], refused: false },
    { stored: [{ text: "Samuel prefers concise answers" }], refused: false },
    { stored: [{ text: "I think you should know that I live in Texas" }], refused: false },
  ] };
  const corpus = { cases: [
    { gold_facts: ["I have a dog named Rex"], noise: [] },
    { gold_facts: ["Samuel prefers concise answers"], noise: ["I think you should know that"] },
    { gold_facts: ["I live in Texas"], noise: ["I think you should know that"] },
  ] };
  assert.strictEqual(computeMetric("extraction_precision", results, corpus), 2 / 3);
  const expl = explainMetric("extraction_precision", results, corpus);
  assert.strictEqual(expl.n_stored, 3);
  assert.strictEqual(expl.n_correct, 2);
  assert.strictEqual(expl.n_noise, 1);
  assert.strictEqual(expl.n_labeled, 3);
});

test("extraction_precision: a stored-noise item lowers precision", () => {
  const clean = { cases: [
    { stored: [{ text: "I have a dog named Rex" }], refused: false },
    { stored: [{ text: "My name is Samuel" }], refused: false },
  ] };
  const gold = { cases: [
    { gold_facts: ["I have a dog named Rex"], noise: [] },
    { gold_facts: ["My name is Samuel"], noise: [] },
  ] };
  assert.strictEqual(computeMetric("extraction_precision", clean, gold), 1);
  const withNoise = { cases: clean.cases.concat([
    { stored: [{ text: "make sure you remind me about the standup" }], refused: false },
  ]) };
  const goldNoise = { cases: gold.cases.concat([
    { gold_facts: ["The Friday standup is at 10am"], noise: ["make sure you"] },
  ]) };
  const lowered = computeMetric("extraction_precision", withNoise, goldNoise);
  assert.strictEqual(lowered, 2 / 3);
  assert.ok(lowered < 1, "noise in the store must drop precision");
});

test("extraction_precision: a refused-PII item counts correctly", () => {
  const refused = { cases: [
    { stored: [{ text: "My name is Samuel" }], refused: false },
    { stored: [], refused: true },
  ] };
  const corpus = { cases: [
    { gold_facts: ["My name is Samuel"], noise: [] },
    { gold_facts: [], noise: ["sk-abcdefghijklmnopqrstuvwxyz123456"], expect_refusal: true },
  ] };
  assert.strictEqual(computeMetric("extraction_precision", refused, corpus), 1,
    "a correct refusal stores nothing, so it does not dilute precision");
  const expl = explainMetric("extraction_precision", refused, corpus);
  assert.strictEqual(expl.n_pii, 1);
  assert.strictEqual(expl.n_pii_refused, 1);
  assert.strictEqual(expl.pii_refusal_rate, 1);
  assert.strictEqual(expl.n_stored, 1);

  const leaked = { cases: [
    { stored: [{ text: "My name is Samuel" }], refused: false },
    { stored: [{ text: "my API key is sk-abcdefghijklmnopqrstuvwxyz123456" }], refused: false },
  ] };
  assert.strictEqual(computeMetric("extraction_precision", leaked, corpus), 0.5,
    "storing PII is a false positive");
  const leakedExpl = explainMetric("extraction_precision", leaked, corpus);
  assert.strictEqual(leakedExpl.pii_refusal_rate, 0);
  assert.strictEqual(leakedExpl.n_pii_refused, 0);
});

test("extraction_precision is registered; unlabeled input does not crash", () => {
  assert.ok(listMetrics().some((m) => m.name === "extraction_precision"));
  assert.ok(listMetrics().some((m) => m.name === "extraction_recall"),
    "extraction_recall ships with 01.b as the anti-cheat for vacuous precision");
  assert.strictEqual(computeMetric("extraction_precision", { records: [{ text: "x" }] }, { groups: {} }), 0,
    "duplicates-shaped input has no gold_facts, so it is unlabeled");
  assert.strictEqual(computeMetric("extraction_recall", { records: [{ text: "x" }] }, { groups: {} }), 0);
  assert.strictEqual(computeMetric("recall_at_k", REGISTRY_QUERIES, null, { k: 5 }), 2 / 3);
  const records = [{ text: "a1" }, { text: "a2" }, { text: "b1" }, { text: "c1" }];
  const dupCorpus = { groups: { A: ["a1", "a2"], B: ["b1"], C: ["c1"] } };
  assert.strictEqual(computeMetric("duplicate_rate", { records }, dupCorpus), 0.25);
});

test("extraction_recall is the anti-cheat for vacuous precision", () => {
  const gold = { cases: [
    { gold_facts: ["Samuel prefers concise answers"], noise: ["I think you should know that"] },
    { gold_facts: ["I live in Texas"], noise: [] },
  ] };
  const perfect = { cases: [
    { stored: [{ text: "Samuel prefers concise answers" }] },
    { stored: [{ text: "I live in Texas" }] },
  ] };
  assert.strictEqual(computeMetric("extraction_recall", perfect, gold), 1);
  assert.strictEqual(computeMetric("extraction_precision", perfect, gold), 1);

  const missed = { cases: [
    { stored: [{ text: "Samuel prefers concise answers" }] },
    { stored: [] },
  ] };
  assert.strictEqual(computeMetric("extraction_recall", missed, gold), 0.5);
  assert.strictEqual(computeMetric("extraction_precision", missed, gold), 1,
    "storing only correct facts keeps precision at 1 even when a gold is dropped");

  const refusedAll = { cases: [{ stored: [], refused: true }, { stored: [], refused: true }] };
  assert.strictEqual(computeMetric("extraction_precision", refusedAll, gold), 1,
    "refuse-everything is vacuous precision 1.0");
  assert.strictEqual(computeMetric("extraction_recall", refusedAll, gold), 0,
    "…and extraction_recall craters, which is the point");
});

test("messy corpus loads; every write has gold_facts + noise labels", () => {
  const { loadScenarios } = require("./eval/measure.js");
  const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "messy.jsonl"));
  assert.strictEqual(scenarios.length, 1);
  const s = scenarios[0];
  assert.ok(s.writes.length >= 15, "enough writes to cover the Tier-0/1 shapes");
  assert.ok(s.queries.length >= 8, "enough queries for a later recall@5 A/B");
  const bands = new Set(s.writes.map((w) => w.band));
  for (const need of ["filler", "imperative", "multi", "pii", "control"]) {
    assert.ok(bands.has(need), "corpus missing band " + need);
  }
  assert.ok(bands.has("multi-nosplit"), "over-split trap (and also with a non-standalone half)");
  const writeIds = new Set(s.writes.map((w) => w.id));
  for (const w of s.writes) {
    assert.ok(Array.isArray(w.gold_facts), w.id + " needs gold_facts (empty array = refuse)");
    assert.ok(Array.isArray(w.noise), w.id + " needs noise (empty array = none)");
    if (w.band === "pii") {
      assert.ok(w.expect_refusal, w.id + " PII must expect_refusal");
      assert.strictEqual(w.gold_facts.length, 0, w.id + " PII gold is store-nothing");
    } else {
      assert.ok(w.gold_facts.length >= 1, w.id + " non-PII needs at least one gold fact");
    }
  }
  for (const q of s.queries) {
    assert.ok(Array.isArray(q.relevant_writes) && q.relevant_writes.length, q.id + " needs relevant_writes");
    for (const id of q.relevant_writes) {
      assert.ok(writeIds.has(id), q.id + " write " + id + " missing from writes");
    }
  }
  const pii = s.writes.filter((w) => w.expect_refusal);
  // Slack + Stripe live only in the MODERN_SECRET_TRUE_POSITIVES unit table, not
  // this data corpus: their contiguous fakes trip GitHub push protection, so the
  // corpus carries the shapes that don't (github_pat/ghp, AIza, hf_, JWT, PEM, …).
  assert.ok(pii.length >= 15, "01.b shapes plus the 2026 prefix widening");
});

test("messy-hard corpus loads; every write is a long blob with gold facts", () => {
  const { loadScenarios } = require("./eval/measure.js");
  const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "messy-hard.jsonl"));
  assert.strictEqual(scenarios.length, 1);
  const s = scenarios[0];
  assert.strictEqual(s.extract_match, "cover");
  assert.ok(s.writes.length >= 8, "enough hard cases");
  assert.ok(s.queries.length >= 12, "enough queries for recall@5");
  const writeIds = new Set(s.writes.map((w) => w.id));
  const bands = new Set(s.writes.map((w) => w.band));
  for (const need of ["implicit", "narrative", "coreference", "multi-and"]) {
    assert.ok(bands.has(need), "messy-hard missing band " + need);
  }
  for (const w of s.writes) {
    assert.ok(Array.isArray(w.gold_facts) && w.gold_facts.length >= 1, w.id + " needs gold");
    assert.ok(w.text.trim().split(/\s+/).length > COVER_MAX_WORDS,
      w.id + " blob must exceed COVER_MAX_WORDS so Tier 0 fails cover-match");
    assert.strictEqual(w.extract_match, "cover");
    assert.ok(!w.expect_refusal, w.id + " is not a PII case");
    // Tier 0 cannot emit these gold facts: no '; '/ 'and also' split, and
    // the gold string is not the blob.
    const prepared = prepareWrite(w.text);
    assert.ok(prepared.ok && prepared.facts.length === 1, w.id + " Tier 0 keeps one blob");
    assert.strictEqual(prepared.facts[0], w.text.replace(/\s+/g, " ").trim());
    for (const g of w.gold_facts) {
      assert.ok(!isCorrectStored(prepared.facts[0], [g], w.noise || [], "cover"),
        w.id + " Tier 0 blob must not cover gold " + JSON.stringify(g));
    }
  }
  for (const q of s.queries) {
    assert.ok(Array.isArray(q.relevant_writes) && q.relevant_writes.length, q.id);
    assert.ok(Array.isArray(q.relevant_facts) && q.relevant_facts.length, q.id);
    for (const id of q.relevant_writes) assert.ok(writeIds.has(id), q.id + " missing write " + id);
  }
});

test("messy corpus: current-save simulation is the pre-extraction baseline", () => {
  const { loadScenarios } = require("./eval/measure.js");
  const s = loadScenarios(path.join(__dirname, "eval", "corpora", "messy.jsonl"))[0];
  const results = { cases: s.writes.map((w) => ({
    id: w.id, stored: [{ text: w.text }], refused: false,
  })) };
  const expl = explainMetric("extraction_precision", results, { cases: s.writes });
  assert.strictEqual(expl.n_labeled, s.writes.length);
  assert.strictEqual(expl.n_stored, s.writes.length, "today save() stores one blob per write");
  // 5 controls + 1 should-not-split compound pass through as-is; filler,
  // imperative, to-split multi, and PII blobs are not gold. PII widening
  // adds refused writes only (empty gold), so n_correct stays 6 and the
  // denominator is the write count.
  assert.strictEqual(expl.n_correct, 6);
  assert.strictEqual(expl.rate, 6 / s.writes.length);
  assert.ok(s.writes.length > 23, "widened PII corpus is larger than the 01.a seed");
  assert.strictEqual(expl.n_pii, s.writes.filter((w) => w.expect_refusal).length);
  assert.strictEqual(expl.pii_refusal_rate, 0);
});

// ------------------------------------------------- S1 substrate generator (eval/substrate)
section("S1 substrate scale generator");

const {
  generateScaleCorpus, attachSyntheticEmbeddings, NEEDLES, DEFAULT_SEED, plantedCountFor,
} = require("./eval/substrate/generate.js");

test("generator produces well-formed labeled memories + needles with known relevance", () => {
  const corpus = generateScaleCorpus({ n: 250, seed: DEFAULT_SEED });
  assert.strictEqual(corpus.records.length, 250);
  assert.strictEqual(corpus.queries.length, NEEDLES.length);
  assert.ok(corpus.planted >= NEEDLES.length * 2, "each needle has at least one distractor");
  const texts = new Set();
  const needles = [];
  const distractors = [];
  for (const r of corpus.records) {
    assert.ok(r.id >= 1 && r.text && r.role, "record needs id/text/role");
    assert.ok(["needle", "distractor", "haystack"].includes(r.role), r.role);
    assert.ok(!texts.has(r.text.toLowerCase()), "duplicate text: " + r.text);
    texts.add(r.text.toLowerCase());
    if (r.role === "needle") {
      assert.ok(r.needleId);
      needles.push(r);
    }
    if (r.role === "distractor") {
      assert.ok(r.needleId && r.kind, "distractor needs needleId + kind");
      distractors.push(r);
    }
  }
  assert.strictEqual(needles.length, NEEDLES.length);
  assert.ok(distractors.length >= NEEDLES.length, "hard near-topic distractors planted");
  const byId = new Map(corpus.records.map((r) => [String(r.id), r]));
  for (const q of corpus.queries) {
    assert.ok(q.query && q.needleId && q.relevant_ids.length === 1, q.id);
    const rec = byId.get(String(q.relevant_ids[0]));
    assert.ok(rec && rec.role === "needle" && rec.needleId === q.needleId, q.id + " relevant is the needle");
    assert.strictEqual(rec.text, q.relevant_text);
  }
  const height = corpus.records.find((r) => /terrified of heights/i.test(r.text));
  assert.ok(height && height.role === "distractor" && height.needleId === "height-bookshelf",
    "adv-height-homonym is a planted distractor for the bookshelf needle");
});

test("generator is deterministic for a seed; larger N is a planted+haystack prefix", () => {
  const a = generateScaleCorpus({ n: 200, seed: 7 });
  const b = generateScaleCorpus({ n: 200, seed: 7 });
  assert.deepStrictEqual(a.records.map((r) => r.text), b.records.map((r) => r.text));
  const c = generateScaleCorpus({ n: 200, seed: 8 });
  assert.notDeepStrictEqual(a.records.map((r) => r.text), c.records.map((r) => r.text));
  const small = generateScaleCorpus({ n: 200, seed: 1 });
  const large = generateScaleCorpus({ n: 500, seed: 1 });
  assert.deepStrictEqual(
    small.records.map((r) => r.text),
    large.records.slice(0, 200).map((r) => r.text)
  );
  const plantedSmall = small.records.filter((r) => r.role !== "haystack");
  const plantedLarge = large.records.filter((r) => r.role !== "haystack");
  assert.deepStrictEqual(plantedSmall.map((r) => r.id + ":" + r.text), plantedLarge.map((r) => r.id + ":" + r.text));
});

test("generator rejects n below planted count and unknown needle ids", () => {
  const nNeed = plantedCountFor(NEEDLES);
  assert.throws(() => generateScaleCorpus({ n: nNeed - 1 }), /planted/);
  assert.throws(() => generateScaleCorpus({ n: 100, needleIds: ["no-such-needle"] }), /unknown needle/);
});

test("haystack does not restatement-collide with a needle's current first-person slot", () => {
  const corpus = generateScaleCorpus({ n: 2000, seed: DEFAULT_SEED });
  const hay = corpus.records.filter((r) => r.role === "haystack");
  assert.ok(hay.length > 100);
  for (const r of hay) {
    assert.ok(!/\bi work at\b/i.test(r.text), "haystack stole the job slot: " + r.text);
    assert.ok(!/\bi live in\b/i.test(r.text), "haystack stole the city slot: " + r.text);
    assert.ok(!/\bi(?:'m| am) allergic to\b/i.test(r.text), "haystack stole the allergy slot: " + r.text);
    assert.ok(!/terrified of heights/i.test(r.text));
    assert.ok(!/penicillin/i.test(r.text));
    assert.ok(!/globex/i.test(r.text));
  }
});

test("subset of 3 needles in n=100 is well-formed (S1 e2e fixture)", () => {
  const ids = ["allergy-penicillin", "height-bookshelf", "job-globex"];
  const corpus = generateScaleCorpus({ n: 100, seed: 1, needleIds: ids });
  assert.strictEqual(corpus.records.length, 100);
  assert.strictEqual(corpus.queries.length, 3);
  assert.strictEqual(corpus.records.filter((r) => r.role === "needle").length, 3);
  assert.ok(corpus.records.filter((r) => r.role === "distractor").length >= 9);
});

// ------------------------------------------------- RM-15 soak generator + metrics (0011 §7.3)
section("RM-15 soak generator + control metrics");

const soakGen = require("./eval/soak/generate.js");
const soakRun = require("./eval/soak/run.js");

test("soak generator is deterministic for a seed; larger n is a prefix", () => {
  const a = soakGen.generateSoakCorpus({ n: 120, seed: 7 });
  const b = soakGen.generateSoakCorpus({ n: 120, seed: 7 });
  assert.deepStrictEqual(
    a.events.map((e) => e.event + "\t" + (e.text || e.query || e.hours || "")),
    b.events.map((e) => e.event + "\t" + (e.text || e.query || e.hours || ""))
  );
  const c = soakGen.generateSoakCorpus({ n: 120, seed: 8 });
  assert.notDeepStrictEqual(
    a.events.map((e) => e.text || e.query || e.event),
    c.events.map((e) => e.text || e.query || e.event)
  );
  const small = soakGen.generateSoakCorpus({ n: 100, seed: 1 });
  const large = soakGen.generateSoakCorpus({ n: 400, seed: 1 });
  assert.deepStrictEqual(
    small.events.map((e) => e.event + "\t" + (e.text || e.query || "")),
    large.events.slice(0, 100).map((e) => e.event + "\t" + (e.text || e.query || ""))
  );
});

test("soak n=1000 emits every 0011 §7.3 event type, labeled at generation", () => {
  const corpus = soakGen.generateSoakCorpus({ n: 1000, seed: soakGen.DEFAULT_SEED });
  assert.strictEqual(corpus.events.length, 1000);
  const types = new Set(corpus.events.map((e) => e.event));
  for (const t of [
    "assert", "restate", "missed_dup", "correct", "episodic", "theme_assert",
    "near_miss", "recall", "accidental_recall", "hub_query", "time_skip", "dream",
  ]) {
    assert.ok(types.has(t), "missing event type " + t + " (have " + [...types].join(",") + ")");
  }
  const writes = corpus.events.filter((e) => e.role === "write");
  assert.ok(writes.length > 50, "distractor haystack should make writes a real store, got " + writes.length);
  for (const w of writes) {
    assert.ok(w.t && w.write_id && w.text, "write labeled with t/write_id/text");
    assert.strictEqual(w.gate, false);
  }
  const queries = corpus.events.filter((e) => e.role === "query");
  assert.ok(queries.length > 20, "recall/hub/accidental queries present");
  for (const q of queries) {
    assert.ok(q.query && q.query_kind, "query labeled with query_kind at generation");
  }
  const hubN = corpus.events.filter((e) => e.event === "hub_query").length;
  assert.ok(hubN >= 25 && hubN <= 35, "hub_query ~30x, got " + hubN);
  const dreams = corpus.events.filter((e) => e.event === "dream");
  assert.deepStrictEqual(dreams.map((d) => d.checkpoint).sort((a, b) => a - b), [250, 500, 1000]);
  assert.ok(corpus.must_not_merge.length >= 3, "near-miss pairs labeled");
  assert.ok(Object.keys(corpus.missed_dup_groups).length >= 2, "Op A missed_dup pairs planted");
  assert.ok(corpus.episodics.length >= 5, "I8 unique-token needles planted");
});

test("soak slots change over the timeline; haystack does not steal them", () => {
  const corpus = soakGen.generateSoakCorpus({ n: 1000, seed: soakGen.DEFAULT_SEED });
  const job = corpus.events.filter((e) => e.slot === "job" && (e.event === "assert" || e.event === "correct"));
  const values = job.map((e) => e.value);
  assert.ok(values.includes("Acme") && values.includes("Globex") && values.includes("Vireo Systems"),
    "job slot evolves: " + values.join(" -> "));
  const city = corpus.events.filter((e) => e.slot === "city" && (e.event === "assert" || e.event === "correct"));
  assert.ok(city.map((e) => e.value).includes("Denver") && city.map((e) => e.value).includes("Portland"));
  const hay = corpus.events.filter((e) => e.event === "haystack");
  assert.ok(hay.length > 100, "haystack volume for top-k crowding, got " + hay.length);
  for (const h of hay) {
    assert.ok(!soakGen.haystackBlocked(h.text), "haystack stole a reserved slot: " + h.text);
    assert.ok(!/quillan|vellichor|cinderwake|sapphire ukulele|amber metronome/i.test(h.text),
      "haystack ate an I8 needle token: " + h.text);
  }
});

test("soak events carry gate:false so the RM-00 golden cannot flip", () => {
  const corpus = soakGen.generateSoakCorpus({ n: 80, seed: 3 });
  const { isGoldenCase } = require("./eval/run.js");
  assert.strictEqual(isGoldenCase({
    id: "soak-rm15", kind: "soak", role: "meta", gate: false,
  }), false);
  for (const e of corpus.events) {
    assert.strictEqual(e.gate, false);
    assert.strictEqual(isGoldenCase(e), false, e.id + " must not be a golden case");
  }
});

test("staleness_rate math on a tiny labeled fixture", () => {
  const probes = {
    slot_probes: [
      { slot: "job", ranked_texts: ["Actually I work at Globex now"], ranked_ids: ["2"], current_value: "Globex", relevant_ids: ["2"] },
      { slot: "city", ranked_texts: ["I live in Austin"], ranked_ids: ["1"], current_value: "Denver", relevant_ids: ["9"] },
    ],
  };
  assert.strictEqual(computeMetric("staleness_rate", probes, null), 0.5);
  const expl = explainMetric("staleness_rate", probes, null);
  assert.strictEqual(expl.n, 2);
  assert.strictEqual(expl.n_stale, 1);
  assert.deepStrictEqual(expl.misses, ["city"]);
  assert.strictEqual(computeMetric("staleness_rate", { queries: [] }, null), null,
    "no probes → NA, not a fake 0");
});

test("needle_retention@k math: relevant is the source id", () => {
  const results = {
    queries: [
      { id: "n1", query_kind: "episodic", needle: true, ranked_ids: ["s1", "x"], relevant_ids: ["s1"] },
      { id: "n2", query_kind: "episodic", needle: true, ranked_ids: ["g1"], relevant_ids: ["s2"] },
      { query_kind: "slot", ranked_ids: ["s1"], relevant_ids: ["s1"] },
    ],
  };
  assert.strictEqual(computeMetric("needle_retention@k", results, null, { k: 5 }), 0.5);
  const expl = explainMetric("needle_retention@k", results, null, { k: 1 });
  assert.strictEqual(expl.n, 2, "slot query is not a needle");
  assert.deepStrictEqual(expl.misses, ["n2"]);
  assert.strictEqual(computeMetric("needle_retention@k", { queries: [] }, null), null);
});

test("false_merge_rate: must_not_merge pair sharing a survivor is 1", () => {
  const merged = {
    records: [
      { id: "1", text: "I have a peanut allergy" },
      { id: "2", text: "I love peanut butter on toast", superseded_by: "1", valid_to: "2026-02-01" },
    ],
  };
  const corpus = { must_not_merge: [["1", "2"]] };
  assert.strictEqual(computeMetric("false_merge_rate", merged, corpus), 1);
  const distinct = {
    records: [
      { id: "1", text: "I have a peanut allergy" },
      { id: "2", text: "I love peanut butter on toast" },
    ],
  };
  assert.strictEqual(computeMetric("false_merge_rate", distinct, corpus), 0);
  assert.strictEqual(computeMetric("false_merge_rate", { records: [] }, {}), null);
});

test("storage_ratio: current / asserts, or / control_n when given", () => {
  assert.strictEqual(computeMetric("storage_ratio", { n_current: 12, n_asserts: 10 }, null), 1.2);
  assert.strictEqual(computeMetric("storage_ratio", { n_current: 12, n_asserts: 10 }, null, { control_n: 10 }), 1.2);
  assert.strictEqual(computeMetric("storage_ratio", { n_current: 11, n_asserts: 20 }, null, { control_n: 10 }), 1.1);
  assert.strictEqual(computeMetric("storage_ratio", {}, null), null);
});

test("0011 §7.3 metric names are registered; dream-only ones are NA on an empty control result", () => {
  const names = listMetrics().map((m) => m.name);
  for (const n of [
    "staleness_rate", "needle_retention@k", "false_merge_rate", "storage_ratio",
    "gist_recall@k", "false_generalization_rate", "cluster_precision", "cluster_recall",
    "hub_contamination", "provenance_integrity", "grimoire_hit_rate", "grimoire_crowding",
    "cofire_rate", "near_miss_cofire", "duplicate_rate", "recall_at_k", "mrr",
  ]) {
    assert.ok(names.includes(n), "missing metric " + n);
  }
  const empty = {};
  assert.strictEqual(computeMetric("gist_recall@k", empty, null), null);
  assert.strictEqual(computeMetric("false_generalization_rate", empty, null), null);
  assert.strictEqual(computeMetric("cluster_precision", empty, null), null);
  assert.strictEqual(computeMetric("cluster_recall", empty, null), null);
  assert.strictEqual(computeMetric("hub_contamination", empty, null), null);
  assert.strictEqual(computeMetric("provenance_integrity", empty, null), null);
  assert.strictEqual(computeMetric("grimoire_hit_rate", empty, null), null);
  assert.strictEqual(computeMetric("grimoire_crowding", empty, null), null);
  assert.strictEqual(computeMetric("cofire_rate", empty, null), null);
  assert.strictEqual(computeMetric("near_miss_cofire", empty, null), null);
});

test("cluster_precision/recall Hungarian match at IoU ≥ 0.5", () => {
  const gold = [
    { id: "morning", members: ["a", "b", "c"] },
    { id: "climb", members: ["d", "e", "f"] },
  ];
  const perfect = { predicted_clusters: [
    { members: ["c", "a", "b"] },
    { members: ["f", "e", "d"] },
  ], gold_clusters: gold };
  assert.strictEqual(computeMetric("cluster_precision", perfect, null), 1);
  assert.strictEqual(computeMetric("cluster_recall", perfect, null), 1);
  const partial = { predicted_clusters: [
    { members: ["a", "b"] },
  ], gold_clusters: gold };
  // IoU( {a,b}, {a,b,c} ) = 2/3 ≥ 0.5 → 1 pred matched, 1/1 precision, 1/2 recall
  assert.strictEqual(computeMetric("cluster_precision", partial, null), 1);
  assert.strictEqual(computeMetric("cluster_recall", partial, null), 0.5);
});

test("recall_at_k explain splits by query_kind (reuse, not a forked scorer)", () => {
  const results = { queries: [
    { id: "s1", query_kind: "slot", ranked_ids: ["a"], relevant_ids: ["a"] },
    { id: "s2", query_kind: "slot", ranked_ids: ["x"], relevant_ids: ["b"] },
    { id: "e1", query_kind: "episodic", ranked_ids: ["n"], relevant_ids: ["n"] },
  ] };
  assert.strictEqual(computeMetric("recall_at_k", results, null), 2 / 3);
  const expl = explainMetric("recall_at_k", results, null);
  assert.strictEqual(expl.byKind.slot.rate, 0.5);
  assert.strictEqual(expl.byKind.episodic.rate, 1);
});

test("unimplemented soak arms error clearly; control is the only implemented arm", () => {
  assert.strictEqual(soakRun.parseArm(["--arm", "control"]), "control");
  assert.strictEqual(soakRun.parseArm(["--arm=crystal"]), "crystal");
  assert.strictEqual(soakRun.ARMS.control.implemented, true);
  for (const arm of ["redundancy", "nominate", "crystal", "grimoire-walk"]) {
    assert.strictEqual(soakRun.ARMS[arm].implemented, false);
    assert.ok(/not implemented until slice/.test(soakRun.UNIMPLEMENTED_MSG(arm)), arm);
  }
  assert.throws(() => soakRun.parseArm(["--arm", "nope"]), /unknown --arm/);
});

// ------------------------------------------------- RM-01.b write-side extraction
// Tier 0 (normalize/strip/split) + Tier 1 (PII refusal). Pure, so these
// assert against corpus gold without an embedder. save() wiring + embed
// counts live in asyncTests.

section("RM-01.b write-side extraction (Tier 0/1)");

test("filler: 'I think you should know that' strips to the inner proposition, not a half-opener", () => {
  const r = prepareWrite("I think you should know that Samuel prefers concise answers");
  assert.deepStrictEqual(r.facts, ["Samuel prefers concise answers"]);
  assert.ok(!/^you should know that/i.test(r.facts[0]),
    "0001's /^(i think )/ would leave 'You should know that…' — that is the bug");
});

test("filler: 'just so you're aware' strips to the inner proposition", () => {
  assert.deepStrictEqual(
    prepareWrite("just so you're aware, I usually code late at night").facts,
    ["I usually code late at night"]);
});

test("filler: 'just so you know' strips to the inner proposition", () => {
  assert.deepStrictEqual(
    prepareWrite("Just so you know, I prefer tea over coffee").facts,
    ["I prefer tea over coffee"]);
});

test("filler: 'It's worth noting that' strips to the inner proposition", () => {
  assert.deepStrictEqual(
    prepareWrite("It's worth noting that I'm allergic to penicillin").facts,
    ["I'm allergic to penicillin"]);
});

test("filler: FYI strips and recases the leftover", () => {
  assert.deepStrictEqual(
    prepareWrite("FYI, the Friday standup is at 10am").facts,
    ["The Friday standup is at 10am"]);
});

test("filler: stacked FYI + just so you know both come off", () => {
  assert.deepStrictEqual(
    prepareWrite("FYI, just so you know, I have a cat named Koneko").facts,
    ["I have a cat named Koneko"]);
});

test("imperative: 'remember to remind me' keeps the embedded fact", () => {
  assert.deepStrictEqual(
    prepareWrite("remember to remind me that my sister's birthday is March 3rd").facts,
    ["My sister's birthday is March 3rd"]);
});

test("imperative: 'make sure you' keeps the embedded fact", () => {
  assert.deepStrictEqual(
    prepareWrite("make sure you never give me peanuts").facts,
    ["Never give me peanuts"]);
});

test("imperative: 'Please remember that' keeps the embedded fact", () => {
  assert.deepStrictEqual(
    prepareWrite("Please remember that I have a peanut allergy").facts,
    ["I have a peanut allergy"]);
});

test("imperative: 'don't forget to' / 'be sure to' strip framing", () => {
  assert.deepStrictEqual(
    prepareWrite("don't forget to note that I live in Texas").facts,
    ["I live in Texas"]);
  assert.deepStrictEqual(
    prepareWrite("be sure to remember that I prefer tea over coffee").facts,
    ["I prefer tea over coffee"]);
});

test("imperative with no payload drops the write (empty gold)", () => {
  const r = prepareWrite("remember that");
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.facts, []);
});

test("multi: 'and also' splits only when both halves stand alone", () => {
  assert.deepStrictEqual(
    prepareWrite("I have a dog named Rex and also I work as a software architect, mostly on games").facts,
    ["I have a dog named Rex", "I work as a software architect, mostly on games"]);
});

test("multi: '; ' splits two standalone facts", () => {
  assert.deepStrictEqual(
    prepareWrite("My coffee order is an oat-milk cortado, no sugar; I live in Texas").facts,
    ["My coffee order is an oat-milk cortado, no sugar", "I live in Texas"]);
});

test("multi-nosplit: 'and also with honey' is NOT split", () => {
  const text = "I like tea more than coffee and also with honey";
  assert.strictEqual(isStandaloneFact("with honey"), false, "the second half is not a proposition");
  assert.deepStrictEqual(splitFacts(text), [text]);
  assert.deepStrictEqual(prepareWrite(text).facts, [text]);
});

test("PII shapes refuse: store nothing, return a refusal string", () => {
  const cases = [
    ["my API key is sk-abcdefghijklmnopqrstuvwxyz123456", "API key"],
    ["password: hunter2secret", "credential"],
    ["my card number is 4242424242424242", "card"],
    ["the AWS key is AKIAIOSFODNN7EXAMPLE", "AWS"],
    ["keep this -----BEGIN RSA PRIVATE KEY-----", "private key"],
    ["my GitHub token is ghp-abcdefghijklmnopqrstuvwx", "API key"],
  ];
  for (const [text, kind] of cases) {
    const r = prepareWrite(text);
    assert.strictEqual(r.ok, false, kind + " must refuse");
    assert.deepStrictEqual(r.facts, [], kind + " stores nothing");
    assert.ok(/not saved/i.test(r.message), kind + " message: " + r.message);
    assert.ok(/secrets don't belong/i.test(r.message), kind + " names the policy");
  }
});

test("PII mixed with a real fact is store-nothing, not redaction", () => {
  const r = prepareWrite("I live in Texas; my API key is sk-abcdefghijklmnopqrstuvwxyz123456");
  assert.strictEqual(r.ok, false, "contaminated write refuses the whole payload");
  assert.deepStrictEqual(r.facts, [], "must not salvage the Texas fact");
});

test("digit-trap controls survive the card guard (4821, 1500mg)", () => {
  assert.strictEqual(guardSecrets("The garage code is 4821").ok, true);
  assert.strictEqual(guardSecrets("I take 1500mg of metformin daily").ok, true);
  assert.deepStrictEqual(prepareWrite("The garage code is 4821").facts, ["The garage code is 4821"]);
  assert.deepStrictEqual(prepareWrite("I take 1500mg of metformin daily").facts,
    ["I take 1500mg of metformin daily"]);
});

/*
 * Synthetic tokens: prefix + charset + length of a real issued shape,
 * never a live credential. Each row fails without its pattern.
 */
const MODERN_SECRET_TRUE_POSITIVES = [
  ["my GitHub fine-grained PAT is github_pat_" + "a".repeat(22) + "_" + "b".repeat(59), "GitHub token"],
  ["my GitHub token is ghp_" + "a".repeat(36), "GitHub token"],
  ["OAuth token gho_" + "a".repeat(36), "GitHub token"],
  ["my OpenAI project key is sk-proj-abcdefghijklmnopqrstuvwxyz123456", "API key"],
  ["my Anthropic key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456", "API key"],
  // Prefixes split so no contiguous Slack token literal lives on disk (GitHub push
  // protection flags those even as fakes); the runtime string is identical, so the
  // guard is exercised exactly as if it were whole.
  ["slack bot xox" + "b-12345678901-1234567890123-" + "a".repeat(24), "API key"],
  ["slack app xa" + "pp-1-A01234567890-1234567890123-" + "a".repeat(24), "API key"],
  ["stripe secret sk_live_" + "a".repeat(24), "API key"],
  ["stripe restricted rk_live_" + "a".repeat(24), "API key"],
  ["stripe test sk_test_" + "a".repeat(24), "API key"],
  ["google api AIza" + "x".repeat(35), "API key"],
  ["huggingface hf_" + "a".repeat(37), "API key"],
  ["groq gsk_" + "a".repeat(32), "API key"],
  ["sts key ASIAIOSFODNN7EXAMPLE", "AWS"],
  ["keep this -----BEGIN OPENSSH PRIVATE KEY-----", "private key"],
  ["jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz012345", "token"],
  ["passphrase: correct-horse-battery-staple", "credential"],
  ["api_key=" + "a".repeat(24), "credential"],
  ["access_token=" + "b".repeat(24), "credential"],
];

const SECRET_PROSE_FALSE_POSITIVES = [
  "The garage code is 4821",
  "I take 1500mg of metformin daily",
  "The secret to the recipe is browning the butter",
  "My password manager is Bitwarden",
  "Remember my GitHub username is samgrim97",
  "The session token expired yesterday",
  "I keep my API keys in a local .env file",
  "I use a JWT library for the login flow",
  "My SSH public key is ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakePublicKeyMaterialNotASecret",
  "I set HF_HOME to D:\\models",
  "scikit-learn is the pipeline for this project",
  "The Stripe dashboard lives at dashboard.stripe.com",
  "our wifi passphrase is on the router sticker",
  "I rotate tokens every 90 days",
  "My Stripe publishable key is pk_live_" + "a".repeat(24),
  "API_KEY=nomic-embed-text-v1.5",
  "I renamed the branch ghp_experimentation_branch",
  "the short id is ghp_short",
  "I wrote down the wifi password on a sticky note, the secret is that it is the dog's name",
];

test("modern secret shapes refuse: prefix+length, store nothing", () => {
  for (const [text, kind] of MODERN_SECRET_TRUE_POSITIVES) {
    const g = guardSecrets(text);
    assert.strictEqual(g.ok, false, kind + " must refuse: " + text);
    const r = prepareWrite(text);
    assert.strictEqual(r.ok, false, kind + " prepareWrite must refuse");
    assert.deepStrictEqual(r.facts, [], kind + " stores nothing");
    assert.ok(/not saved/i.test(r.message), kind + " message: " + r.message);
    assert.ok(/secrets don't belong/i.test(r.message), kind + " names the policy");
  }
});

test("prose that mentions secrets still stores (false-positive canaries)", () => {
  for (const text of SECRET_PROSE_FALSE_POSITIVES) {
    const g = guardSecrets(text);
    assert.strictEqual(g.ok, true, "must store, not refuse: " + text);
    const r = prepareWrite(text);
    assert.strictEqual(r.ok, true, "prepareWrite must accept: " + text);
    assert.deepStrictEqual(r.facts, [text], "must persist the canary byte-identical: " + text);
  }
});

test("PII mixed with a modern secret is still store-nothing, not redaction", () => {
  const r = prepareWrite("I live in Texas; my GitHub PAT is github_pat_" + "a".repeat(22) + "_" + "b".repeat(59));
  assert.strictEqual(r.ok, false, "contaminated write refuses the whole payload");
  assert.deepStrictEqual(r.facts, [], "must not salvage the Texas fact");
});

test("clean control passes through byte-identical", () => {
  const clean = "My name is Samuel";
  const r = prepareWrite(clean);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.facts.length, 1);
  assert.strictEqual(r.facts[0], clean);
  assert.strictEqual(normalizeText(clean), clean);
});

test("whitespace collapse is the only transform on a clean fact", () => {
  assert.deepStrictEqual(
    prepareWrite("  I'm diabetic - no sugary recipes  ").facts,
    ["I'm diabetic - no sugary recipes"]);
});

test("0001's short 'I think ' opener is NOT used (would half-strip the gold case)", () => {
  // A genuine leading "I think " without the longer phrase stays put.
  // The corpus gold is the LONG opener; stripping "I think " alone is the bug.
  const kept = prepareWrite("I think Samuel likes dogs named Rex");
  assert.ok(kept.facts[0].toLowerCase().startsWith("i think "),
    "short 'I think ' must not fire; got " + kept.facts[0]);
});

// ------------------------------------------------- RM-01.c Tier 2 (pure)
section("RM-01.c Tier 2 extraction (pure, no network)");

const {
  parseExtractJson, sanityCheckExtract, acceptExtract, pickChatModel,
  isEmbeddingModel, clientSupportsSampling, readExtractEnabled,
  chatCompletionsUrl, modelsUrl, EXTRACT_MAX_FACTS,
} = require("./extract.js");

test("parseExtractJson: minified object, fenced, think-stripped", () => {
  assert.deepStrictEqual(
    parseExtractJson('{"facts":["I have a dog named Rex"],"skip":false}'),
    { facts: ["I have a dog named Rex"], skip: false }
  );
  assert.deepStrictEqual(
    parseExtractJson("```json\n{\"facts\":[\"A\"],\"skip\":false}\n```"),
    { facts: ["A"], skip: false }
  );
  assert.deepStrictEqual(
    parseExtractJson("<think>planning</think>{\"facts\":[\"B\"],\"skip\":false}"),
    { facts: ["B"], skip: false }
  );
  assert.throws(() => parseExtractJson("not json at all"), /no JSON|malformed/);
  assert.throws(() => parseExtractJson("{\"facts\":\"nope\"}"), /facts is not an array/);
});

test("sanityCheckExtract rejects skip, empty, too many, too long, prompt echo", () => {
  const src = "short source text";
  assert.strictEqual(sanityCheckExtract({ facts: ["ok fact here"], skip: false }, src).ok, true);
  assert.strictEqual(sanityCheckExtract({ facts: [], skip: true }, src).ok, false);
  assert.strictEqual(sanityCheckExtract({ facts: [], skip: false }, src).ok, false);
  const many = [];
  for (let i = 0; i < EXTRACT_MAX_FACTS + 1; i++) many.push("fact number " + i);
  assert.strictEqual(sanityCheckExtract({ facts: many, skip: false }, src).reason, "too-many");
  assert.strictEqual(sanityCheckExtract({
    facts: ["this extracted fact is way longer than the source by a large margin xx"],
    skip: false,
  }, src).reason, "too-long");
  const longSrc = "I have a dog named Rex and I live in Texas now as of last spring really";
  assert.strictEqual(sanityCheckExtract({
    facts: ["Extract durable facts"],
    skip: false,
  }, longSrc).reason, "prompt-echo");
});

test("acceptExtract: garbage degrades to null (keep Tier 0)", () => {
  const src = "I have a dog named Rex and I live in Texas now as of last spring";
  assert.deepStrictEqual(
    acceptExtract({ facts: ["I have a dog named Rex"], skip: false }, src),
    ["I have a dog named Rex"]
  );
  assert.strictEqual(acceptExtract({ facts: [], skip: true }, src), null);
  assert.strictEqual(acceptExtract("hello", src), null);
  assert.strictEqual(acceptExtract({ facts: "nope" }, src), null);
  assert.strictEqual(acceptExtract(null, src), null);
  assert.strictEqual(acceptExtract({ facts: [1, 2] }, src), null);
});

test("pickChatModel skips embedding ids; sampling capability is the initialize flag", () => {
  assert.ok(isEmbeddingModel("text-embedding-nomic-embed-text-v1.5"));
  assert.ok(!isEmbeddingModel("qwen3.6-35b-a3b"));
  const body = { data: [
    { id: "text-embedding-nomic-embed-text-v1.5" },
    { id: "openai/gpt-oss-20b" },
    { id: "qwen3.8-27b" },
  ] };
  assert.strictEqual(pickChatModel(body), "openai/gpt-oss-20b");
  assert.strictEqual(pickChatModel(body, "qwen3.8-27b"), "qwen3.8-27b");
  assert.strictEqual(pickChatModel({ data: [{ id: "text-embedding-nomic-embed-text-v1.5" }] }), null);
  assert.ok(clientSupportsSampling({ capabilities: { sampling: {} } }));
  assert.ok(!clientSupportsSampling({ capabilities: { tools: {} } }));
  assert.ok(!clientSupportsSampling(null));
});

test("readExtractEnabled: live-config wins over env, default off", () => {
  const prev = process.env.RESONANCE_EXTRACT_LLM;
  try {
    delete process.env.RESONANCE_EXTRACT_LLM;
    assert.strictEqual(readExtractEnabled(null), false, "off by default");
    assert.strictEqual(readExtractEnabled({ extract_llm: true }), true);
    process.env.RESONANCE_EXTRACT_LLM = "1";
    assert.strictEqual(readExtractEnabled(null), true, "env when no config");
    assert.strictEqual(readExtractEnabled({ extract_llm: false }), false, "config wins");
  } finally {
    if (prev === undefined) delete process.env.RESONANCE_EXTRACT_LLM;
    else process.env.RESONANCE_EXTRACT_LLM = prev;
  }
});

test("chat URL is derived from the embed endpoint, not a second config", () => {
  assert.strictEqual(
    chatCompletionsUrl("http://localhost:1234/v1/embeddings"),
    "http://localhost:1234/v1/chat/completions"
  );
  assert.strictEqual(modelsUrl("http://localhost:1234/v1/embeddings"), "http://localhost:1234/v1/models");
});

test("cover-match: a short paraphrase hits gold; a long blob does not", () => {
  const gold = ["I have a thyroid condition"];
  assert.ok(isCorrectStored("I have a thyroid condition", gold, [], "cover"));
  assert.ok(isCorrectStored("The user has a thyroid condition", gold, [], "cover"));
  const blob = "Stopped by the clinic after work and had a great chat with Dr. Chen about my thyroid. She wants me back in 3 months and said to keep taking the same dose until then. Felt better just having a plan.";
  assert.ok(blob.trim().split(/\s+/).length > COVER_MAX_WORDS, "fixture blob must exceed the atomic-length gate");
  assert.ok(!isCorrectStored(blob, gold, [], "cover"), "Tier 0 blob is not an extracted fact");
  assert.ok(!isCorrectStored("The user has a thyroid condition", gold, [], "exact"),
    "exact match (messy.jsonl) still rejects paraphrase");
});

// ------------------------------------------------- warm field (Phase 1 / PR1)
// Tests construct WarmField DIRECTLY. Pre-declared Phase 1 metrics from the
// warm-field design: A→B raises E, stronger sim → higher E, thisTurn-only
// spread, 1-hop bound, split clocks, restart-empty, forget, I7 disk-scan.
section("warm field (Phase 1)");

const {
  WarmField, shouldSpread, vectorCount, emitWarmTrace,
} = require("./warm.js");
const {
  createCore, defaultGetEdges, cosine: coreCosine,
  bindSaveTimeNeighbors, SAVE_TIME_K, SAVE_TIME_MIN_COS, FIELD_MINSIM,
  DEDUP_HI, DEDUP_LO, readDedupThresholds,
  dedupExisting,
} = require("./memory-core.js");

const LAMBDA_TURN = 0.357;
const turnDecay = (e, turns) => e * Math.exp(-LAMBDA_TURN * turns);

function chainEdges(pairs) {
  const m = new Map();
  for (const [a, b, sim] of pairs) {
    if (!m.has(a)) m.set(a, []);
    m.get(a).push({ id: b, sim });
  }
  return m;
}

test("A activating raises B through A↔B", () => {
  const W = new WarmField();
  W.seed(["A"]);
  assert.strictEqual(W.get("B"), 0, "B is cold before spread");
  W.spread(chainEdges([["A", "B", 0.8]]));
  assert.ok(W.get("B") > 0, "B received energy through A↔B");
  assert.ok(Math.abs(W.get("B") - 0.8) < 1e-12, "E_B = E_A * sim");
});

test("stronger sim yields higher E_B (max-not-sum contract)", () => {
  const strong = new WarmField();
  const weak = new WarmField();
  strong.seed(["A"]);
  weak.seed(["A"]);
  strong.spread(chainEdges([["A", "B", 0.9]]));
  weak.spread(chainEdges([["A", "B", 0.6]]));
  assert.ok(strong.get("B") > weak.get("B"), "0.9 sim transmits more than 0.6");

  // max, not sum: a second weaker incoming must not add
  strong.seed(["A"]);
  strong.spread(chainEdges([["A", "B", 0.5]]));
  assert.ok(Math.abs(strong.get("B") - 0.9) < 1e-12, "max keeps 0.9, does not sum to 1.4");
});

test("spread iterates thisTurn only; a previously-warm node does not re-spread", () => {
  const W = new WarmField();
  const edges = chainEdges([
    ["A", "B", 0.9],
    ["B", "C", 0.9],
    ["X", "Z", 0.9],
  ]);
  W.seed(["A"]);
  W.spread(edges);                       // B warms; C does not (1-hop)
  const eB = W.get("B");
  assert.ok(eB > 0);
  W.decayAll({ turns: 1 });
  const eBDecayed = W.get("B");
  assert.ok(eBDecayed < eB);
  W.seed(["X"]);                         // thisTurn = {X} only; A is warm but not re-seeded
  W.spread(edges);                       // must NOT re-spread from A (which would refresh B)
  assert.ok(Math.abs(W.get("B") - eBDecayed) < 1e-12, "B held its decayed value; A did not re-spread");
  assert.ok(W.get("Z") > 0, "X's neighbor DID warm");
});

test("value === 1.0 is not the seed test (sim=1.0 neighbor does not re-spread)", () => {
  const W = new WarmField();
  // A seeds at 1.0, B receives sim=1.0 so B.value === 1.0. If spread used
  // value===1.0 as the seed test, B would then warm C in the same tick.
  W.seed(["A"]);
  W.spread(chainEdges([["A", "B", 1.0], ["B", "C", 1.0]]));
  assert.strictEqual(W.get("B"), 1.0);
  assert.strictEqual(W.get("C"), 0, "C stayed cold: B was not a thisTurn source");
});

test("hops=1 does not warm a 2-hop neighbor", () => {
  const W = new WarmField({ hops: 1 });
  W.seed(["A"]);
  W.spread(chainEdges([["A", "B", 0.9], ["B", "C", 0.9]]));
  assert.ok(W.get("B") > 0, "1-hop B warms");
  assert.strictEqual(W.get("C"), 0, "2-hop C stays cold at hops=1");
});

test("decayAll({ turns: 1 }) is λ_turn, not wall-clock seconds", () => {
  let t = 1_000_000;
  const W = new WarmField({ now: () => t, lambdaTurn: LAMBDA_TURN, lambdaWall: 0 });
  W.seed(["A"], 1.0);
  t += 5000;                             // 5s wall pause
  W.decayAll({ turns: 1 });
  const got = W.get("A");
  const expected = turnDecay(1.0, 1);    // ≈ 0.700
  assert.ok(Math.abs(got - expected) < 1e-10, "E * exp(-λ_turn), got " + got);
  assert.ok(got > 0.6, "5s wall pause with λ_wall=0 must not dump energy (~0.12 would mean seconds fed into λ_turn)");
});

test("λ_wall=0: a 5s pause does not dump energy even across two decays", () => {
  let t = 0;
  const W = new WarmField({ now: () => t, lambdaWall: 0 });
  W.seed(["A"], 1.0);
  t += 5000;
  W.decayAll({ turns: 1 });
  t += 5000;
  W.decayAll({ turns: 1 });
  const expected = turnDecay(1.0, 2);
  assert.ok(Math.abs(W.get("A") - expected) < 1e-10);
});

test("below floor ⇒ dropped", () => {
  const W = new WarmField({ floor: 0.1, lambdaTurn: 10 });
  W.seed(["A"], 0.12);
  W.decayAll({ turns: 1 });              // 0.12 * exp(-10) << 0.1
  assert.strictEqual(W.get("A"), 0);
});

test("idle TTL clears the map", () => {
  let t = 0;
  const W = new WarmField({ now: () => t, idleMs: 1000 });
  W.seed(["A"], 1.0);
  t = 1001;
  W.decayAll({ turns: 1 });
  assert.strictEqual(W.get("A"), 0, "idle TTL wiped the session");
  assert.strictEqual(W.thisTurn.size, 0);
});

test("a new WarmField() is empty (restart)", () => {
  const live = new WarmField();
  live.seed(["A"]);
  live.spread(chainEdges([["A", "B", 0.9]]));
  assert.ok(live.get("A") > 0 && live.get("B") > 0);
  const restarted = new WarmField();
  assert.strictEqual(restarted.get("A"), 0);
  assert.strictEqual(restarted.get("B"), 0);
  assert.strictEqual(restarted.nodes.size, 0);
});

test("forget drops a node so it cannot resurrect", () => {
  const W = new WarmField();
  W.seed(["A", "B"]);
  W.forget("A");
  assert.strictEqual(W.get("A"), 0);
  assert.ok(W.get("B") > 0);
  assert.ok(!W.thisTurn.has("A"));
});

test("cap evicts lowest-E first", () => {
  const W = new WarmField({ cap: 2 });
  W.nodes.set("low", { value: 0.2, ts: 1 });
  W.nodes.set("mid", { value: 0.5, ts: 1 });
  W.nodes.set("high", { value: 0.9, ts: 1 });
  W._evictCap();
  assert.strictEqual(W.nodes.size, 2);
  assert.strictEqual(W.get("low"), 0);
  assert.ok(W.get("mid") > 0 && W.get("high") > 0);
});

test("trace(id) is callable and matches get(id)", () => {
  const W = new WarmField();
  W.seed(["A"], 1.0);
  assert.strictEqual(W.trace("A"), 1.0);
  assert.strictEqual(W.trace("missing"), 0);
  assert.strictEqual(W.trace("A"), W.get("A"));
});

test("defaultGetEdges ALWAYS returns a Map, never null", () => {
  const empty = defaultGetEdges([], null);
  assert.ok(empty instanceof Map, "empty store");
  const noVec = defaultGetEdges([{ id: 1, text: "x" }], null);
  assert.ok(noVec instanceof Map, "vectorless records still a Map");
  const withVec = defaultGetEdges([
    { id: 1, text: "a", embedding: [1, 0] },
    { id: 2, text: "b", embedding: [0, 1] },
  ], null);
  assert.ok(withVec instanceof Map);
});

test("WARM_EDGE_CAP gates shouldSpread only (512 default; 0 is a real cap)", () => {
  const many = Array.from({ length: 513 }, (_, i) => ({ id: i, embedding: [1] }));
  assert.strictEqual(shouldSpread(many, 512), false);
  assert.strictEqual(shouldSpread(many.slice(0, 512), 512), true);
  assert.strictEqual(shouldSpread([{ id: 1, embedding: [1] }], 0), false, "cap 0 skips spread");
  assert.strictEqual(vectorCount([{ id: 1 }, { id: 2, embedding: [1] }]), 1);
});

test("emitWarmTrace is callable and does not throw (hot path is `if (warmTrace())`)", () => {
  // The helper itself stringifies; the hot-path contract is `if (warmTrace()) emit…`
  // so a false flag is one boolean and no stringify. Don't print into the test run.
  const W = new WarmField();
  W.seed(["A"]);
  const orig = process.stderr.write;
  const writes = [];
  process.stderr.write = (s) => { writes.push(String(s)); return true; };
  try {
    emitWarmTrace(W, { query: "x", primary: ["A"] });
    emitWarmTrace(null, { query: "x", primary: [] });
  } finally {
    process.stderr.write = orig;
  }
  assert.ok(writes.some((s) => s.indexOf("[warm-trace]") === 0));
  assert.ok(writes.some((s) => /"activation"/.test(s)), "activation is its own field");
});

// ------------------------------------------------ RM-11 cross-platform SEA (helpers only; no 90MB inject)
section("RM-11 cross-platform SEA build helpers");

const buildExe = require("./build-exe.js");

test("require(build-exe.js) does not launch the SEA pipeline", () => {
  // The failure signature: top-level work at load time used to start esbuild
  // the moment test.js required the file. main() must stay behind require.main.
  assert.strictEqual(typeof buildExe.main, "function");
  assert.strictEqual(typeof buildExe.flipPeSubsystem, "function");
});

test("artifact names: Windows keeps .exe; Linux/macOS carry OS + arch", () => {
  assert.strictEqual(buildExe.artifactName("win", "x64"), "resonance-memory.exe");
  assert.strictEqual(buildExe.artifactName("win", "arm64"), "resonance-memory.exe");
  assert.strictEqual(buildExe.artifactName("linux", "x64"), "resonance-memory-linux-x64");
  assert.strictEqual(buildExe.artifactName("linux", "x86_64"), "resonance-memory-linux-x64");
  assert.strictEqual(buildExe.artifactName("linux", "arm64"), "resonance-memory-linux-arm64");
  assert.strictEqual(buildExe.artifactName("macos", "arm64"), "resonance-memory-macos-arm64");
  assert.strictEqual(buildExe.artifactName("macos", "x64"), "resonance-memory-macos-x64");
  assert.strictEqual(buildExe.artifactName("macos", "aarch64"), "resonance-memory-macos-arm64");
});

test("--target aliases: win32/windows, darwin/mac/osx", () => {
  assert.strictEqual(buildExe.parseArgs(["--target", "linux"]).target, "linux");
  assert.strictEqual(buildExe.parseArgs(["--target=macos"]).target, "macos");
  assert.strictEqual(buildExe.parseArgs(["--target", "win32"]).target, "win");
  assert.strictEqual(buildExe.parseArgs(["--target", "windows"]).target, "win");
  assert.strictEqual(buildExe.parseArgs(["--target", "darwin"]).target, "macos");
  assert.strictEqual(buildExe.parseArgs(["--target", "mac"]).target, "macos");
  assert.strictEqual(buildExe.parseArgs(["--target", "osx"]).target, "macos");
  assert.strictEqual(buildExe.parseArgs([]).target, null);
  assert.ok(buildExe.parseArgs(["--help"]).help);
  assert.ok(buildExe.parseArgs(["--print-plan"]).printPlan);
});

test("unknown --target and unknown flags fail closed", () => {
  assert.throws(() => buildExe.parseArgs(["--target", "freebsd"]), /unknown --target/);
  assert.throws(() => buildExe.parseArgs(["--target"]), /needs a value/);
  assert.throws(() => buildExe.parseArgs(["--nope"]), /unknown argument/);
});

test("failure: --target for another OS is a cross-compile refusal, not a silent Windows binary", () => {
  assert.doesNotThrow(() => buildExe.assertCanBuild("linux", "linux"));
  assert.doesNotThrow(() => buildExe.assertCanBuild("win", "win32"));
  assert.doesNotThrow(() => buildExe.assertCanBuild("macos", "darwin"));
  assert.throws(() => buildExe.assertCanBuild("linux", "win32"), /cannot cross-compile/);
  assert.throws(() => buildExe.assertCanBuild("macos", "linux"), /cannot cross-compile/);
  assert.throws(() => buildExe.assertCanBuild("win", "darwin"), /cannot cross-compile/);
});

test("postject: macho segment only on macOS (Linux/Windows must not pass it)", () => {
  const blob = "sea-prep.blob";
  const linux = buildExe.postjectArgs("out", blob, buildExe.TARGETS.linux);
  const win = buildExe.postjectArgs("out.exe", blob, buildExe.TARGETS.win);
  const mac = buildExe.postjectArgs("out", blob, buildExe.TARGETS.macos);
  assert.ok(!linux.includes("--macho-segment-name"), "Linux ELF has no Mach-O segment");
  assert.ok(!win.includes("--macho-segment-name"), "PE has no Mach-O segment");
  assert.ok(mac.includes("--macho-segment-name") && mac.includes("NODE_SEA"));
  assert.ok(linux.includes(buildExe.FUSE));
});

test("failure: PE flip is a no-op on ELF (must not corrupt a Linux binary)", () => {
  const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(200, 1)]);
  const before = Buffer.from(elf);
  const r = buildExe.flipPeSubsystem(elf);
  assert.strictEqual(r.flipped, false);
  assert.strictEqual(r.reason, "not-pe");
  assert.ok(elf.equals(before), "ELF bytes must be byte-identical after a refused flip");
});

test("PE flip: console(3) -> GUI(2) on a fake PE; already-GUI is a no-op", () => {
  function fakePe(subsystem) {
    const peOff = 64;
    const buf = Buffer.alloc(peOff + 94, 0);
    buf[0] = 0x4d; buf[1] = 0x5a;
    buf.writeUInt32LE(peOff, 0x3c);
    buf.write("PE\0\0", peOff, "ascii");
    buf.writeUInt16LE(subsystem, peOff + 92);
    return buf;
  }
  const consolePe = fakePe(3);
  const flipped = buildExe.flipPeSubsystem(consolePe);
  assert.strictEqual(flipped.flipped, true);
  assert.strictEqual(consolePe.readUInt16LE(64 + 92), 2);

  const guiPe = fakePe(2);
  const again = buildExe.flipPeSubsystem(guiPe);
  assert.strictEqual(again.flipped, false);
  assert.strictEqual(again.reason, "subsystem-2");
  assert.strictEqual(guiPe.readUInt16LE(64 + 92), 2);
});

test("PE flip: truncated / missing PE signature refuses without throwing", () => {
  assert.strictEqual(buildExe.flipPeSubsystem(Buffer.alloc(8)).reason, "too-small");
  const mzOnly = Buffer.alloc(128, 0);
  mzOnly[0] = 0x4d; mzOnly[1] = 0x5a;
  mzOnly.writeUInt32LE(2000, 0x3c); // e_lfanew past EOF
  assert.strictEqual(buildExe.flipPeSubsystem(mzOnly).reason, "truncated");
});

test("Node floor: 22.5 is the SqliteStore line; 22.4 and 18 fail", () => {
  assert.ok(buildExe.nodeMeetsFloor("22.5.0"));
  assert.ok(buildExe.nodeMeetsFloor("v22.23.1"));
  assert.ok(buildExe.nodeMeetsFloor("24.18.0"));
  assert.ok(buildExe.nodeMeetsFloor("v23.0.0"));
  assert.ok(!buildExe.nodeMeetsFloor("22.4.1"));
  assert.ok(!buildExe.nodeMeetsFloor("18.20.0"));
  assert.ok(!buildExe.nodeMeetsFloor("v16.20.2"));
});

test("sea-config.json uses relative paths (no Windows drive letters, no backslashes)", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "sea-config.json"), "utf8"));
  assert.ok(cfg.main && cfg.output, "SEA config must name main + output");
  for (const p of [cfg.main, cfg.output]) {
    assert.ok(!/^[A-Za-z]:/.test(p), p + " looks like a Windows absolute path");
    assert.ok(!p.includes("\\"), p + " uses backslashes — would break a POSIX SEA build");
  }
});

test("dist README names the just-built artifact and does not claim signing", () => {
  const text = buildExe.distReadmeText({
    spec: buildExe.TARGETS.linux,
    artifact: "resonance-memory-linux-x64",
    nodeVersion: "v22.23.1",
    arch: "x64",
    files: ["resonance-memory.exe", "resonance-memory-linux-x64"],
  });
  assert.ok(text.includes("resonance-memory-linux-x64    <-- just built"));
  assert.ok(text.includes("resonance-memory.exe"));
  assert.ok(/unsigned|SmartScreen|Gatekeeper|chmod \+x/i.test(text));
  assert.ok(!/notariz/i.test(text) || /future item/i.test(text));
});

test("hostTargetId maps process.platform to --target ids", () => {
  assert.strictEqual(buildExe.hostTargetId("win32"), "win");
  assert.strictEqual(buildExe.hostTargetId("linux"), "linux");
  assert.strictEqual(buildExe.hostTargetId("darwin"), "macos");
  assert.strictEqual(buildExe.hostTargetId("freebsd"), null);
});

// ------------------------------------------------ RM-11 release CI (helpers; no 90MB inject)
section("RM-11 release CI helpers");

const smokeExe = require("./ci/smoke-exe.js");
const releaseMeta = require("./ci/release-meta.js");

test("require(ci/smoke-exe.js) does not spawn a server", () => {
  assert.strictEqual(typeof smokeExe.smoke, "function");
  assert.strictEqual(typeof smokeExe.assertSmoke, "function");
  assert.deepStrictEqual(smokeExe.EXPECTED_TOOLS.slice().sort(), [
    "delete_memory", "edit_memory", "recall_memory", "save_memory",
  ]);
});

test("assertSmoke: initialize name + exactly the four verbs", () => {
  const init = {
    jsonrpc: "2.0", id: 1, result: {
      serverInfo: { name: "resonance-memory", version: "0.2.0" },
    },
  };
  const list = {
    jsonrpc: "2.0", id: 2, result: {
      tools: [
        { name: "save_memory" }, { name: "recall_memory" },
        { name: "edit_memory" }, { name: "delete_memory" },
      ],
    },
  };
  const ok = smokeExe.assertSmoke([init, list], { expectedVersion: "0.2.0" });
  assert.strictEqual(ok.serverInfo.name, "resonance-memory");
  assert.strictEqual(ok.tools.length, 4);
});

test("failure: missing initialize, wrong name, fifth verb, missing verb", () => {
  const listFour = {
    jsonrpc: "2.0", id: 2, result: {
      tools: [
        { name: "save_memory" }, { name: "recall_memory" },
        { name: "edit_memory" }, { name: "delete_memory" },
      ],
    },
  };
  assert.throws(() => smokeExe.assertSmoke([listFour]), /no initialize/);
  assert.throws(() => smokeExe.assertSmoke([
    { jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "not-rm" } } },
    listFour,
  ]), /serverInfo\.name/);
  const five = JSON.parse(JSON.stringify(listFour));
  five.result.tools.push({ name: "search_memory" });
  assert.throws(() => smokeExe.assertSmoke([
    { jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "resonance-memory" } } },
    five,
  ]), /four verbs/);
  const three = JSON.parse(JSON.stringify(listFour));
  three.result.tools = three.result.tools.filter((t) => t.name !== "delete_memory");
  assert.throws(() => smokeExe.assertSmoke([
    { jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "resonance-memory" } } },
    three,
  ]), /four verbs/);
});

test("parseJsonRpcLines: \\n and \\r\\n; ignores a partial last line", () => {
  const a = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  const b = JSON.stringify({ jsonrpc: "2.0", id: 2, result: { ok: true } });
  const msgs = smokeExe.parseJsonRpcLines(a + "\r\n" + b + "\n{\"jsonrpc\":");
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].id, 1);
  assert.strictEqual(msgs[1].id, 2);
});

test("tag policy: v0.2.0 and v0.2.0-rc1 match package 0.2.0; dirty version fails", () => {
  const rel = releaseMeta.assertTagMatchesPackage("v0.2.0", "0.2.0");
  assert.strictEqual(rel.prerelease, false);
  assert.strictEqual(rel.core, "0.2.0");
  const rc = releaseMeta.assertTagMatchesPackage("v0.2.0-rc1", "0.2.0");
  assert.strictEqual(rc.prerelease, true);
  assert.strictEqual(rc.prereleaseId, "rc1");
  const dotted = releaseMeta.assertTagMatchesPackage("v0.2.0-rc.1", "0.2.0");
  assert.strictEqual(dotted.prerelease, true);
  assert.throws(() => releaseMeta.assertTagMatchesPackage("v0.3.0", "0.2.0"), /package.json is 0.2.0/);
  assert.throws(() => releaseMeta.assertTagMatchesPackage("0.2.0", "0.2.0"), /must start with v/);
  assert.throws(() => releaseMeta.assertTagMatchesPackage("v0.2", "0.2.0"), /not v<semver>/);
  assert.throws(() => releaseMeta.assertTagMatchesPackage("v0.2.0-rc1", "0.2.0-rc2"), /must match exactly/);
  const exactPre = releaseMeta.assertTagMatchesPackage("v0.2.0-rc1", "0.2.0-rc1");
  assert.strictEqual(exactPre.prerelease, true);
  assert.strictEqual(exactPre.version, "0.2.0-rc1");
});

test("check-tag stdout is GITHUB_OUTPUT (version= / prerelease=)", () => {
  const io = releaseMeta.checkTagToGithubOutput("v0.2.0-rc1", "0.2.0");
  assert.ok(io.stdout.indexOf("version=0.2.0\n") >= 0);
  assert.ok(io.stdout.indexOf("prerelease=true\n") >= 0);
  const stable = releaseMeta.checkTagToGithubOutput("v0.2.0", "0.2.0");
  assert.ok(stable.stdout.indexOf("prerelease=false\n") >= 0);
});

test("assertRunner: Node floor + arch mismatch fails loud", () => {
  const ok = releaseMeta.assertRunner({
    nodeVersion: "v24.8.0", arch: "arm64", platform: "darwin", expectArch: "arm64",
  });
  assert.strictEqual(ok.arch, "arm64");
  assert.throws(() => releaseMeta.assertRunner({
    nodeVersion: "v18.20.0", arch: "x64", expectArch: "x64",
  }), /22\.5/);
  assert.throws(() => releaseMeta.assertRunner({
    nodeVersion: "v24.8.0", arch: "x64", platform: "darwin", expectArch: "arm64",
  }), /runner arch is x64/);
});

test("sha256sums: GNU two-space format; refuses a partial set", () => {
  const dir = tmp("sums-" + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.bin"), "aaa");
  fs.writeFileSync(path.join(dir, "b.bin"), "bbb");
  const out = path.join(dir, "SHA256SUMS");
  const text = releaseMeta.writeSha256Sums({ dir, out, expect: ["a.bin", "b.bin"] });
  assert.strictEqual(fs.readFileSync(out, "utf8"), text);
  assert.ok(/^[0-9a-f]{64}  a\.bin$/m.test(text));
  assert.ok(/^[0-9a-f]{64}  b\.bin$/m.test(text));
  assert.ok(!text.includes("\r"));
  assert.throws(() => releaseMeta.writeSha256Sums({
    dir, out: path.join(dir, "nope"), expect: ["a.bin", "missing.bin"],
  }), /missing missing\.bin/);
});

test("release notes: unsigned + Gatekeeper/SmartScreen; rc banner on prerelease", () => {
  const stable = releaseMeta.releaseNotes({ tag: "v0.2.0", pkgVersion: "0.2.0" });
  assert.ok(stable.includes("resonance-memory.exe"));
  assert.ok(stable.includes("resonance-memory-linux-x64"));
  assert.ok(stable.includes("resonance-memory-macos-arm64"));
  assert.ok(/SmartScreen/i.test(stable));
  assert.ok(/Gatekeeper/i.test(stable));
  assert.ok(/unsigned/i.test(stable));
  assert.ok(stable.includes("docs/BUILDING.md"));
  assert.ok(!/notariz/i.test(stable) || /future/i.test(stable));
  // The release page is the storefront: it must explain what RM is and route to the
  // README, not just dump a download table (product call 2026-09-07).
  assert.ok(/#readme/.test(stable), "notes link the README walkthrough (a downloader may never find it on the repo page)");
  assert.ok(/remembers?\b.*\byou|memory that survives|lasting, private memory/i.test(stable), "notes actually say what RM is, not just how to run it");
  assert.ok(/do \*\*not\*\* need to install Node prior to download/.test(stable), "Node wording is the requested phrasing");
  const rc = releaseMeta.releaseNotes({ tag: "v0.2.0-rc1", pkgVersion: "0.2.0" });
  assert.ok(/pre-release/i.test(rc));
  assert.ok(rc.includes("v0.2.0-rc1"));
});

test("release assets match build-exe.js names (win exe, linux x64, macos arm64)", () => {
  assert.deepStrictEqual(releaseMeta.RELEASE_ASSETS, [
    buildExe.artifactName("win", "x64"),
    buildExe.artifactName("linux", "x64"),
    buildExe.artifactName("macos", "arm64"),
  ]);
});

function workflowUses(yml) {
  const uses = [];
  for (const line of String(yml).split(/\r?\n/)) {
    const m = line.match(/uses:\s*(\S+)/);
    if (m) uses.push(m[1]);
  }
  return uses;
}

function workflowPin(uses, action) {
  const hit = uses.find((u) => u.startsWith(action + "@"));
  return hit ? hit.slice(action.length + 1) : null;
}

test("workflow YAML: SHA-pinned actions, three native runners, gate before release", () => {
  const ymlPath = path.join(__dirname, ".github", "workflows", "release.yml");
  assert.ok(fs.existsSync(ymlPath), "release matrix must live at .github/workflows/release.yml");
  const yml = fs.readFileSync(ymlPath, "utf8");
  assert.ok(yml.indexOf("v[0-9]*") >= 0, "tag glob should be v[0-9]* (not a bare v* that matches 'validation')");
  assert.ok(yml.indexOf("workflow_dispatch:") >= 0);
  assert.ok(yml.indexOf("windows-latest") >= 0);
  assert.ok(yml.indexOf("ubuntu-latest") >= 0);
  assert.ok(yml.indexOf("macos-latest") >= 0);
  assert.ok(yml.indexOf("node-version: \"24\"") >= 0 || yml.indexOf("node-version: '24'") >= 0);
  assert.ok(yml.indexOf("node test.js") >= 0);
  assert.ok(yml.indexOf("node eval/run.js") >= 0);
  assert.ok(yml.indexOf("ci/smoke-exe.js") >= 0);
  assert.ok(yml.indexOf("build-exe.js --target") >= 0);
  assert.ok(yml.indexOf("contents: write") >= 0);
  assert.ok(yml.indexOf("SHA256SUMS") >= 0);
  assert.ok(yml.indexOf("resonance-memory.exe") >= 0);
  assert.ok(yml.indexOf("resonance-memory-linux-x64") >= 0);
  assert.ok(yml.indexOf("resonance-memory-macos-arm64") >= 0);
  assert.ok(yml.indexOf("expect_arch: arm64") >= 0);
  // Intel Mac is a documented non-goal this slice (Node SEA skips x64).
  assert.ok(!/macos-13/.test(yml), "macos-13 (Intel) must not sneak into the matrix");
  const uses = workflowUses(yml);
  assert.ok(uses.length >= 4, "expected checkout/setup-node/upload/download at minimum");
  for (const u of uses) {
    assert.ok(/@[0-9a-f]{40}$/.test(u), u + " is not pinned to a full-length SHA");
  }
  assert.ok(!uses.some((u) => /softprops|action-gh-release/.test(u)), "use gh CLI, not a third-party release action");
});

test("PR-path CI: SHA-pinned, main+PR, cancel-in-progress, same pins as release.yml", () => {
  const ciPath = path.join(__dirname, ".github", "workflows", "ci.yml");
  const relPath = path.join(__dirname, ".github", "workflows", "release.yml");
  assert.ok(fs.existsSync(ciPath), "always-on gate must live at .github/workflows/ci.yml");
  const yml = fs.readFileSync(ciPath, "utf8");
  const rel = fs.readFileSync(relPath, "utf8");
  // Negative checks ignore comments so a "why we don't X" note can't
  // trip the contract (EVAL_REFRESH is named in the header on purpose).
  const active = yml.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n");

  // Checks UI reads "CI / gate".
  assert.ok(/^name:\s*CI\s*$/m.test(yml), "workflow name must be 'CI'");
  assert.ok(/name:\s*gate\s*$/m.test(yml), "job name must be 'gate'");
  assert.ok(/AGPL-3\.0/.test(yml), "AGPL header on the new workflow file");

  // Triggers: push to main + every pull_request. Not every scratch branch
  // (those get coverage when they open a PR). Tags are release.yml's job.
  assert.ok(/^\s+push:\s*$/m.test(yml));
  assert.ok(/^\s+-\s+main\s*$/m.test(yml), "push must be scoped to main");
  assert.ok(/^\s+pull_request:\s*$/m.test(yml));
  assert.ok(!/workflow_dispatch:/.test(active), "this is the always-on gate, not a manual build");
  assert.ok(!/^\s+tags:/m.test(active), "tags belong to release.yml");
  assert.ok(!/\*\*/.test(active), "must not glob every branch");

  // Opposite of release.yml: a new PR push should cancel the stale run.
  assert.ok(/cancel-in-progress:\s*true/.test(yml));
  assert.ok(/contents:\s*read/.test(yml));
  assert.ok(!/contents:\s*write/.test(active), "PR-path CI never publishes");
  assert.ok(/persist-credentials:\s*false/.test(yml));

  // Cheap: ubuntu only, the two gate commands, no SEA matrix.
  assert.ok(/ubuntu-latest/.test(yml));
  assert.ok(!/windows-latest/.test(active), "native matrix is release.yml");
  assert.ok(!/macos-latest/.test(active), "native matrix is release.yml");
  assert.ok(/node-version:\s*["']24["']/.test(yml));
  assert.ok(yml.includes("node test.js"), "unit suite must run as a step");
  assert.ok(yml.includes("node eval/run.js"), "golden must run as a step");
  assert.ok(!/EVAL_REFRESH/.test(active), "must not set EVAL_REFRESH (would hit the network)");
  assert.ok(!/build-exe\.js/.test(active), "SEA build is release.yml, not this file");
  assert.ok(!/smoke-exe/.test(active));
  assert.ok(!/upload-artifact|download-artifact|gh release/.test(active));
  assert.ok(!/continue-on-error:\s*true/.test(active), "a red test must fail the job");
  assert.ok(!/\|\|\s*true/.test(active), "a red test must not be swallowed");

  // SHA pins, and they must match release.yml for the shared actions so
  // we never introduce a second unvetted action version.
  const ciUses = workflowUses(yml);
  const relUses = workflowUses(rel);
  assert.ok(ciUses.length >= 2, "expected checkout + setup-node");
  for (const u of ciUses) {
    assert.ok(/@[0-9a-f]{40}$/.test(u), u + " is not pinned to a full-length SHA");
  }
  const checkoutSha = workflowPin(relUses, "actions/checkout");
  const nodeSha = workflowPin(relUses, "actions/setup-node");
  assert.ok(checkoutSha && nodeSha, "release.yml must pin checkout and setup-node");
  assert.strictEqual(
    workflowPin(ciUses, "actions/checkout"), checkoutSha,
    "ci.yml must reuse release.yml's checkout SHA",
  );
  assert.strictEqual(
    workflowPin(ciUses, "actions/setup-node"), nodeSha,
    "ci.yml must reuse release.yml's setup-node SHA",
  );
  assert.ok(!ciUses.some((u) => /softprops|action-gh-release/.test(u)));
});

// ------------------------------------------------ RM-07 slice 2b export / zip
section("RM-07 slice 2b — zip writer + sovereignty export (read-only)");

const {
  ZipWriter, ZipReader, hasZip64Eocd, crcOf, FLAG_UTF8, U16_MAX,
} = require("./zip.js");
const exp = require("./export-memory.js");

test("slug: lowercase, spaces→hyphens, keep words", () => {
  assert.strictEqual(exp.memorySlug(42, "I like tea"), "42-i-like-tea.json");
});

test("slug: filesystem-illegal stripped, not replaced with junk", () => {
  assert.strictEqual(exp.memorySlug(1, 'hello<>:"/\\|?*world'), "1-helloworld.json");
});

test("slug: reserved CON/PRN/NUL/COM1-9/LPT1-9/empty → <id>.json (no hash)", () => {
  assert.strictEqual(exp.memorySlug(7, "CON"), "7.json");
  assert.strictEqual(exp.memorySlug(7, "prn"), "7.json");
  assert.strictEqual(exp.memorySlug(7, "NUL"), "7.json");
  assert.strictEqual(exp.memorySlug(7, "COM1"), "7.json");
  assert.strictEqual(exp.memorySlug(7, "LPT9"), "7.json");
  assert.strictEqual(exp.memorySlug(7, ""), "7.json");
  assert.strictEqual(exp.memorySlug(7, "???"), "7.json", "illegal-only collapses to empty");
  assert.strictEqual(exp.memorySlug(7, "COM10"), "7-com10.json", "COM10 is not reserved");
});

test("slug: trailing dots/spaces stripped", () => {
  assert.strictEqual(exp.memorySlug(3, "hello..."), "3-hello.json");
  assert.strictEqual(exp.memorySlug(3, "hello   "), "3-hello.json");
});

test("slug: cap ~40 at the last hyphen (whole words, no hash suffix)", () => {
  const long = "this-is-a-very-long-memory-about-something-important-indeed";
  const s = exp.memorySlug(9, long);
  assert.ok(s.startsWith("9-"));
  assert.ok(s.endsWith(".json"));
  const body = s.slice(2, -5);
  assert.ok(body.length <= 40, "slug body capped, got " + body.length + " " + body);
  assert.ok(!/-$/.test(body));
  assert.ok(!/hash|sha|md5/i.test(s), "no hash suffix");
});

test("slug: DON'T ASCII-fold CJK — empty-fold is the payload failure", () => {
  assert.strictEqual(exp.memorySlug(11, "记忆测试"), "11-记忆测试.json");
  assert.strictEqual(exp.memorySlug(12, "café notes"), "12-café-notes.json");
});

test("folder path is f(created) UTC day-granular, zero-padded", () => {
  assert.strictEqual(exp.memoryDayPath("2026-03-05T12:34:56.000Z"), "memories/2026/03/05");
  assert.strictEqual(exp.memoryDayPath("2019-01-09T00:00:00.000Z"), "memories/2019/01/09");
  assert.notStrictEqual(exp.memoryDayPath("2026-03-05T12:34:56.000Z"), "memories/2026/3/5");
});

test("catalog columns: id status created path bytes text", () => {
  const rec = normalize({
    id: 5, text: "I prefer tea in the morning with honey",
    created: "2026-01-02T00:00:00.000Z", deleted: true,
  });
  const line = exp.catalogLine(rec, "root/memories/2026/01/02/5-i-prefer-tea.json", 123);
  const cols = line.replace(/\n$/, "").split("\t");
  assert.deepStrictEqual(exp.catalogHeader().replace(/\n$/, "").split("\t"),
    ["id", "status", "created", "path", "bytes", "text"]);
  assert.strictEqual(cols[0], "5");
  assert.strictEqual(cols[1], "deleted");
  assert.strictEqual(cols[2], "2026-01-02T00:00:00.000Z");
  assert.strictEqual(cols[3], "root/memories/2026/01/02/5-i-prefer-tea.json");
  assert.strictEqual(cols[4], "123");
  assert.ok(cols[5].indexOf("I prefer tea") === 0);
  assert.ok(cols[5].length <= 80);
});

test("recordStatus: deleted wins; superseded via valid_to or superseded_by", () => {
  assert.strictEqual(exp.recordStatus({ deleted: true, valid_to: "x" }), "deleted");
  assert.strictEqual(exp.recordStatus({ superseded_by: 2 }), "superseded");
  assert.strictEqual(exp.recordStatus({ valid_to: "2026-01-01T00:00:00Z" }), "superseded");
  assert.strictEqual(exp.recordStatus({ text: "hi" }), "current");
});

test("sanitizeExportName / never-overwrite Name (2).zip", () => {
  assert.strictEqual(exp.sanitizeExportName("foo/bar<>.zip", "fb"), "foo-bar");
  const dir = tmp("export-unique");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Name.zip"), "x");
  const p2 = exp.uniqueZipPath(dir, "Name");
  assert.strictEqual(path.basename(p2), "Name (2).zip");
  fs.writeFileSync(p2, "y");
  const p3 = exp.uniqueZipPath(dir, "Name");
  assert.strictEqual(path.basename(p3), "Name (3).zip");
});

test("human JSON omits embedding; jsonl line keeps embedding as a JSON array", () => {
  const rec = {
    id: 1, text: "hi", created: "2026-01-01T00:00:00.000Z",
    embedding: Float32Array.from([0.1, 0.2, 0.3]),
  };
  const human = JSON.parse(exp.recordToHumanJson(rec));
  assert.strictEqual("embedding" in human, false);
  const line = JSON.parse(exp.recordToJsonlLine(rec));
  assert.ok(Array.isArray(line.embedding));
  assert.strictEqual(line.embedding.length, 3);
});

test("zip writer: STORE + DEFLATE round-trip, CRC, UTF-8 flag, ZIP64 always", () => {
  const zpath = tmp("tiny.zip");
  const w = new ZipWriter(zpath);
  w.addStored("root/hello.txt", "hello store\n");
  w.addDeflated("root/café.txt", "deflated payload " + "x".repeat(200));
  const fin = w.finalize();
  assert.ok(fs.existsSync(zpath), "renamed off .tmp");
  assert.ok(!fs.existsSync(zpath + ".tmp"), "tmp gone after EOCD rename");
  assert.strictEqual(fin.entries, 2);
  assert.ok(hasZip64Eocd(zpath), "ZIP64 EOCD+locator even at 2 entries — no classic-only path");
  const r = ZipReader.open(zpath);
  assert.strictEqual(r.entries.length, 2);
  assert.strictEqual(r.readStored("root/hello.txt").toString("utf8"), "hello store\n");
  assert.strictEqual(r.readStored("root/café.txt").toString("utf8"), "deflated payload " + "x".repeat(200));
  const cafe = r.get("root/café.txt");
  assert.ok(cafe.utf8, "UTF-8 flag set so CJK/accents survive");
  assert.strictEqual(cafe.flag & FLAG_UTF8, FLAG_UTF8);
  assert.strictEqual(cafe.crc, crcOf(Buffer.from("deflated payload " + "x".repeat(200))) >>> 0);
  assert.ok(cafe.usize < U16_MAX, "this member is small; ZIP64 is still used for the archive");
});

test("zip writer: killed-looking abort leaves no dest zip", () => {
  const zpath = tmp("aborted.zip");
  const w = new ZipWriter(zpath);
  w.addStored("a.txt", "aa");
  assert.ok(fs.existsSync(zpath + ".tmp"));
  w.abort();
  assert.ok(!fs.existsSync(zpath), "dest was never renamed");
  assert.ok(!fs.existsSync(zpath + ".tmp"), "abort unlinks tmp");
});

test("README + manifest layout field", () => {
  const readme = exp.buildReadme();
  assert.ok(/you own/i.test(readme));
  assert.ok(/diary/i.test(readme));
  assert.ok(/do not sanitize/i.test(readme));
  assert.ok(/memories\.jsonl/.test(readme));
  assert.ok(/catalog\.txt/.test(readme));
  assert.ok(/MAX_PATH/.test(readme));
  assert.ok(/--import/.test(readme), "zip README tells you how to load it back (RM-17)");
  const man = JSON.parse(exp.buildManifest({
    exportedAt: "2026-09-05T00:00:00.000Z",
    name: "resonance-memories-2026-09-05",
    count: { total: 3, current: 1, superseded: 1, deleted: 1 },
  }));
  assert.strictEqual(man.layout, "memories/YYYY/MM/DD");
  assert.strictEqual(man.schema_version, 1);
});

test("uniqueZipPath({ create:false }) does not mkdir (panel preview must not write)", () => {
  const dir = tmp("preview-no-mkdir");
  assert.ok(!fs.existsSync(dir));
  const p = exp.uniqueZipPath(dir, "resonance-memories-preview", { create: false });
  assert.ok(!fs.existsSync(dir), "preview must not create the dest dir");
  assert.ok(p.endsWith(".zip"));
});

test("panel page source ships first-run empty-store copy (RM-20)", () => {
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes("Nothing saved yet"), "empty-store title");
  assert.ok(src.includes("Copy a starter prompt"), "seed-prompt button");
  assert.ok(src.includes("Connected, but nothing saved yet"), "connected-but-empty hint");
  assert.ok(/remember that/i.test(src), "tells the user the phrase that triggers a save");
});

test("panel page source ships embedder selector + /api/embedder (not a browser test)", () => {
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes('id="embedderSel"'), "embedder dropdown");
  assert.ok(src.includes('id="embedderRow"'), "embedder row");
  assert.ok(src.includes('"/api/embedder"'), "GET/POST embedder route");
  assert.ok(src.includes("EMBEDDER_PRESETS"), "per-model tuning presets");
});

test("panel page source ships the export button + confirm modal (not a browser test)", () => {
  // The actual click/modal is a browser UI — no browser tooling here.
  // This only asserts the page we serve contains the settled 2c copy.
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes("Export my memories"), "visible button");
  assert.ok(/read-only/i.test(src), "confirm modal says read-only");
  assert.ok(/Filenames may contain a preview/.test(src), "filename-preview note");
  assert.ok(/this can take a minute at large N/.test(src), "honest in-flight copy, not a fake %");
  assert.ok(src.includes("pauseWatchdog"), "watchdog pause is in the panel server");
  assert.ok(src.includes("copy path") || src.includes("exportCopyPath"), "copy-path control");
  assert.ok(/not an MCP tool/i.test(src), "exfil path stays off the four verbs");
});

test("panel page source ships the import button + confirm modal (RM-17)", () => {
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes("Import memories"), "visible button");
  assert.ok(src.includes('id="importWithEdges"'), "with-edges checkbox");
  assert.ok(!/id="importWithEdges"[^>]*checked/.test(src), "with-edges default-off in the markup");
  assert.ok(/planted sidecar is an injection path/.test(src), "0009 refusal is user-visible");
  assert.ok(src.includes('id="importMerge"'), "merge checkbox for nonempty dest");
  assert.ok(!/importMerge\.checked\s*=\s*true/.test(src), "merge is an explicit opt-in, never pre-checked (product call 2026-09-07)");
  assert.ok(src.includes("IMPORT_DEST_NONEMPTY"), "panel translates the non-empty-dest guard to point at the checkbox, not --merge");
  assert.ok(src.includes("/api/import"), "import route");
  assert.ok(src.includes("runImport"), "shells the CLI engine, not a second writer");
  assert.ok(/not an MCP tool/i.test(src), "import stays off the four verbs");
  assert.ok(/Have a zip from another machine/.test(src), "first-run hole names the import button");
});

test("panel page source ships W-02 Origin/CSRF lock (not a browser test)", () => {
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes("allowPanelRequest"), "request gate is in the panel server");
  assert.ok(src.includes("X-Resonance-Token"), "per-process token header");
  assert.ok(src.includes("RM_PANEL_TOKEN"), "token is baked into the page");
  assert.ok(src.includes("forbidden_origin"), "cross-origin is a named refusal");
  assert.ok(src.includes("forbidden_host"), "DNS-rebinding Host is a named refusal");
  assert.ok(src.includes("forbidden_csrf"), "missing token is a named refusal");
  assert.ok(!/Access-Control-Allow-Origin/i.test(src), "no CORS — the panel is not a public API yet");
});

test("system-prompt.md: the copy button hands over only the paste-ready block", () => {
  // Contract: the file's ``` fence extracts to a clean prompt — all four tools,
  // recall-first, and NONE of the human-facing doc around it. Same regex the panel
  // handler uses (pickPromptBlock). A weak model must never be fed "paste the block below".
  const md = fs.readFileSync(path.join(__dirname, "system-prompt.md"), "utf8");
  const m = md.match(/```[^\n]*\n([\s\S]*?)\n```/);
  assert.ok(m, "system-prompt.md must carry the prompt in a fenced block");
  const block = m[1].trim();
  for (const verb of ["save_memory", "recall_memory", "edit_memory", "delete_memory"]) {
    assert.ok(block.includes(verb), "block names " + verb);
  }
  assert.ok(/recall_memory FIRST|RECALL before you answer/i.test(block), "recall-first is the lead behavior for weak models");
  assert.ok(!/#\s*Optional|paste the block|copy a ready-made|turn it off/i.test(block), "block excludes the human-facing doc around it");
  const src = fs.readFileSync(path.join(__dirname, "panel.js"), "utf8");
  assert.ok(src.includes("pickPromptBlock"), "the /api/system-prompt handler extracts the block, not the whole file");
});

test("export is not an MCP tool (four verbs stay four)", () => {
  const src = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
  assert.ok(/name: "save_memory"/.test(src));
  assert.ok(/name: "recall_memory"/.test(src));
  assert.ok(/name: "edit_memory"/.test(src));
  assert.ok(/name: "delete_memory"/.test(src));
  assert.ok(!/name: "export_memory"/.test(src));
  assert.ok(!/name: "export"/.test(src));
  assert.ok(!/name: "import_memory"/.test(src));
  assert.ok(!/name: "import"/.test(src));
  const toolNames = [...src.matchAll(/name:\s*"(save_memory|recall_memory|edit_memory|delete_memory|export\w*|import\w*)"/g)]
    .map((m) => m[1]);
  assert.deepStrictEqual(
    toolNames.filter((n, i) => toolNames.indexOf(n) === i),
    ["save_memory", "recall_memory", "edit_memory", "delete_memory"]
  );
});

section("A/B grok rig (offline invariants)");
require("./eval/ab-grok/check.js").runChecks(test, assert);

// ------------------------------------------------ edit() embedding safety
// An embedder outage is transient; losing an embedding is not.
// createCore already required above (warm-field section)

async function asyncTests() {
  // ------------------------------------------------- RM-07 slice 2a migrator
  section("JSONL→SQLite migrator (RM-07 slice 2a, 10-step protocol)");

  if (!sqliteAvailable()) {
    await atest("JSONL→SQLite migrator SKIPPED (node:sqlite not in this Node)", async () => {
      assert.ok(true);
    });
  } else {
    const { migrateJsonlToSqlite } = require("./migrate-sqlite.js");

    function writeJsonlFixture(file, recs, extra) {
      extra = extra || {};
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const lines = recs.map((r) => JSON.stringify(r));
      if (extra.blankLines) lines.push("", "   ");
      fs.writeFileSync(file, lines.join("\n") + "\n");
      if (extra.access) {
        fs.writeFileSync(file + ".access.json", JSON.stringify({ counts: extra.access }));
      }
      return file;
    }

    function migrateFixture(name) {
      const dir = tmp("mig-" + name + "-" + Math.random().toString(36).slice(2));
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, "mem.jsonl");
    }

    const FIXTURE_RECS = [
      {
        id: 1700000000001,
        text: "I work at Acme",
        created: "2020-06-15T12:34:56.000Z",
        modified: "2020-06-15T12:34:56.000Z",
        embedding: [1, 0, 0.25],
        access_count: 2,
        source: "user_stated",
        embedding_version: 1,
      },
      {
        id: 1700000000002,
        text: "I used to work at Globex",
        created: "2019-01-01T00:00:00.000Z",
        modified: "2019-01-01T00:00:00.000Z",
        embedding: [0, 1, 0],
        valid_from: "2019-01-01T00:00:00.000Z",
        valid_to: "2020-06-15T12:34:56.000Z",
        superseded_by: 1700000000001,
        last_access: "2020-01-01T00:00:00.000Z",
      },
      {
        id: 7,
        text: "no vector here",
        created: "2021-03-03T03:03:03.000Z",
        modified: "2021-03-03T03:03:03.000Z",
      },
      {
        id: 8,
        text: "soft deleted",
        created: "2021-04-04T04:04:04.000Z",
        modified: "2021-04-04T04:04:04.000Z",
        deleted: true,
        embedding: [0, 0, 1],
      },
    ];
    const FIXTURE_ACCESS = {
      "1700000000001": { n: 3, last: "2026-09-01T00:00:00.000Z" },
      "7": { n: 1, last: "2026-09-02T00:00:00.000Z" },
    };

    await atest("10-step happy path: lossless, ids, access-fold-once, created, JSONL→.bak", async () => {
      const jsonl = migrateFixture("happy");
      writeJsonlFixture(jsonl, FIXTURE_RECS, { blankLines: true, access: FIXTURE_ACCESS });
      const logs = [];
      const result = await migrateJsonlToSqlite(jsonl, { log: (m) => logs.push(m) });
      assert.strictEqual(result.status, "migrated");
      assert.strictEqual(result.count, 4, "blank lines are not rows");
      const dbPath = sqlitePathFor(jsonl);
      assert.ok(fs.existsSync(dbPath), ".db at the live path");
      assert.ok(!fs.existsSync(jsonl), "JSONL renamed off MEMORY_FILE_PATH");
      assert.ok(fs.existsSync(jsonl + ".bak"), "recovery snapshot at .bak");
      assert.ok(!fs.existsSync(jsonl + ".access.json"), "live access sidecar is gone");
      assert.ok(fs.existsSync(jsonl + ".access.json.bak"), "access sidecar bak'd");
      assert.ok(!fs.existsSync(dbPath + ".migrating"), "temp gone after rename");
      assert.ok(logs.some((m) => /migrated 4 memories; original kept at /.test(m)));

      const s = new SqliteStore(dbPath);
      const all = s.all();
      assert.strictEqual(all.length, 4);
      const byId = new Map(all.map((r) => [String(r.id), r]));

      const a = byId.get("1700000000001");
      assert.strictEqual(Number(a.id), 1700000000001, "opaque id preserved (not AUTOINCREMENT 1)");
      assert.strictEqual(a.created, "2020-06-15T12:34:56.000Z", "created preserved (not now())");
      assert.strictEqual(a.text, "I work at Acme");
      assert.strictEqual(a.access_count, 5, "in-row 2 + sidecar 3, folded ONCE");
      assert.strictEqual(a.last_access, "2026-09-01T00:00:00.000Z");
      assert.strictEqual(a.importance, 5, "AccessLog.apply sets importance = folded count");
      assert.ok(embClose(a.embedding, [1, 0, 0.25]));

      const b = byId.get("1700000000002");
      assert.strictEqual(String(b.superseded_by), "1700000000001", "superseded_by preserved");
      assert.strictEqual(b.created, "2019-01-01T00:00:00.000Z");
      assert.strictEqual(b.valid_to, "2020-06-15T12:34:56.000Z");
      assert.strictEqual(b.access_count, 0, "no sidecar entry, in-row stays 0");

      const c = byId.get("7");
      assert.strictEqual(Number(c.id), 7, "small explicit id is not reassigned");
      assert.strictEqual(c.created, "2021-03-03T03:03:03.000Z");
      assert.strictEqual(c.embedding, null, "vectorless stays vectorless — do not invent");
      assert.strictEqual(c.access_count, 1, "sidecar-only count folded");

      const d = byId.get("8");
      assert.strictEqual(d.deleted, true);
      assert.ok(embClose(d.embedding, [0, 0, 1]));

      assert.strictEqual(s.current().length, 2, "superseded + deleted excluded from current()");
      // BUG-007: leftover bak sidecar must not fold again on read.
      assert.strictEqual(s.get(1700000000001).access_count, 5, "SqliteStore does not re-fold .bak sidecar");
      s.close();
    });

    await atest("vectorless row migrates vectorless (do not invent a blob)", async () => {
      const jsonl = migrateFixture("vectorless");
      writeJsonlFixture(jsonl, [{
        id: 42, text: "bare fact", created: "2018-08-08T08:08:08.000Z",
      }]);
      await migrateJsonlToSqlite(jsonl, { log() {} });
      const s = new SqliteStore(sqlitePathFor(jsonl));
      const r = s.get(42);
      assert.strictEqual(r.embedding, null);
      assert.strictEqual(r.created, "2018-08-08T08:08:08.000Z");
      assert.strictEqual(s.embeddingRowCount(), 0);
      s.close();
    });

    await atest("count-mismatch aborts non-destructively (JSONL live, no half .db)", async () => {
      const jsonl = migrateFixture("mismatch");
      writeJsonlFixture(jsonl, [
        { id: 1, text: "a", created: "2020-01-01T00:00:00.000Z", embedding: [1, 0] },
        { id: 2, text: "b", created: "2020-01-01T00:00:00.000Z", embedding: [0, 1] },
      ]);
      const before = fs.readFileSync(jsonl, "utf8");
      let threw = null;
      try {
        await migrateJsonlToSqlite(jsonl, {
          log() {},
          onAfterIngest(store) {
            store.db.exec("DELETE FROM memories WHERE id = 1");
          },
        });
      } catch (e) { threw = e; }
      assert.ok(threw, "must abort");
      assert.strictEqual(threw.code, "MIGRATE_COUNT_MISMATCH");
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before, "JSONL still live, bytes unchanged");
      const dbPath = sqlitePathFor(jsonl);
      assert.ok(!fs.existsSync(dbPath), "no half .db at the live path");
      assert.ok(!fs.existsSync(dbPath + ".migrating"), "temp deleted on abort");
    });

    await atest("in-process crash-before-rename leaves JSONL live + no half db", async () => {
      const jsonl = migrateFixture("crash-throw");
      writeJsonlFixture(jsonl, [
        { id: 9, text: "keep me", created: "2017-07-07T07:07:07.000Z", embedding: [1, 1] },
      ]);
      const before = fs.readFileSync(jsonl, "utf8");
      let threw = null;
      try {
        await migrateJsonlToSqlite(jsonl, {
          log() {},
          async onBeforeRename() { throw new Error("simulated crash before step 7"); },
        });
      } catch (e) { threw = e; }
      assert.ok(threw);
      assert.ok(/simulated crash/.test(threw.message));
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before);
      const dbPath = sqlitePathFor(jsonl);
      assert.ok(!fs.existsSync(dbPath), "no .db at MEMORY_FILE_PATH");
      assert.ok(!fs.existsSync(dbPath + ".migrating"), "temp cleaned on in-process throw");
    });

    await atest("kill-9 before step 7: JSONL live, no half .db, re-run completes", async () => {
      const { spawn } = require("child_process");
      const jsonl = migrateFixture("kill9");
      writeJsonlFixture(jsonl, FIXTURE_RECS, { access: FIXTURE_ACCESS });
      const before = fs.readFileSync(jsonl, "utf8");
      const ready = jsonl + ".ready";
      const child = spawn(process.execPath, [path.join(__dirname, "migrate-sqlite.js"), jsonl], {
        env: Object.assign({}, process.env, {
          RM_MIGRATE_CRASH_BEFORE_RENAME: "1",
          RM_MIGRATE_CRASH_READY: ready,
        }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      const t0 = Date.now();
      while (!fs.existsSync(ready)) {
        if (Date.now() - t0 > 15000) {
          try { child.kill("SIGKILL"); } catch { /* */ }
          throw new Error("kill-9 child never wrote ready file: " + (child.stderr && child.stderr.read()));
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      child.kill("SIGKILL");
      await new Promise((resolve) => {
        if (child.exitCode != null || child.signalCode) return resolve();
        child.on("exit", resolve);
        setTimeout(resolve, 5000);
      });
      assert.ok(fs.existsSync(jsonl), "JSONL still at its path after kill-9");
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before, "JSONL bytes unchanged");
      const dbPath = sqlitePathFor(jsonl);
      assert.ok(!fs.existsSync(dbPath), "no half .db sits at MEMORY_FILE_PATH");
      // Leftover .db.migrating is allowed (finally did not run). Re-run must
      // drop it (no resume-from-partial) and complete.
      const result = await migrateJsonlToSqlite(jsonl, { log() {} });
      assert.strictEqual(result.status, "migrated");
      assert.strictEqual(result.count, 4);
      assert.ok(fs.existsSync(dbPath));
      assert.ok(!fs.existsSync(jsonl), "JSONL now at .bak");
      assert.ok(fs.existsSync(jsonl + ".bak"));
      assert.ok(!fs.existsSync(dbPath + ".migrating"));
      const s = new SqliteStore(dbPath);
      assert.strictEqual(s.get(1700000000001).access_count, 5);
      assert.strictEqual(s.get(7).embedding, null);
      assert.strictEqual(s.get(1700000000001).created, "2020-06-15T12:34:56.000Z");
      s.close();
    });

    await atest("second run on an already-migrated store is a no-op (ignore leftover JSONL)", async () => {
      const jsonl = migrateFixture("noop");
      writeJsonlFixture(jsonl, [
        { id: 1, text: "original", created: "2020-01-01T00:00:00.000Z", embedding: [1, 0] },
      ]);
      const first = await migrateJsonlToSqlite(jsonl, { log() {} });
      assert.strictEqual(first.status, "migrated");
      const dbPath = sqlitePathFor(jsonl);
      const s1 = new SqliteStore(dbPath);
      assert.strictEqual(s1.get(1).text, "original");
      s1.close();
      // A leftover JSONL at the original path must NOT be dual-read or re-ingested.
      writeJsonlFixture(jsonl, [
        { id: 99, text: "stale leftover — must be ignored", created: "2026-01-01T00:00:00.000Z" },
      ]);
      const logs = [];
      const second = await migrateJsonlToSqlite(jsonl, { log: (m) => logs.push(m) });
      assert.strictEqual(second.status, "already_migrated");
      assert.strictEqual(second.ignoredJsonl, true);
      assert.ok(logs.some((m) => /leftover JSONL ignored/.test(m)));
      assert.ok(fs.existsSync(jsonl), "leftover JSONL is ignored, not consumed");
      const s2 = new SqliteStore(dbPath);
      assert.strictEqual(s2.all().length, 1, "db not re-ingested");
      assert.strictEqual(s2.get(1).text, "original");
      assert.strictEqual(s2.get(99), null, "leftover JSONL rows did not land");
      s2.close();
    });

    await atest("empty .db beside a live JSONL is refused (openStore footgun), JSONL kept", async () => {
      const jsonl = migrateFixture("empty-db");
      writeJsonlFixture(jsonl, [
        { id: 3, text: "do not lose me", created: "2016-06-06T06:06:06.000Z" },
      ]);
      const dbPath = sqlitePathFor(jsonl);
      const empty = new SqliteStore(dbPath);
      assert.strictEqual(empty.rowCount(), 0);
      empty.close();
      const before = fs.readFileSync(jsonl, "utf8");
      let threw = null;
      try { await migrateJsonlToSqlite(jsonl, { log() {} }); }
      catch (e) { threw = e; }
      assert.ok(threw);
      assert.strictEqual(threw.code, "MIGRATE_EMPTY_DB");
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before, "JSONL still live");
    });

    await atest("CLI --migrate (entry.js) runs the protocol; not a fifth verb", async () => {
      const { spawnSync } = require("child_process");
      const jsonl = migrateFixture("cli");
      writeJsonlFixture(jsonl, [
        { id: 11, text: "cli fact", created: "2022-02-02T02:02:02.000Z", embedding: [0.5, 0.5] },
      ]);
      const entry = path.join(__dirname, "entry.js");
      const env = Object.assign({}, process.env);
      delete env.RM_MIGRATE_CRASH_BEFORE_RENAME;
      delete env.RM_MIGRATE_CRASH_READY;
      const ran = spawnSync(process.execPath, [entry, "--migrate", "--json", jsonl], {
        encoding: "utf8", timeout: 20000, env,
      });
      assert.strictEqual(ran.status, 0, "cli exit: " + (ran.stderr || ran.stdout));
      const out = JSON.parse(ran.stdout);
      assert.strictEqual(out.status, "migrated");
      assert.strictEqual(out.count, 1);
      assert.ok(fs.existsSync(sqlitePathFor(jsonl)));
      assert.ok(fs.existsSync(jsonl + ".bak"));
      assert.ok(!fs.existsSync(jsonl));
    });

    await atest("unparseable non-blank line aborts; JSONL live", async () => {
      const jsonl = migrateFixture("badline");
      fs.mkdirSync(path.dirname(jsonl), { recursive: true });
      fs.writeFileSync(jsonl, JSON.stringify({
        id: 1, text: "ok", created: "2020-01-01T00:00:00.000Z",
      }) + "\nthis is not json\n");
      let threw = null;
      try { await migrateJsonlToSqlite(jsonl, { log() {} }); }
      catch (e) { threw = e; }
      assert.ok(threw);
      assert.strictEqual(threw.code, "MIGRATE_PARSE");
      assert.ok(fs.existsSync(jsonl), "JSONL still live");
      assert.ok(!fs.existsSync(sqlitePathFor(jsonl)));
    });
  }

  section("RM-07 slice 4 — default switch (openStore auto-migrate)");

  if (!sqliteAvailable()) {
    await atest("openStore default-switch SKIPPED (node:sqlite not in this Node)", async () => {
      assert.ok(true);
    });
  } else {
    function switchFixture(name) {
      const dir = tmp("sw4-" + name + "-" + Math.random().toString(36).slice(2));
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, "mem.jsonl");
    }
    function writeSwitchJsonl(file, recs, extra) {
      extra = extra || {};
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
      if (extra.access) {
        fs.writeFileSync(file + ".access.json", JSON.stringify({ counts: extra.access }));
      }
      return file;
    }
    function closeQuiet(s) {
      try { if (s && typeof s.close === "function") s.close(); } catch { /* */ }
    }

    await atest("openStore jsonl-override stays JsonlStore (even with a sibling .db)", async () => {
      const jsonl = switchFixture("pin-jsonl");
      writeSwitchJsonl(jsonl, [
        { id: 1, text: "pinned jsonl", created: "2020-01-01T00:00:00.000Z" },
      ]);
      const db = new SqliteStore(sqlitePathFor(jsonl));
      db.add(normalize({ id: 99, text: "sqlite twin", created: "2021-01-01T00:00:00.000Z" }));
      db.close();
      const s = await openStore(jsonl, { backend: "jsonl", log() {} });
      assert.ok(s instanceof JsonlStore);
      assert.strictEqual(s.get(1).text, "pinned jsonl");
      assert.strictEqual(s.get(99), null, "must not dual-read the .db");
      assert.ok(fs.existsSync(jsonl), "pin must not bak the JSONL");
    });

    await atest("openStore .db-exists → SqliteStore (no JSONL)", async () => {
      const jsonl = switchFixture("db-only");
      const dbPath = sqlitePathFor(jsonl);
      const seed = new SqliteStore(dbPath);
      seed.add(normalize({
        id: 7, text: "already sqlite", created: "2019-09-09T09:09:09.000Z",
      }));
      seed.close();
      const s = await openStore(jsonl, { log() {} });
      assert.ok(s instanceof SqliteStore);
      assert.strictEqual(s.get(7).text, "already sqlite");
      assert.strictEqual(s.get(7).created, "2019-09-09T09:09:09.000Z");
      closeQuiet(s);
    });

    await atest("openStore .db + leftover JSONL finishes step 8 (never dual-read)", async () => {
      const jsonl = switchFixture("leftover");
      const dbPath = sqlitePathFor(jsonl);
      const seed = new SqliteStore(dbPath);
      seed.add(normalize({
        id: 1, text: "live db truth", created: "2020-01-01T00:00:00.000Z", embedding: [1, 0],
      }));
      seed.close();
      writeSwitchJsonl(jsonl, [
        { id: 99, text: "stale leftover — must not be read", created: "2026-01-01T00:00:00.000Z" },
      ]);
      const logs = [];
      const s = await openStore(jsonl, { log: (m) => logs.push(m) });
      assert.ok(s instanceof SqliteStore);
      assert.strictEqual(s.all().length, 1);
      assert.strictEqual(s.get(1).text, "live db truth");
      assert.strictEqual(s.get(99), null, "leftover JSONL was not dual-read");
      assert.ok(!fs.existsSync(jsonl), "JSONL renamed off MEMORY_FILE_PATH");
      assert.ok(fs.existsSync(jsonl + ".bak"), "recovery snapshot kept");
      assert.ok(logs.some((m) => /leftover JSONL renamed/.test(m)));
      closeQuiet(s);
    });

    await atest("openStore jsonl-only auto-migrates lossless then opens SqliteStore", async () => {
      const jsonl = switchFixture("auto");
      writeSwitchJsonl(jsonl, [
        {
          id: 1700000000001, text: "I work at Acme",
          created: "2020-06-15T12:34:56.000Z",
          embedding: [1, 0, 0.25], access_count: 2,
        },
        {
          id: 1700000000002, text: "I used to work at Globex",
          created: "2019-01-01T00:00:00.000Z",
          superseded_by: 1700000000001,
          valid_to: "2020-06-15T12:34:56.000Z",
          embedding: [0, 1, 0],
        },
        { id: 7, text: "vectorless", created: "2021-03-03T03:03:03.000Z" },
        { id: 8, text: "deleted", created: "2018-01-01T00:00:00.000Z", deleted: true, embedding: [0, 0, 1] },
      ], {
        access: {
          "1700000000001": { n: 3, last: "2026-09-01T00:00:00.000Z" },
          "7": { n: 1, last: "2026-09-02T00:00:00.000Z" },
        },
      });
      const logs = [];
      const s = await openStore(jsonl, { log: (m) => logs.push(m) });
      assert.ok(s instanceof SqliteStore, "auto-migrate destination is sqlite");
      assert.ok(fs.existsSync(sqlitePathFor(jsonl)));
      assert.ok(!fs.existsSync(jsonl), "JSONL at .bak");
      assert.ok(fs.existsSync(jsonl + ".bak"));
      assert.ok(!fs.existsSync(jsonl + ".access.json"), "access sidecar folded and bak'd");
      assert.strictEqual(s.all().length, 4);
      assert.strictEqual(Number(s.get(1700000000001).id), 1700000000001);
      assert.strictEqual(s.get(1700000000001).created, "2020-06-15T12:34:56.000Z");
      assert.strictEqual(s.get(1700000000001).access_count, 5, "in-row 2 + sidecar 3, folded ONCE");
      assert.strictEqual(s.get(7).embedding, null, "vectorless stays vectorless");
      assert.strictEqual(s.get(7).access_count, 1);
      assert.strictEqual(s.get(8).deleted, true);
      assert.ok(logs.some((m) => /migrated 4 memories; original kept at /.test(m)));
      closeQuiet(s);
    });

    await atest("openStore neither-exists → fresh SqliteStore", async () => {
      const jsonl = switchFixture("new-user");
      assert.ok(!fs.existsSync(jsonl));
      assert.ok(!fs.existsSync(sqlitePathFor(jsonl)));
      const s = await openStore(jsonl, { log() {} });
      assert.ok(s instanceof SqliteStore);
      assert.ok(fs.existsSync(sqlitePathFor(jsonl)), "creates the .db");
      assert.ok(!fs.existsSync(jsonl), "must not invent a JSONL");
      assert.strictEqual(s.all().length, 0);
      s.add(normalize({ id: 1, text: "first save", created: "2026-01-01T00:00:00.000Z" }));
      assert.strictEqual(s.get(1).text, "first save");
      closeQuiet(s);
    });

    await atest("FAILED auto-migrate falls back to JSONL; store intact; no half .db", async () => {
      const jsonl = switchFixture("fail-open");
      const recs = [
        { id: 1, text: "do not lose me", created: "2016-06-06T06:06:06.000Z", embedding: [1, 0] },
        { id: 2, text: "or me", created: "2017-07-07T07:07:07.000Z", embedding: [0, 1] },
      ];
      writeSwitchJsonl(jsonl, recs);
      const before = fs.readFileSync(jsonl, "utf8");
      const logs = [];
      const s = await openStore(jsonl, {
        log: (m) => logs.push(m),
        migrate: {
          async onBeforeRename() { throw new Error("simulated crash before step 7"); },
        },
      });
      assert.ok(s instanceof JsonlStore, "fail-open to JSONL");
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before, "JSONL bytes unchanged");
      assert.strictEqual(s.all().length, 2);
      assert.strictEqual(s.get(1).text, "do not lose me");
      const dbPath = sqlitePathFor(jsonl);
      assert.ok(!fs.existsSync(dbPath), "no half .db at MEMORY_FILE_PATH");
      assert.ok(!fs.existsSync(dbPath + ".migrating"), "temp cleaned");
      assert.ok(logs.some((m) => /auto-migrate failed/.test(m)));
      assert.ok(logs.some((m) => /opening JSONL/.test(m)));
    });

    await atest("second open after successful auto-migrate is a no-op", async () => {
      const jsonl = switchFixture("second-open");
      writeSwitchJsonl(jsonl, [
        { id: 1, text: "once", created: "2020-01-01T00:00:00.000Z", embedding: [1, 0] },
      ]);
      const first = await openStore(jsonl, { log() {} });
      assert.ok(first instanceof SqliteStore);
      assert.strictEqual(first.get(1).text, "once");
      closeQuiet(first);
      assert.ok(!fs.existsSync(jsonl));
      assert.ok(fs.existsSync(jsonl + ".bak"));
      const logs = [];
      const second = await openStore(jsonl, { log: (m) => logs.push(m) });
      assert.ok(second instanceof SqliteStore);
      assert.strictEqual(second.all().length, 1);
      assert.strictEqual(second.get(1).text, "once");
      assert.ok(!logs.some((m) => /migrated /.test(m)), "no second migrate");
      closeQuiet(second);
    });

    await atest("empty .db beside live JSONL is dropped and auto-migrated (not step-8)", async () => {
      const jsonl = switchFixture("empty-db-footgun");
      writeSwitchJsonl(jsonl, [
        { id: 3, text: "do not lose me", created: "2016-06-06T06:06:06.000Z" },
      ]);
      const dbPath = sqlitePathFor(jsonl);
      const empty = new SqliteStore(dbPath);
      assert.strictEqual(empty.rowCount(), 0);
      empty.close();
      const s = await openStore(jsonl, { log() {} });
      assert.ok(s instanceof SqliteStore);
      assert.strictEqual(s.get(3).text, "do not lose me");
      assert.ok(!fs.existsSync(jsonl), "JSONL migrated off the path");
      assert.ok(fs.existsSync(jsonl + ".bak"));
      closeQuiet(s);
    });

    await atest("count-mismatch auto-migrate fail-opens; JSONL intact", async () => {
      const jsonl = switchFixture("count-mismatch");
      writeSwitchJsonl(jsonl, [
        { id: 1, text: "a", created: "2020-01-01T00:00:00.000Z", embedding: [1, 0] },
        { id: 2, text: "b", created: "2020-01-01T00:00:00.000Z", embedding: [0, 1] },
      ]);
      const before = fs.readFileSync(jsonl, "utf8");
      const s = await openStore(jsonl, {
        log() {},
        migrate: {
          onAfterIngest(store) {
            store.db.exec("DELETE FROM memories WHERE id = 1");
          },
        },
      });
      assert.ok(s instanceof JsonlStore);
      assert.strictEqual(fs.readFileSync(jsonl, "utf8"), before);
      assert.strictEqual(s.all().length, 2);
      assert.ok(!fs.existsSync(sqlitePathFor(jsonl)));
    });
  }

  section("RM-07 slice 2b — export bundle (read-only, golden-safe)");

  {
    const { spawn, spawnSync } = require("child_process");
    const { JsonlStore } = require("./store.js");

    function stamp(p) {
      if (!p || !fs.existsSync(p)) return null;
      const st = fs.statSync(p);
      const buf = fs.readFileSync(p);
      return st.size + ":" + st.mtimeMs + ":" + require("crypto").createHash("sha256").update(buf).digest("hex");
    }
    function storeStamp(file) {
      return {
        store: stamp(file),
        edges: stamp(file + ".edges.json"),
        access: stamp(file + ".access.json"),
        db: stamp(file.replace(/\.jsonl$/i, ".db")),
        wal: stamp(file.replace(/\.jsonl$/i, ".db-wal")),
      };
    }

    function seedExportStore(name) {
      const file = tmp("export-" + name + ".jsonl");
      const store = new JsonlStore(file);
      store.add(normalize({
        id: 1, text: "I prefer tea", created: "2026-03-05T12:00:00.000Z",
        embedding: [0.1, 0.2, 0.3],
      }));
      store.add(normalize({
        id: 2, text: "I used to prefer coffee", created: "2026-03-05T13:00:00.000Z",
        embedding: [0.2, 0.1, 0.3], superseded_by: 1, valid_to: "2026-03-05T12:00:00.000Z",
      }));
      store.add(normalize({
        id: 3, text: "old secret I deleted", created: "2026-01-09T00:00:00.000Z",
        embedding: [0.0, 0.1, 0.0], deleted: true,
      }));
      store.add(normalize({
        id: 4, text: "记忆测试", created: "2026-03-05T14:00:00.000Z",
        embedding: [0.4, 0.1, 0.1],
      }));
      store.add(normalize({
        id: 5, text: "CON", created: "2026-03-05T15:00:00.000Z",
        embedding: [0.5, 0.1, 0.1],
      }));
      const { EdgeStore, makeEdge } = require("./edges.js");
      const E = new EdgeStore(file + ".edges.json");
      E.put(makeEdge(1, 2, { origin: "co-activation", now: "2026-03-05T12:00:00.000Z", hebbianWeight: 0.42 }));
      E.processedIds = ["rpc-should-not-export"];
      E.save();
      return { file, store };
    }

    await atest("export zip: whole store incl deleted+superseded, layout, catalog, edges, README", async () => {
      const { file } = seedExportStore("full");
      const outDir = tmp("export-out-full");
      fs.mkdirSync(outDir, { recursive: true });
      const result = await exp.runExport({
        mode: "zip", name: "bundle", outDir, storePath: file,
      });
      assert.ok(fs.existsSync(result.path));
      const z = ZipReader.open(result.path);
      const names = z.names();
      const root = "bundle";
      assert.ok(names.indexOf(root + "/README.txt") >= 0);
      assert.ok(names.indexOf(root + "/manifest.json") >= 0);
      assert.ok(names.indexOf(root + "/catalog.txt") >= 0);
      assert.ok(names.indexOf(root + "/edges.json") >= 0);
      assert.ok(names.indexOf(root + "/memories.jsonl") >= 0);
      const man = JSON.parse(z.readStored(root + "/manifest.json").toString("utf8"));
      assert.strictEqual(man.layout, "memories/YYYY/MM/DD");
      assert.strictEqual(man.count.total, 5);
      assert.strictEqual(man.count.current, 3, "tea + CJK + CON");
      assert.strictEqual(man.count.superseded, 1);
      assert.strictEqual(man.count.deleted, 1);
      const jsonl = z.readStored(root + "/memories.jsonl").toString("utf8").trim().split("\n");
      assert.strictEqual(jsonl.length, 5, "jsonl is the whole store, not current() only");
      const recs = jsonl.map((l) => JSON.parse(l));
      assert.ok(recs.some((r) => r.deleted));
      assert.ok(recs.some((r) => r.superseded_by));
      assert.ok(recs.every((r) => Array.isArray(r.embedding) || r.embedding === null));
      const teaPath = root + "/memories/2026/03/05/1-i-prefer-tea.json";
      const cjkPath = root + "/memories/2026/03/05/4-记忆测试.json";
      const reservedPath = root + "/memories/2026/03/05/5.json";
      const deletedPath = root + "/memories/2026/01/09/3-old-secret-i-deleted.json";
      assert.ok(z.has(teaPath), "day-granular created path");
      assert.ok(z.has(cjkPath), "CJK slug preserved (UTF-8 flag)");
      assert.ok(z.has(reservedPath), "CON → <id>.json");
      assert.ok(z.has(deletedPath), "deleted memory still has a human file");
      const human = JSON.parse(z.readStored(teaPath).toString("utf8"));
      assert.strictEqual("embedding" in human, false, "human file has no vectors");
      assert.strictEqual(human.text, "I prefer tea");
      const catalog = z.readStored(root + "/catalog.txt").toString("utf8");
      const catLines = catalog.trim().split("\n");
      assert.strictEqual(catLines[0].split("\t")[3], "path");
      for (const line of catLines.slice(1)) {
        const cols = line.split("\t");
        assert.strictEqual(cols.length, 6, "catalog columns");
        assert.ok(z.has(cols[3]), "catalog path resolves: " + cols[3]);
      }
      const edges = JSON.parse(z.readStored(root + "/edges.json").toString("utf8"));
      assert.ok(edges.edges);
      const ev = Object.values(edges.edges)[0];
      assert.ok(ev && ev.hebbian && ev.hebbian.weight > 0, "Hebbian weight carried");
      assert.strictEqual("processed_ids" in edges, false, "runtime LRU stays out");
      const readme = z.readStored(root + "/README.txt").toString("utf8");
      assert.ok(/you own/i.test(readme));
      assert.ok(hasZip64Eocd(result.path));
    });

    await atest("export mutates NOTHING (store bytes unchanged)", async () => {
      const { file } = seedExportStore("readonly");
      const before = storeStamp(file);
      const outDir = tmp("export-out-ro");
      fs.mkdirSync(outDir, { recursive: true });
      await exp.runExport({ mode: "zip", name: "ro", outDir, storePath: file });
      assert.deepStrictEqual(storeStamp(file), before);
    });

    await atest("export never overwrites an existing zip", async () => {
      const { file } = seedExportStore("ow");
      const outDir = tmp("export-out-ow");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "mine.zip"), "keep-me");
      const result = await exp.runExport({ mode: "zip", name: "mine", outDir, storePath: file });
      assert.strictEqual(path.basename(result.path), "mine (2).zip");
      assert.strictEqual(fs.readFileSync(path.join(outDir, "mine.zip"), "utf8"), "keep-me");
    });

    await atest("--export-jsonl is the raw scripting primitive (not replaced by the zip)", async () => {
      const { file } = seedExportStore("jsonl");
      const outDir = tmp("export-out-jsonl");
      fs.mkdirSync(outDir, { recursive: true });
      const result = await exp.runExport({
        mode: "jsonl", name: "raw", outFile: outDir, storePath: file,
      });
      assert.ok(result.path.endsWith(".jsonl"));
      const lines = fs.readFileSync(result.path, "utf8").trim().split("\n");
      assert.strictEqual(lines.length, 5);
      const recs = lines.map((l) => JSON.parse(l));
      assert.strictEqual(recs[0].text, "I prefer tea");
      assert.ok(Array.isArray(recs[0].embedding));
    });

    await atest("CLI --export (entry.js) is not a fifth verb; --export-jsonl stays its own flag", async () => {
      const { file } = seedExportStore("cli");
      const outDir = tmp("export-out-cli");
      fs.mkdirSync(outDir, { recursive: true });
      const entry = path.join(__dirname, "entry.js");
      const zip = spawnSync(process.execPath, [
        entry, "--export", "--json", "--name", "cli-bundle", "--out", outDir, file,
      ], { encoding: "utf8" });
      assert.strictEqual(zip.status, 0, zip.stderr || zip.stdout);
      const z = JSON.parse(zip.stdout);
      assert.ok(z.path && fs.existsSync(z.path));
      assert.strictEqual(z.count.total, 5);
      const raw = spawnSync(process.execPath, [
        entry, "--export-jsonl", "--json", "--name", "cli-raw", "--out", outDir, file,
      ], { encoding: "utf8" });
      assert.strictEqual(raw.status, 0, raw.stderr || raw.stdout);
      const j = JSON.parse(raw.stdout);
      assert.ok(j.path.endsWith(".jsonl"));
      assert.strictEqual(j.count, 5);
    });

    await atest("killed export leaves .zip.tmp, never a valid-looking truncated zip", async () => {
      const { file } = seedExportStore("kill");
      const outDir = tmp("export-out-kill");
      fs.mkdirSync(outDir, { recursive: true });
      const ready = tmp("export-kill.ready");
      const child = spawn(process.execPath, [
        path.join(__dirname, "export-memory.js"),
        "--export", "--name", "killed", "--out", outDir, file,
      ], {
        env: Object.assign({}, process.env, {
          RM_EXPORT_CRASH_AFTER: "1",
          RM_EXPORT_CRASH_READY: ready,
        }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      const t0 = Date.now();
      while (!fs.existsSync(ready)) {
        if (Date.now() - t0 > 15000) {
          try { child.kill("SIGKILL"); } catch { /* */ }
          throw new Error("export crash-child never wrote ready: " +
            String(child.stderr && child.stderr.read()));
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      child.kill("SIGKILL");
      await new Promise((resolve) => {
        if (child.exitCode != null || child.signalCode) return resolve();
        child.on("exit", resolve);
        setTimeout(resolve, 5000);
      });
      const dest = path.join(outDir, "killed.zip");
      assert.ok(!fs.existsSync(dest), "no dest zip that looks valid");
      assert.ok(fs.existsSync(dest + ".tmp"), "leftover is the .tmp");
    });

    if (sqliteAvailable()) {
      await atest("sqlite export is read-only (no WAL checkpoint, bytes unchanged)", async () => {
        const dir = tmp("export-sqlite");
        fs.mkdirSync(dir, { recursive: true });
        const dbPath = path.join(dir, "mem.db");
        const s = new SqliteStore(dbPath);
        s.add(normalize({
          id: 1, text: "sqlite tea", created: "2026-04-01T00:00:00.000Z",
          embedding: [1, 0, 0],
        }));
        s.close();
        const before = stamp(dbPath);
        const walBefore = fs.existsSync(dbPath + "-wal") ? stamp(dbPath + "-wal") : null;
        const outDir = path.join(dir, "out");
        fs.mkdirSync(outDir, { recursive: true });
        const result = await exp.runExport({
          mode: "zip", name: "sql", outDir, storePath: dbPath,
        });
        assert.ok(fs.existsSync(result.path));
        assert.strictEqual(stamp(dbPath), before, ".db bytes unchanged");
        const z = ZipReader.open(result.path);
        assert.ok(z.has("sql/memories/2026/04/01/1-sqlite-tea.json"));
        const jsonl = z.readStored("sql/memories.jsonl").toString("utf8").trim();
        const rec = JSON.parse(jsonl);
        assert.strictEqual(rec.text, "sqlite tea");
        assert.ok(Array.isArray(rec.embedding));
        void walBefore;
      });

      await atest("sqlite export sources edges.json from the table (not a sidecar)", async () => {
        const dir = tmp("export-sqlite-edges");
        fs.mkdirSync(dir, { recursive: true });
        const jsonl = path.join(dir, "mem.jsonl");
        const dbPath = path.join(dir, "mem.db");
        const s = new SqliteStore(dbPath);
        s.add(normalize({
          id: 1, text: "sqlite tea", created: "2026-04-01T00:00:00.000Z",
          embedding: [1, 0, 0],
        }));
        const E = openEdgeStore({ store: s, storePath: jsonl });
        E.put(makeEdge(1, 2, {
          origin: "co-activation", now: "2026-04-01T00:00:00.000Z", hebbianWeight: 0.42,
        }));
        E.processedIds = ["rpc-should-not-export"];
        E._processedDirty = true;
        E.save();
        s.checkpoint();
        s.close();
        const outDir = path.join(dir, "out");
        fs.mkdirSync(outDir, { recursive: true });
        const result = await exp.runExport({
          mode: "zip", name: "sqe", outDir, storePath: jsonl,
        });
        const z = ZipReader.open(result.path);
        const edges = JSON.parse(z.readStored("sqe/edges.json").toString("utf8"));
        const ev = Object.values(edges.edges)[0];
        assert.ok(ev && ev.hebbian && ev.hebbian.weight === 0.42, "Hebbian weight from the table");
        assert.strictEqual("processed_ids" in edges, false, "runtime LRU stays out");
        assert.ok(!fs.existsSync(jsonl + ".edges.json"), "no sidecar; the .db carried the edges");
      });
    }
  }

  section("RM-07 slice 2c — panel export button (route-level, golden-safe)");

  {
    const { spawn } = require("child_process");
    const net = require("net");
    const { ZipReader } = require("./zip.js");
    const { JsonlStore } = require("./store.js");

    function freePort() {
      return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once("error", reject);
        s.listen(0, "127.0.0.1", () => {
          const p = s.address().port;
          s.close((err) => err ? reject(err) : resolve(p));
        });
      });
    }

    async function startPanelChild(opts) {
      opts = opts || {};
      const home = opts.home || tmp("panel-home-" + Math.random().toString(36).slice(2));
      const desktop = path.join(home, "Desktop");
      fs.mkdirSync(desktop, { recursive: true });
      const store = opts.store || path.join(home, "resonance-memory.jsonl");
      const port = opts.port || await freePort();
      const hold = opts.hold || null;
      const env = Object.assign({}, process.env, {
        MEMORY_FILE_PATH: store,
        USERPROFILE: home,
        HOME: home,
        RESONANCE_MEMORY_PANEL_PORT: String(port),
        RESONANCE_MEMORY_NO_OPEN: "1",
        RESONANCE_STORE: opts.storeBackend || "jsonl",
      });
      delete env.RESONANCE_MEMORY_CONFIG;
      if (opts.watchdogMs) env.RESONANCE_MEMORY_WATCHDOG_MS = String(opts.watchdogMs);
      if (hold) env.RM_PANEL_EXPORT_HOLD = hold;
      if (opts.importHold) env.RM_PANEL_IMPORT_HOLD = opts.importHold;
      const child = spawn(process.execPath, [path.join(__dirname, "panel.js")], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const url = "http://127.0.0.1:" + port;
      const t0 = Date.now();
      let lastErr = null;
      while (Date.now() - t0 < 12000) {
        if (child.exitCode != null) {
          const err = String(child.stderr && child.stderr.read() || "");
          throw new Error("panel exited early (" + child.exitCode + "): " + err);
        }
        try {
          const r = await fetch(url + "/");
          if (r.ok) {
            return { child, port, url, home, desktop, store };
          }
        } catch (e) { lastErr = e; }
        await new Promise((r) => setTimeout(r, 40));
      }
      try { child.kill("SIGKILL"); } catch { /* */ }
      throw new Error("panel did not start: " + String(lastErr && lastErr.message || lastErr));
    }

    async function stopPanelChild(child) {
      if (!child) return;
      try { child.kill("SIGKILL"); } catch { /* */ }
      await new Promise((resolve) => {
        if (child.exitCode != null || child.signalCode) return resolve();
        child.on("exit", resolve);
        setTimeout(resolve, 3000);
      });
    }

    async function readPanelToken(url) {
      const html = await (await fetch(url + "/")).text();
      const m = html.match(/RM_PANEL_TOKEN = "([a-f0-9]+)"/);
      assert.ok(m, "per-process token is in the page (W-02)");
      return m[1];
    }
    function panelPostHeaders(token, extra) {
      return Object.assign({
        "Content-Type": "application/json",
        "X-Resonance-Token": token,
      }, extra || {});
    }

    await atest("previewExport: empty store, count 0, dest on Desktop, no write", async () => {
      const home = tmp("preview-home");
      fs.mkdirSync(path.join(home, "Desktop"), { recursive: true });
      const store = path.join(home, "resonance-memory.jsonl");
      const origHome = process.env.USERPROFILE;
      const origHome2 = process.env.HOME;
      process.env.USERPROFILE = home;
      process.env.HOME = home;
      try {
        const p = await exp.previewExport(store);
        assert.strictEqual(p.count.total, 0);
        assert.strictEqual(p.count.current, 0);
        assert.ok(p.destPath.indexOf(path.join(home, "Desktop")) === 0, "Desktop default: " + p.destPath);
        assert.ok(!fs.existsSync(p.destPath), "preview writes no zip");
        assert.ok(!fs.existsSync(store), "preview does not create the store");
      } finally {
        if (origHome == null) delete process.env.USERPROFILE; else process.env.USERPROFILE = origHome;
        if (origHome2 == null) delete process.env.HOME; else process.env.HOME = origHome2;
      }
    });

    await atest("previewExport: current vs history + estimate, store bytes unchanged", async () => {
      const file = tmp("preview-counts.jsonl");
      const store = new JsonlStore(file);
      store.add(normalize({ id: 1, text: "current tea", created: "2026-03-05T12:00:00.000Z" }));
      store.add(normalize({
        id: 2, text: "old coffee", created: "2026-03-05T11:00:00.000Z",
        superseded_by: 1, valid_to: "2026-03-05T12:00:00.000Z",
      }));
      store.add(normalize({ id: 3, text: "deleted", created: "2026-01-01T00:00:00.000Z", deleted: true }));
      const before = fs.readFileSync(file);
      const p = await exp.previewExport(file, { outDir: tmp("preview-out") });
      assert.strictEqual(p.count.total, 3);
      assert.strictEqual(p.count.current, 1);
      assert.strictEqual(p.count.superseded, 1);
      assert.strictEqual(p.count.deleted, 1);
      assert.ok(p.estimateBytes > 0);
      assert.deepStrictEqual(fs.readFileSync(file), before, "preview is read-only");
    });

    await atest("GET /api/export preview + POST writes zip, empty store, never demo-seed", async () => {
      const panel = await startPanelChild();
      try {
        const page = await (await fetch(panel.url + "/")).text();
        assert.ok(page.includes("Export my memories"));
        assert.ok(/read-only/i.test(page));
        const prev = await (await fetch(panel.url + "/api/export")).json();
        assert.strictEqual(prev.demo, false);
        assert.strictEqual(prev.busy, false);
        assert.strictEqual(prev.count.total, 0);
        assert.strictEqual(prev.storePath, panel.store);
        assert.ok(prev.destPath.indexOf(panel.desktop) === 0, prev.destPath);
        const token = await readPanelToken(panel.url);
        const posted = await fetch(panel.url + "/api/export", {
          method: "POST", headers: panelPostHeaders(token), body: "{}",
        });
        const body = await posted.json();
        assert.strictEqual(posted.status, 200, JSON.stringify(body));
        assert.strictEqual(body.ok, true);
        assert.ok(body.path && fs.existsSync(body.path), "zip written");
        assert.strictEqual(body.demo, false);
        assert.strictEqual(body.storePath, panel.store);
        assert.ok(body.path.indexOf("Nightfall") < 0);
        const z = ZipReader.open(body.path);
        const names = z.names();
        const readme = names.find((n) => n.endsWith("/README.txt"));
        const jsonlName = names.find((n) => n.endsWith("/memories.jsonl"));
        assert.ok(readme, "empty store still writes README");
        assert.ok(jsonlName, "empty store still writes memories.jsonl");
        const jsonl = z.readStored(jsonlName).toString("utf8");
        assert.ok(!/Nightfall/.test(jsonl), "export is the user store, never demo-seed");
        assert.strictEqual(jsonl.trim(), "", "empty jsonl");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("POST /api/export exports the USER store (not demo-seed) and is read-only", async () => {
      const home = tmp("panel-user-home");
      const store = path.join(home, "resonance-memory.jsonl");
      fs.mkdirSync(home, { recursive: true });
      const js = new JsonlStore(store);
      js.add(normalize({
        id: 42, text: "user-only-panel-export-xyz", created: "2026-03-05T12:00:00.000Z",
        embedding: [0.1, 0.2, 0.3],
      }));
      const before = fs.readFileSync(store);
      const panel = await startPanelChild({ home, store });
      try {
        const token = await readPanelToken(panel.url);
        const posted = await fetch(panel.url + "/api/export", {
          method: "POST", headers: panelPostHeaders(token), body: "{}",
        });
        const body = await posted.json();
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.count.total, 1);
        assert.deepStrictEqual(fs.readFileSync(store), before, "export is read-only");
        const z = ZipReader.open(body.path);
        const jsonlName = z.names().find((n) => n.endsWith("/memories.jsonl"));
        const jsonl = z.readStored(jsonlName).toString("utf8");
        assert.ok(jsonl.indexOf("user-only-panel-export-xyz") >= 0);
        assert.ok(!/Nightfall/.test(jsonl), "demo-seed must not leak into the user export");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("in-flight POST returns 409; watchdog is paused; pings still answered", async () => {
      const hold = tmp("panel-export.hold");
      try { if (fs.existsSync(hold)) fs.unlinkSync(hold); } catch { /* */ }
      const panel = await startPanelChild({ hold, watchdogMs: 400 });
      try {
        const token = await readPanelToken(panel.url);
        await fetch(panel.url + "/api/ping", { method: "POST", headers: panelPostHeaders(token) });
        const first = fetch(panel.url + "/api/export", {
          method: "POST", headers: panelPostHeaders(token), body: "{}",
        });
        const t0 = Date.now();
        let preview = null;
        while (Date.now() - t0 < 5000) {
          preview = await (await fetch(panel.url + "/api/export")).json();
          if (preview.busy && preview.watchdog_paused) break;
          await new Promise((r) => setTimeout(r, 30));
        }
        assert.ok(preview && preview.busy, "in-flight is server-observable");
        assert.ok(preview.watchdog_paused, "watchdog paused for the duration");
        const dup = await fetch(panel.url + "/api/export", {
          method: "POST", headers: panelPostHeaders(token), body: "{}",
        });
        assert.strictEqual(dup.status, 409);
        const dupBody = await dup.json();
        assert.strictEqual(dupBody.code, "busy");
        const ping = await fetch(panel.url + "/api/ping", { method: "POST", headers: panelPostHeaders(token) });
        assert.strictEqual(ping.status, 200, "yield/pause: ping is answered in-flight");
        // connectedOnce is set; if pause were missing the 400ms watchdog
        // would have killed the process. Wait well past that, no pings.
        await new Promise((r) => setTimeout(r, 1200));
        assert.strictEqual(panel.child.exitCode, null, "paused watchdog must not process.exit");
        const still = await (await fetch(panel.url + "/api/export")).json();
        assert.strictEqual(still.busy, true);
        assert.strictEqual(still.watchdog_paused, true);
        fs.writeFileSync(hold, "go\n");
        const result = await first;
        const body = await result.json();
        assert.strictEqual(result.status, 200, JSON.stringify(body));
        assert.strictEqual(body.ok, true);
        assert.ok(fs.existsSync(body.path));
        const after = await (await fetch(panel.url + "/api/export")).json();
        assert.strictEqual(after.busy, false);
        assert.strictEqual(after.watchdog_paused, false);
      } finally {
        try { fs.writeFileSync(hold, "go\n"); } catch { /* */ }
        await stopPanelChild(panel.child);
      }
    });

    if (sqliteAvailable()) {
      await atest("panel export works on SqliteStore (same engine, user store)", async () => {
        const home = tmp("panel-sqlite-home");
        fs.mkdirSync(path.join(home, "Desktop"), { recursive: true });
        const jsonl = path.join(home, "resonance-memory.jsonl");
        const { SqliteStore } = require("./store-sqlite.js");
        const { sqlitePathFor } = require("./store.js");
        const dbPath = sqlitePathFor(jsonl);
        const s = new SqliteStore(dbPath);
        s.add(normalize({
          id: 7, text: "sqlite panel export", created: "2026-04-01T00:00:00.000Z",
          embedding: [1, 0, 0],
        }));
        s.close();
        const panel = await startPanelChild({ home, store: jsonl, storeBackend: "sqlite" });
        try {
          const prev = await (await fetch(panel.url + "/api/export")).json();
          assert.strictEqual(prev.backend, "sqlite");
          assert.ok(prev.count.total >= 1);
          const token = await readPanelToken(panel.url);
          const posted = await fetch(panel.url + "/api/export", {
            method: "POST", headers: panelPostHeaders(token), body: "{}",
          });
          const body = await posted.json();
          assert.strictEqual(body.ok, true, JSON.stringify(body));
          const z = ZipReader.open(body.path);
          const jsonlName = z.names().find((n) => n.endsWith("/memories.jsonl"));
          const text = z.readStored(jsonlName).toString("utf8");
          assert.ok(text.indexOf("sqlite panel export") >= 0);
        } finally {
          await stopPanelChild(panel.child);
        }
      });
    }

    await atest("W-02: POST without token is 403 forbidden_csrf", async () => {
      const panel = await startPanelChild();
      try {
        const posted = await fetch(panel.url + "/api/ping", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        assert.strictEqual(posted.status, 403);
        const body = await posted.json();
        assert.strictEqual(body.code, "forbidden_csrf");
        assert.strictEqual(body.ok, false);
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("W-02: POST with wrong token is 403; GET still works", async () => {
      const panel = await startPanelChild();
      try {
        const posted = await fetch(panel.url + "/api/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Resonance-Token": "deadbeef" },
          body: "{}",
        });
        assert.strictEqual(posted.status, 403);
        const body = await posted.json();
        assert.strictEqual(body.code, "forbidden_csrf");
        const page = await fetch(panel.url + "/");
        assert.strictEqual(page.status, 200, "GET / does not need the token");
        const prev = await fetch(panel.url + "/api/export");
        assert.strictEqual(prev.status, 200, "GET preview does not need the token");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("W-02: Origin from another site is 403 even with a valid token", async () => {
      const panel = await startPanelChild();
      try {
        const token = await readPanelToken(panel.url);
        const posted = await fetch(panel.url + "/api/ping", {
          method: "POST",
          headers: panelPostHeaders(token, { Origin: "http://evil.example" }),
          body: "{}",
        });
        assert.strictEqual(posted.status, 403);
        const body = await posted.json();
        assert.strictEqual(body.code, "forbidden_origin");
        const leaked = await fetch(panel.url + "/api/export", {
          headers: { Origin: "http://evil.example" },
        });
        assert.strictEqual(leaked.status, 403, "cross-origin GET is refused too (DNS-rebinding cousin)");
        const leakedBody = await leaked.json();
        assert.strictEqual(leakedBody.code, "forbidden_origin");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("W-02: same-origin Origin + token is allowed; no CORS header", async () => {
      const panel = await startPanelChild();
      try {
        const token = await readPanelToken(panel.url);
        const origin = "http://127.0.0.1:" + panel.port;
        const posted = await fetch(panel.url + "/api/ping", {
          method: "POST",
          headers: panelPostHeaders(token, { Origin: origin }),
          body: "{}",
        });
        assert.strictEqual(posted.status, 200);
        assert.strictEqual(posted.headers.get("access-control-allow-origin"), null,
          "no ACAO — a browser on another origin cannot read the response");
        const state = await fetch(panel.url + "/api/state", { headers: { Origin: origin } });
        assert.strictEqual(state.status, 200);
        assert.strictEqual(state.headers.get("access-control-allow-origin"), null);
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("W-02: Host: evil.example is 403 (DNS rebinding)", async () => {
      const http = require("http");
      const panel = await startPanelChild();
      try {
        const token = await readPanelToken(panel.url);
        const body = await new Promise((resolve, reject) => {
          const req = http.request({
            host: "127.0.0.1",
            port: panel.port,
            path: "/api/ping",
            method: "POST",
            headers: {
              host: "evil.example",
              "Content-Type": "application/json",
              "X-Resonance-Token": token,
              "Content-Length": 2,
            },
          }, (res) => {
            let raw = "";
            res.setEncoding("utf8");
            res.on("data", (c) => { raw += c; });
            res.on("end", () => resolve({ status: res.statusCode, raw }));
          });
          req.on("error", reject);
          req.write("{}");
          req.end();
        });
        assert.strictEqual(body.status, 403);
        const parsed = JSON.parse(body.raw);
        assert.strictEqual(parsed.code, "forbidden_host");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    function seedPanelImportSrc(name) {
      const file = tmp("panel-import-src-" + name + ".jsonl");
      const store = new JsonlStore(file);
      store.add(normalize({
        id: 1, text: "panel-import-tea-" + name, created: "2026-03-05T12:00:00.000Z",
        embedding: [0.1, 0.2, 0.3],
      }));
      store.add(normalize({
        id: 2, text: "panel-import-coffee-" + name, created: "2026-03-05T11:00:00.000Z",
        embedding: [0.2, 0.1, 0.3], superseded_by: 1,
      }));
      const { EdgeStore, makeEdge } = require("./edges.js");
      const E = new EdgeStore(file + ".edges.json");
      E.put(makeEdge(1, 2, {
        origin: "co-activation", now: "2026-03-05T12:00:00.000Z", hebbianWeight: 0.42,
      }));
      E.save();
      return file;
    }
    async function zipForPanelImport(name) {
      const file = seedPanelImportSrc(name);
      const outDir = tmp("panel-import-zip-" + name);
      fs.mkdirSync(outDir, { recursive: true });
      return exp.runExport({ mode: "zip", name, outDir, storePath: file });
    }

    await atest("GET /api/import dest snapshot; with-edges default false; pick is no_dialog", async () => {
      const panel = await startPanelChild();
      try {
        const page = await (await fetch(panel.url + "/")).text();
        assert.ok(page.includes("Import memories"));
        assert.ok(/planted sidecar is an injection path/.test(page));
        const snap = await (await fetch(panel.url + "/api/import")).json();
        assert.strictEqual(snap.withEdgesDefault, false);
        assert.strictEqual(snap.destEmpty, true);
        assert.strictEqual(snap.destCount, 0);
        assert.strictEqual(snap.busy, false);
        assert.ok(!fs.existsSync(panel.store), "GET must not mint the dest store");
        const token = await readPanelToken(panel.url);
        const pick = await fetch(panel.url + "/api/import/pick", {
          method: "POST", headers: panelPostHeaders(token), body: "{}",
        });
        const pickBody = await pick.json();
        assert.strictEqual(pick.status, 200);
        assert.strictEqual(pickBody.code, "no_dialog");
        const noToken = await fetch(panel.url + "/api/import", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "x.zip", apply: true }),
        });
        assert.strictEqual(noToken.status, 403);
        assert.strictEqual((await noToken.json()).code, "forbidden_csrf");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("POST /api/import dry-run writes nothing; apply restores; with-edges opt-in", async () => {
      const zip = await zipForPanelImport("apply");
      const panel = await startPanelChild();
      const token = await readPanelToken(panel.url);
      try {
        const dry = await fetch(panel.url + "/api/import", {
          method: "POST", headers: panelPostHeaders(token),
          body: JSON.stringify({ source: zip.path, apply: false }),
        });
        const plan = await dry.json();
        assert.strictEqual(dry.status, 200);
        assert.strictEqual(plan.apply, false);
        assert.strictEqual(plan.ok, true);
        assert.strictEqual(plan.willAdd, 2);
        assert.strictEqual(plan.withEdges, false);
        assert.ok(!fs.existsSync(panel.store), "dry-run must not create dest");
        const applied = await fetch(panel.url + "/api/import", {
          method: "POST", headers: panelPostHeaders(token),
          body: JSON.stringify({ source: zip.path, apply: true }),
        });
        const body = await applied.json();
        assert.strictEqual(applied.status, 200, JSON.stringify(body));
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.apply, true);
        assert.strictEqual(body.added, 2);
        assert.strictEqual(body.edgesRestored, 0, "Hebbian is opt-in");
        const recs = new JsonlStore(panel.store).all();
        assert.ok(recs.some((r) => r.text === "panel-import-tea-apply"));
        assert.ok(recs.some((r) => r.superseded_by === 1));
        assert.ok(!fs.existsSync(panel.store + ".edges.json"), "no silent Hebbian bless");

        const home2 = tmp("panel-import-heb-home");
        fs.mkdirSync(path.join(home2, "Desktop"), { recursive: true });
        const store2 = path.join(home2, "resonance-memory.jsonl");
        const panel2 = await startPanelChild({ home: home2, store: store2 });
        try {
          const token2 = await readPanelToken(panel2.url);
          const heb = await fetch(panel2.url + "/api/import", {
            method: "POST", headers: panelPostHeaders(token2),
            body: JSON.stringify({ source: zip.path, apply: true, withEdges: true }),
          });
          const hebBody = await heb.json();
          assert.strictEqual(hebBody.ok, true, JSON.stringify(hebBody));
          assert.strictEqual(hebBody.edgesRestored, 1);
          const { EdgeStore } = require("./edges.js");
          const E = new EdgeStore(store2 + ".edges.json");
          const e = E.get(1, 2);
          assert.ok(e && e.hebbian && e.hebbian.weight === 0.42);
        } finally {
          await stopPanelChild(panel2.child);
        }
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("POST /api/import nonempty dest without merge is refused; dest unchanged", async () => {
      const zip = await zipForPanelImport("nomerge");
      const home = tmp("panel-import-nomerge-home");
      fs.mkdirSync(path.join(home, "Desktop"), { recursive: true });
      const store = path.join(home, "resonance-memory.jsonl");
      const live = new JsonlStore(store);
      live.add(normalize({
        id: 99, text: "already-here-panel", created: "2026-02-01T00:00:00.000Z",
        embedding: [0, 1, 0],
      }));
      const before = fs.readFileSync(store);
      const panel = await startPanelChild({ home, store });
      try {
        const token = await readPanelToken(panel.url);
        const posted = await fetch(panel.url + "/api/import", {
          method: "POST", headers: panelPostHeaders(token),
          body: JSON.stringify({ source: zip.path, apply: true }),
        });
        const body = await posted.json();
        assert.strictEqual(body.ok, false);
        assert.strictEqual(body.code, "IMPORT_DEST_NONEMPTY");
        assert.deepStrictEqual(fs.readFileSync(store), before, "dest unchanged");
      } finally {
        await stopPanelChild(panel.child);
      }
    });

    await atest("POST /api/import in-flight returns 409; watchdog paused", async () => {
      const zip = await zipForPanelImport("hold");
      const hold = tmp("panel-import.hold");
      try { if (fs.existsSync(hold)) fs.unlinkSync(hold); } catch { /* */ }
      const panel = await startPanelChild({ importHold: hold, watchdogMs: 400 });
      try {
        const token = await readPanelToken(panel.url);
        await fetch(panel.url + "/api/ping", { method: "POST", headers: panelPostHeaders(token) });
        const first = fetch(panel.url + "/api/import", {
          method: "POST", headers: panelPostHeaders(token),
          body: JSON.stringify({ source: zip.path, apply: true }),
        });
        const t0 = Date.now();
        let snap = null;
        while (Date.now() - t0 < 5000) {
          snap = await (await fetch(panel.url + "/api/import")).json();
          if (snap.busy && snap.watchdog_paused) break;
          await new Promise((r) => setTimeout(r, 30));
        }
        assert.ok(snap && snap.busy, "in-flight is server-observable");
        assert.ok(snap.watchdog_paused, "watchdog paused for the duration");
        const dup = await fetch(panel.url + "/api/import", {
          method: "POST", headers: panelPostHeaders(token),
          body: JSON.stringify({ source: zip.path, apply: true }),
        });
        assert.strictEqual(dup.status, 409);
        assert.strictEqual((await dup.json()).code, "busy");
        const ping = await fetch(panel.url + "/api/ping", { method: "POST", headers: panelPostHeaders(token) });
        assert.strictEqual(ping.status, 200);
        await new Promise((r) => setTimeout(r, 1200));
        assert.strictEqual(panel.child.exitCode, null, "paused watchdog must not process.exit");
        fs.writeFileSync(hold, "go\n");
        const result = await first;
        const body = await result.json();
        assert.strictEqual(body.ok, true, JSON.stringify(body));
        assert.strictEqual(body.added, 2);
        const after = await (await fetch(panel.url + "/api/import")).json();
        assert.strictEqual(after.busy, false);
        assert.strictEqual(after.watchdog_paused, false);
      } finally {
        try { fs.writeFileSync(hold, "go\n"); } catch { /* */ }
        await stopPanelChild(panel.child);
      }
    });

    if (sqliteAvailable()) {
      await atest("panel import works on SqliteStore (same engine, user store)", async () => {
        const zip = await zipForPanelImport("sqlite");
        const home = tmp("panel-import-sqlite-home");
        fs.mkdirSync(path.join(home, "Desktop"), { recursive: true });
        const jsonl = path.join(home, "resonance-memory.jsonl");
        const panel = await startPanelChild({ home, store: jsonl, storeBackend: "sqlite" });
        try {
          const token = await readPanelToken(panel.url);
          const posted = await fetch(panel.url + "/api/import", {
            method: "POST", headers: panelPostHeaders(token),
            body: JSON.stringify({ source: zip.path, apply: true, withEdges: true }),
          });
          const body = await posted.json();
          assert.strictEqual(body.ok, true, JSON.stringify(body));
          assert.strictEqual(body.added, 2);
          assert.strictEqual(body.edgesRestored, 1);
          const { openStore } = require("./store.js");
          const s = await openStore(jsonl, { backend: "sqlite" });
          try {
            const recs = s.all();
            assert.ok(recs.some((r) => r.text === "panel-import-tea-sqlite"));
          } finally {
            if (s && typeof s.close === "function") s.close();
          }
        } finally {
          await stopPanelChild(panel.child);
        }
      });
    }
  }

  section("RM-17 import — sovereignty return trip");

  {
    const { spawnSync } = require("child_process");
    const { ZipWriter } = require("./zip.js");
    const { JsonlStore } = require("./store.js");
    const { EdgeStore, makeEdge, openEdgeStore, isSqliteStore } = require("./edges.js");
    const imp = require("./import-memory.js");
    const exp17 = require("./export-memory.js");

    function stamp(p) {
      if (!fs.existsSync(p)) return null;
      const st = fs.statSync(p);
      const buf = fs.readFileSync(p);
      return st.size + ":" + require("crypto").createHash("sha256").update(buf).digest("hex");
    }

    function seedImportStore(name) {
      const file = tmp("import-src-" + name + ".jsonl");
      const store = new JsonlStore(file);
      store.add(normalize({
        id: 1, text: "I prefer tea", created: "2026-03-05T12:00:00.000Z",
        embedding: [0.1, 0.2, 0.3], access_count: 4,
      }));
      store.add(normalize({
        id: 2, text: "I used to prefer coffee", created: "2026-03-05T13:00:00.000Z",
        embedding: [0.2, 0.1, 0.3], superseded_by: 1, valid_to: "2026-03-05T12:00:00.000Z",
      }));
      store.add(normalize({
        id: 3, text: "old secret I deleted", created: "2026-01-09T00:00:00.000Z",
        embedding: [0.0, 0.1, 0.0], deleted: true,
      }));
      const E = new EdgeStore(file + ".edges.json");
      E.put(makeEdge(1, 2, { origin: "co-activation", now: "2026-03-05T12:00:00.000Z", hebbianWeight: 0.42 }));
      E.save();
      return { file, store };
    }

    async function exportZip(name, file) {
      const outDir = tmp("import-zip-" + name);
      fs.mkdirSync(outDir, { recursive: true });
      return exp17.runExport({ mode: "zip", name, outDir, storePath: file });
    }

    function embClose17(a, b, eps) {
      eps = eps == null ? 1e-5 : eps;
      if (a == null && b == null) return true;
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
      return true;
    }

    await atest("dry-run mutates NOTHING (dest + source bytes)", async () => {
      const { file } = seedImportStore("dry");
      const zip = await exportZip("dry", file);
      const dest = tmp("import-dest-dry.jsonl");
      const beforeSrc = stamp(zip.path);
      const beforeDestDb = stamp(sqlitePathFor(dest));
      const plan = await imp.runImport({
        source: zip.path, destPath: dest, apply: false,
      }, { backend: "jsonl" });
      assert.strictEqual(plan.apply, false);
      assert.strictEqual(plan.willAdd, 3);
      assert.strictEqual(plan.records.deleted, 1);
      assert.strictEqual(plan.records.superseded, 1);
      assert.ok(plan.isRmExport);
      assert.ok(!fs.existsSync(dest), "dry-run must not create dest jsonl");
      assert.ok(!fs.existsSync(sqlitePathFor(dest)), "dry-run must not mint an empty .db");
      assert.strictEqual(stamp(zip.path), beforeSrc, "source zip unchanged");
      assert.strictEqual(stamp(sqlitePathFor(dest)), beforeDestDb);
    });

    await atest("restore zip into empty jsonl: ids, embeddings, deleted, superseded preserved", async () => {
      const { file } = seedImportStore("full");
      const zip = await exportZip("full", file);
      const dest = tmp("import-dest-full.jsonl");
      const result = await imp.runImport({
        source: zip.path, destPath: dest, apply: true,
      }, { backend: "jsonl" });
      assert.strictEqual(result.apply, true);
      assert.strictEqual(result.added, 3);
      assert.strictEqual(result.edgesRestored, 0, "Hebbian is opt-in");
      const store = new JsonlStore(dest);
      const recs = store.all();
      assert.strictEqual(recs.length, 3);
      const tea = recs.find((r) => r.id === 1);
      assert.strictEqual(tea.text, "I prefer tea");
      assert.ok(embClose17(tea.embedding, [0.1, 0.2, 0.3]));
      assert.strictEqual(tea.access_count, 4);
      const coffee = recs.find((r) => r.id === 2);
      assert.strictEqual(coffee.superseded_by, 1);
      assert.ok(recs.some((r) => r.deleted && r.id === 3));
      assert.ok(!fs.existsSync(dest + ".edges.json"), "no silent Hebbian bless");
    });

    await atest("--with-edges restores Hebbian weight from an RM export zip", async () => {
      const { file } = seedImportStore("heb");
      const zip = await exportZip("heb", file);
      const dest = tmp("import-dest-heb.jsonl");
      const result = await imp.runImport({
        source: zip.path, destPath: dest, apply: true, withEdges: true,
      }, { backend: "jsonl" });
      assert.strictEqual(result.edgesRestored, 1);
      const E = new EdgeStore(dest + ".edges.json");
      const e = E.get(1, 2);
      assert.ok(e, "edge 1:2 present");
      assert.strictEqual(e.hebbian.weight, 0.42);
    });

    await atest("raw memories.jsonl restores facts and never looks for a sibling sidecar", async () => {
      const { file } = seedImportStore("jsonl");
      const outDir = tmp("import-raw-out");
      fs.mkdirSync(outDir, { recursive: true });
      const raw = await exp17.runExport({
        mode: "jsonl", name: "raw", outFile: outDir, storePath: file,
      });
      const dest = tmp("import-dest-jsonl.jsonl");
      const result = await imp.runImport({
        source: raw.path, destPath: dest, apply: true, withEdges: false,
      }, { backend: "jsonl" });
      assert.strictEqual(result.added, 3);
      assert.ok(!fs.existsSync(dest + ".edges.json"));
    });

    await atest("--with-edges on a raw jsonl is refused (planted-sidecar refusal)", async () => {
      const jsonl = tmp("import-plain.jsonl");
      fs.writeFileSync(jsonl, JSON.stringify(normalize({
        id: 1, text: "plain", created: "2026-01-01T00:00:00.000Z", embedding: [1, 0, 0],
      })) + "\n");
      const dest = tmp("import-dest-refuse.jsonl");
      const plan = await imp.runImport({
        source: jsonl, destPath: dest, apply: false, withEdges: true,
      }, { backend: "jsonl" });
      assert.ok(plan.errors.some((e) => e.code === "IMPORT_NOT_EXPORT"));
      await assert.rejects(
        () => imp.runImport({
          source: jsonl, destPath: dest, apply: true, withEdges: true,
        }, { backend: "jsonl" }),
        (e) => e && e.code === "IMPORT_NOT_EXPORT"
      );
      assert.ok(!fs.existsSync(dest));
    });

    await atest("a raw .edges.json as the source is refused", async () => {
      const p = tmp("planted.edges.json");
      fs.writeFileSync(p, JSON.stringify({ kind: "resonance-edges", version: 1, edges: {} }));
      const dest = tmp("import-dest-planted.jsonl");
      await assert.rejects(
        () => imp.runImport({ source: p, destPath: dest, apply: true }, { backend: "jsonl" }),
        (e) => e && e.code === "IMPORT_REFUSED_SIDECAR"
      );
      assert.ok(!fs.existsSync(dest));
    });

    await atest("non-empty dest without --merge is refused; dest unchanged", async () => {
      const { file } = seedImportStore("nomerge");
      const zip = await exportZip("nomerge", file);
      const dest = tmp("import-dest-nomerge.jsonl");
      const live = new JsonlStore(dest);
      live.add(normalize({
        id: 99, text: "already here", created: "2026-02-01T00:00:00.000Z", embedding: [0, 1, 0],
      }));
      const before = stamp(dest);
      const plan = await imp.runImport({
        source: zip.path, destPath: dest, apply: false,
      }, { backend: "jsonl" });
      assert.ok(plan.errors.some((e) => e.code === "IMPORT_DEST_NONEMPTY"));
      await assert.rejects(
        () => imp.runImport({
          source: zip.path, destPath: dest, apply: true,
        }, { backend: "jsonl" }),
        (e) => e && e.code === "IMPORT_DEST_NONEMPTY"
      );
      assert.strictEqual(stamp(dest), before);
    });

    await atest("merge: same-id same-text skipped; same-id different-text remapped; dest kept", async () => {
      const { file } = seedImportStore("merge");
      const zip = await exportZip("merge", file);
      const dest = tmp("import-dest-merge.jsonl");
      const live = new JsonlStore(dest);
      live.add(normalize({
        id: 1, text: "I prefer tea", created: "2026-02-01T00:00:00.000Z", embedding: [9, 9, 9],
      }));
      live.add(normalize({
        id: 2, text: "dest-only coffee story", created: "2026-02-01T00:00:00.000Z", embedding: [0, 0, 1],
      }));
      const result = await imp.runImport({
        source: zip.path, destPath: dest, apply: true, merge: true,
      }, { backend: "jsonl" });
      const recs = new JsonlStore(dest).all();
      const tea = recs.find((r) => String(r.id) === "1");
      assert.strictEqual(tea.text, "I prefer tea");
      assert.ok(embClose17(tea.embedding, [9, 9, 9]), "dest tea kept, not overwritten");
      const destCoffee = recs.find((r) => String(r.id) === "2");
      assert.strictEqual(destCoffee.text, "dest-only coffee story");
      assert.ok(recs.some((r) => r.text === "I used to prefer coffee" && String(r.id) !== "2"),
        "incoming coffee remapped off dest id 2");
      assert.ok(recs.some((r) => r.deleted && r.text === "old secret I deleted"));
      assert.ok(result.skipped >= 1, "tea skipped as restatement");
      assert.ok(result.remapped >= 1, "id 2 remapped");
    });

    await atest("merge skip-text: byte-identical different id does not append", async () => {
      const srcFile = tmp("import-src-skiptext.jsonl");
      const src = new JsonlStore(srcFile);
      src.add(normalize({
        id: 50, text: "I prefer tea", created: "2026-03-01T00:00:00.000Z", embedding: [0.1, 0.2, 0.3],
      }));
      const outDir = tmp("import-skiptext-out");
      fs.mkdirSync(outDir, { recursive: true });
      const raw = await exp17.runExport({
        mode: "jsonl", name: "st", outFile: outDir, storePath: srcFile,
      });
      const dest = tmp("import-dest-skiptext.jsonl");
      const live = new JsonlStore(dest);
      live.add(normalize({
        id: 1, text: "I prefer tea", created: "2026-01-01T00:00:00.000Z", embedding: [1, 0, 0],
      }));
      const result = await imp.runImport({
        source: raw.path, destPath: dest, apply: true, merge: true,
      }, { backend: "jsonl" });
      const recs = new JsonlStore(dest).all();
      assert.strictEqual(recs.length, 1, "did not append a duplicate sentence");
      assert.strictEqual(recs[0].id, 1);
      assert.strictEqual(result.added, 0);
    });

    await atest("zip without RM manifest: memories import, --with-edges refused", async () => {
      const jsonl = tmp("import-plain2.jsonl");
      fs.writeFileSync(jsonl, JSON.stringify(normalize({
        id: 7, text: "competitor row", created: "2026-01-01T00:00:00.000Z", embedding: [1, 0, 0],
      })) + "\n");
      const zpath = tmp("import-competitor.zip");
      const w = new ZipWriter(zpath);
      w.addStored("memories.jsonl", fs.readFileSync(jsonl));
      w.finalize();
      const dest = tmp("import-dest-comp.jsonl");
      const ok = await imp.runImport({
        source: zpath, destPath: dest, apply: true,
      }, { backend: "jsonl" });
      assert.strictEqual(ok.added, 1);
      assert.strictEqual(new JsonlStore(dest).get(7).text, "competitor row");
      const dest2 = tmp("import-dest-comp2.jsonl");
      await assert.rejects(
        () => imp.runImport({
          source: zpath, destPath: dest2, apply: true, withEdges: true,
        }, { backend: "jsonl" }),
        (e) => e && e.code === "IMPORT_NOT_EXPORT"
      );
    });

    await atest("CLI --import (entry.js) is dry-run default; not a fifth verb", async () => {
      const { file } = seedImportStore("cli");
      const zip = await exportZip("cli", file);
      const dest = tmp("import-dest-cli.jsonl");
      const entry = path.join(__dirname, "entry.js");
      const dry = spawnSync(process.execPath, [
        entry, "--import", zip.path, "--into", dest, "--json",
      ], { encoding: "utf8", env: Object.assign({}, process.env, { RESONANCE_STORE: "jsonl" }) });
      assert.strictEqual(dry.status, 0, dry.stderr || dry.stdout);
      const plan = JSON.parse(dry.stdout);
      assert.strictEqual(plan.apply, false);
      assert.ok(!fs.existsSync(dest));
      const applied = spawnSync(process.execPath, [
        entry, "--import", zip.path, "--into", dest, "--apply", "--json",
      ], { encoding: "utf8", env: Object.assign({}, process.env, { RESONANCE_STORE: "jsonl" }) });
      assert.strictEqual(applied.status, 0, applied.stderr || applied.stdout);
      const body = JSON.parse(applied.stdout);
      assert.strictEqual(body.apply, true);
      assert.strictEqual(body.added, 3);
    });

    await atest("source zip is not mutated by apply", async () => {
      const { file } = seedImportStore("ro");
      const zip = await exportZip("ro", file);
      const before = stamp(zip.path);
      const dest = tmp("import-dest-ro.jsonl");
      await imp.runImport({
        source: zip.path, destPath: dest, apply: true,
      }, { backend: "jsonl" });
      assert.strictEqual(stamp(zip.path), before);
    });

    await atest("dest that already has edges refuses --with-edges without --replace-edges", async () => {
      const { file } = seedImportStore("eexist");
      const zip = await exportZip("eexist", file);
      const dest = tmp("import-dest-eexist.jsonl");
      const live = new JsonlStore(dest);
      live.add(normalize({
        id: 9, text: "dest fact", created: "2026-02-01T00:00:00.000Z", embedding: [0, 1, 0],
      }));
      const E = new EdgeStore(dest + ".edges.json");
      E.put(makeEdge(9, 9, { origin: "co-activation", now: "2026-02-01T00:00:00.000Z", hebbianWeight: 0.9 }));
      E.save();
      await assert.rejects(
        () => imp.runImport({
          source: zip.path, destPath: dest, apply: true, merge: true, withEdges: true,
        }, { backend: "jsonl" }),
        (e) => e && e.code === "IMPORT_EDGES_EXIST"
      );
      const still = new EdgeStore(dest + ".edges.json");
      assert.strictEqual(still.get(9, 9).hebbian.weight, 0.9, "dest Hebbian kept");
    });

    if (sqliteAvailable()) {
      await atest("sqlite restore: lossless ids + f32 embeddings, Hebbian into the table", async () => {
        const { file } = seedImportStore("sql");
        const zip = await exportZip("sql", file);
        const dest = tmp("import-dest-sql.jsonl");
        const result = await imp.runImport({
          source: zip.path, destPath: dest, apply: true, withEdges: true,
        }, { backend: "sqlite" });
        assert.strictEqual(result.added, 3);
        assert.strictEqual(result.edgesRestored, 1);
        const s = await openStore(dest, { backend: "sqlite", log() {} });
        try {
          assert.ok(isSqliteStore(s) || s.constructor.name === "SqliteStore");
          const tea = s.get(1);
          assert.strictEqual(tea.text, "I prefer tea");
          assert.ok(embClose17(tea.embedding, [0.1, 0.2, 0.3]));
          assert.strictEqual(s.get(2).superseded_by, 1);
          assert.ok(s.get(3).deleted);
          const E = openEdgeStore({ store: s, storePath: dest });
          assert.strictEqual(E.get(1, 2).hebbian.weight, 0.42);
        } finally {
          if (s && typeof s.close === "function") s.close();
        }
      });

      await atest("kill-9 mid sqlite import leaves dest empty (txn rollback)", async () => {
        const { file } = seedImportStore("kill");
        const zip = await exportZip("kill", file);
        const dest = tmp("import-dest-kill.jsonl");
        const ready = tmp("import-kill.ready");
        const { spawn } = require("child_process");
        const child = spawn(process.execPath, [
          path.join(__dirname, "import-memory.js"),
          "--import", zip.path, "--into", dest, "--apply",
        ], {
          env: Object.assign({}, process.env, {
            RESONANCE_STORE: "sqlite",
            RM_IMPORT_CRASH_AFTER: "1",
            RM_IMPORT_CRASH_READY: ready,
          }),
          stdio: ["ignore", "pipe", "pipe"],
        });
        const t0 = Date.now();
        while (!fs.existsSync(ready)) {
          if (Date.now() - t0 > 15000) {
            try { child.kill("SIGKILL"); } catch { /* */ }
            throw new Error("import crash-child never wrote ready: " +
              String(child.stderr && child.stderr.read()));
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        child.kill("SIGKILL");
        await new Promise((resolve) => {
          if (child.exitCode != null || child.signalCode) return resolve();
          child.on("exit", resolve);
          setTimeout(resolve, 5000);
        });
        const dbPath = sqlitePathFor(dest);
        if (fs.existsSync(dbPath)) {
          const { SqliteStore } = require("./store-sqlite.js");
          const s = new SqliteStore(dbPath, { readOnly: true });
          try {
            assert.strictEqual(s.rowCount(), 0, "rolled back; no half store");
          } finally { s.close(); }
        }
      });
    }
  }

  section("eval measure runner (RM-02.a)");

  await atest("duplicates corpus: both metrics compute via pipeline.js (cached embed)", async () => {
    const { loadScenarios, runScenario } = require("./eval/measure.js");
    const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "duplicates.jsonl"));
    const r = await runScenario(scenarios[0], { k: 5 });
    assert.ok(r.metrics.duplicate_rate >= 0 && r.metrics.duplicate_rate <= 1);
    assert.ok(r.metrics.recall_at_k >= 0 && r.metrics.recall_at_k <= 1);
    assert.ok(typeof r.metrics.mrr === "number" && r.metrics.mrr >= 0 && r.metrics.mrr <= 1,
      "mrr ships as a reporting metric (S1 registry extension)");
    assert.strictEqual(r.queries.length, scenarios[0].queries.length);
    assert.ok(r.queries.every((q) => Array.isArray(q.ranked_ids)), "each query has ranked_ids from recall output");
    assert.ok(r.exact_restatements_caught >= 1,
      "byte-identical coffee-order pair is confirmed, not appended");
    assert.ok(r.n_stored_current >= 1 && r.n_stored_current <= r.n_writes);
    assert.ok(r.queries.every((q) => q.relevant_ids.length >= 1),
      "every query resolved to a stored id via group text (merge must keep an original text)");
    assert.ok(r.extraction_precision == null,
      "duplicates writes have no gold_facts; extraction_precision is not a duplicates number");
  });

  await atest("messy-hard corpus: Tier 0 baseline is low (cached embed, no LLM)", async () => {
    const { loadScenarios, runScenario } = require("./eval/measure.js");
    const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "messy-hard.jsonl"));
    const r = await runScenario(scenarios[0], { k: 5 });
    assert.ok(r.extraction_precision, "messy-hard writes are labeled");
    assert.strictEqual(scenarios[0].extract_match, "cover");
    assert.strictEqual(r.extraction_recall.rate, 0, "Tier 0 cannot recover implicit gold");
    assert.strictEqual(r.extraction_precision.n_correct, 0, "narrative blobs are not atomic facts");
    assert.strictEqual(r.metrics.recall_at_k, 0, "facts_only relevant ids miss on the blob");
  });

  await atest("messy corpus: extraction_precision via pipeline.js (current save, cached embed)", async () => {
    const { loadScenarios, runScenario } = require("./eval/measure.js");
    const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "messy.jsonl"));
    const r = await runScenario(scenarios[0], { k: 5 });
    assert.ok(r.extraction_precision, "messy writes are labeled");
    assert.ok(r.metrics.extraction_precision >= 0 && r.metrics.extraction_precision <= 1);
    assert.ok(r.metrics.duplicate_rate >= 0 && r.metrics.duplicate_rate <= 1);
    assert.ok(r.metrics.recall_at_k >= 0 && r.metrics.recall_at_k <= 1);
    assert.strictEqual(r.queries.length, scenarios[0].queries.length);
    const expl = r.extraction_precision;
    assert.strictEqual(expl.n_labeled, scenarios[0].writes.length);
    assert.strictEqual(expl.n_correct, expl.n_stored, "Tier 0/1 stores only gold facts");
    assert.ok(expl.rate >= 0.9, "pre-declared RM-01.b bar: extraction_precision ≥ 0.9");
    assert.strictEqual(expl.pii_refusal_rate, 1, "every PII write refused");
    assert.strictEqual(expl.n_pii_refused, expl.n_pii);
    assert.ok(r.extraction_recall, "extraction_recall is the anti-cheat");
    assert.strictEqual(r.extraction_recall.rate, 1, "every gold fact has a matching stored record");
    assert.strictEqual(r.metrics.recall_at_k, 1, "recall@5 must not drop");
    assert.ok(r.queries.every((q) => Array.isArray(q.ranked_ids) && q.ranked_ids.length >= 1),
      "each messy query resolved to a stored origin id");
  });

  section("S1 substrate scale (generator → real recall path)");

  await atest("plant 3 needles in 100 distractors: real recall finds them (synthetic geometry)", async () => {
    // Plumbing, not the live embedder: needle ≡ query axis, hard
    // distractors mix 0.65/0.35, haystack is random. The live 1k→50k
    // curve is eval/substrate/scale.js.
    const { createMemory } = require("./eval/pipeline.js");
    const ids = ["allergy-penicillin", "height-bookshelf", "job-globex"];
    const corpus = generateScaleCorpus({ n: 100, seed: 1, needleIds: ids });
    attachSyntheticEmbeddings(corpus, 16, 1);
    const file = tmp("s1-e2e.jsonl");
    const store = new JsonlStore(file);
    for (const rec of corpus.records) {
      store.add(normalize({
        id: rec.id, text: rec.text, embedding: rec.embedding,
        created: "2026-01-01T00:00:00Z",
      }));
    }
    const qv = new Map(corpus.queries.map((q) => [q.query, q.embedding]));
    const mem = createMemory({
      store,
      embed: async (texts) => texts.map((t) => {
        const v = qv.get(t);
        if (!v) throw new Error("unexpected embed: " + t);
        return v;
      }),
      fieldEnabled: false,
    });
    const ranked = [];
    for (const q of corpus.queries) {
      const out = await mem.recall(q.query, 10);
      const hits = parsePrimaryHits(out);
      assert.ok(hits.length >= 1, q.id + " empty recall");
      const top5 = hits.slice(0, 5).map((h) => String(h.id));
      assert.ok(top5.includes(String(q.relevant_ids[0])),
        q.id + " needle not in top-5: " + hits.map((h) => h.id + " " + h.text).join(" | "));
      assert.strictEqual(String(hits[0].id), String(q.relevant_ids[0]),
        q.id + " synthetic geometry should put the needle at rank 1, got " + hits[0].text);
      ranked.push({
        id: q.id,
        ranked_ids: hits.map((h) => String(h.id)),
        relevant_ids: q.relevant_ids,
      });
    }
    assert.strictEqual(computeMetric("recall_at_k", { queries: ranked }, null, { k: 1 }), 1);
    assert.strictEqual(computeMetric("mrr", { queries: ranked }, null), 1);
  });

  section("RM-15 soak runner (control arm plumbing, synthetic embed)");

  await atest("control arm plays a tiny soak, skips dream, scores checkpoints", async () => {
    const corpus = soakGen.generateSoakCorpus({ n: 80, seed: 1 });
    const texts = soakGen.collectTexts(corpus);
    const dim = Math.max(32, texts.length + 4);
    const vecs = new Map();
    texts.forEach((t, i) => {
      const v = new Array(dim).fill(0);
      v[i % dim] = 1;
      vecs.set(t, v);
    });
    const synEmbed = async (ts) => ts.map((t) => {
      if (!vecs.has(t)) {
        const v = new Array(dim).fill(0);
        v[vecs.size % dim] = 1;
        vecs.set(t, v);
      }
      return vecs.get(t);
    });
    const report = await soakRun.playSoak({
      arm: "control",
      events: corpus.events,
      meta: { must_not_merge: corpus.must_not_merge },
      storeKind: "jsonl",
      k: 5,
      fieldEnabled: false,
      embed: synEmbed,
      checkpoints: [40, 80],
    });
    assert.strictEqual(report.arm, "control");
    assert.strictEqual(report.n_events, 80);
    assert.ok(report.dreams_skipped >= 0);
    assert.strictEqual(report.curve.length, 2);
    assert.strictEqual(report.curve[0].checkpoint, 40);
    assert.strictEqual(report.curve[1].checkpoint, 80);
    for (const row of report.curve) {
      assert.ok(row.n_current >= 1, "store grew");
      for (const key of ["staleness_rate", "duplicate_rate", "needle_retention", "storage_ratio", "false_merge_rate"]) {
        const v = row.metrics[key];
        assert.ok(v == null || (v >= 0 && v <= 2), key + "=" + v + " out of range");
      }
      assert.strictEqual(row.scaffolded["gist_recall@k"], null);
      assert.strictEqual(row.scaffolded.cluster_precision, null);
    }
  });

  if (sqliteAvailable()) {
    section("Store conformance through createCore (JsonlStore ≡ SqliteStore)");

    const confEmbedBank = {
      "I work at Acme": [1, 0, 0, 0],
      "I prefer tea": [0, 1, 0, 0],
      "I'm allergic to peanuts": [0, 0, 1, 0],
      "where do I work": [0.95, 0.05, 0, 0],
      "what do I drink": [0.05, 0.95, 0, 0],
      // Same-slot correction at ~0.60 cosine to Acme: above RM-03 floor
      // (0.535) and below DEDUP_LO (0.88) so it supersedes rather than
      // restates. Mass on dim 4 so it does not argmax onto tea.
      "Actually I work at Globex now": [0.60, 0.05, 0.05, 0.797],
      "I work at Globex": [0.60, 0.05, 0.05, 0.797],
    };
    const confEmbed = async (texts) => texts.map((t) => {
      if (confEmbedBank[t]) return confEmbedBank[t].slice();
      const v = new Array(4).fill(0);
      v[t.length % 4] = 1;
      return v;
    });

    function seedPair(suffix) {
      const created = "2026-01-01T00:00:00.000Z";
      const jsonl = new JsonlStore(tmp("conf-core-" + suffix + ".jsonl"));
      const sqlite = freshSqlite("conf-core-" + suffix);
      const recs = [
        normalize({ id: 11, text: "I work at Acme", embedding: [1, 0, 0, 0], created }),
        normalize({ id: 12, text: "I prefer tea", embedding: [0, 1, 0, 0], created }),
        normalize({ id: 13, text: "I'm allergic to peanuts", embedding: [0, 0, 1, 0], created }),
      ];
      for (const r of recs) { jsonl.add(r); sqlite.add(r); }
      const jCore = createCore({ store: jsonl, embed: confEmbed });
      const sCore = createCore({ store: sqlite, embed: confEmbed });
      return { jsonl, sqlite, jCore, sCore };
    }

    await atest("recall ranking/ids are identical on both backends", async () => {
      const { sqlite, jCore, sCore } = seedPair("recall");
      const jq = await jCore.recall("where do I work", 3);
      const sq = await sCore.recall("where do I work", 3);
      const jHits = parsePrimaryHits(jq).map((h) => String(h.id));
      const sHits = parsePrimaryHits(sq).map((h) => String(h.id));
      assert.deepStrictEqual(sHits, jHits, "same id order\n jsonl=" + jHits + "\n sqlite=" + sHits);
      assert.strictEqual(sHits[0], "11", "Acme is rank-1 for 'where do I work'");
      sqlite.close();
    });

    await atest("save restatement / supersession / edit / delete match", async () => {
      const { jsonl, sqlite, jCore, sCore } = seedPair("verbs");
      // HI restatement of tea: confirm, do not append.
      await jCore.save("I prefer tea");
      await sCore.save("I prefer tea");
      assert.strictEqual(jsonl.current().length, sqlite.current().length, "restatement did not append");
      assert.strictEqual(jsonl.get(12).access_count, sqlite.get(12).access_count);

      // Cue-gated supersession of the job.
      await jCore.save("Actually I work at Globex now");
      await sCore.save("Actually I work at Globex now");
      const jCur = jsonl.current().map((r) => r.text).sort();
      const sCur = sqlite.current().map((r) => r.text).sort();
      assert.deepStrictEqual(sCur, jCur, "current texts after supersession");
      const jOld = jsonl.get(11), sOld = sqlite.get(11);
      assert.ok(jOld.valid_to && sOld.valid_to, "old job retired on both");
      assert.ok(jOld.superseded_by != null && sOld.superseded_by != null, "superseded_by set");

      const jNew = jsonl.current().find((r) => /Globex/.test(r.text));
      const sNew = sqlite.current().find((r) => /Globex/.test(r.text));
      assert.ok(jNew && sNew, "Globex is current");

      await jCore.edit(jNew.id, "I work at Globex");
      await sCore.edit(sNew.id, "I work at Globex");
      assert.strictEqual(jsonl.get(jNew.id).text, sqlite.get(sNew.id).text);

      await jCore.remove(13);
      await sCore.remove(13);
      assert.strictEqual(jsonl.get(13).deleted, true);
      assert.strictEqual(sqlite.get(13).deleted, true);
      assert.strictEqual(jsonl.vacuum(), sqlite.vacuum());
      assert.strictEqual(jsonl.all().length, sqlite.all().length);
      sqlite.close();
    });

    section("RM-00 golden parity (JsonlStore ≡ SqliteStore)");

    const {
      parseStoreKind, run: runEval, key: evalKey,
    } = require("./eval/run.js");

    test("parseStoreKind: default sqlite, --store jsonl / env, flag wins, unknown throws", () => {
      const prev = process.env.RESONANCE_STORE;
      try {
        delete process.env.RESONANCE_STORE;
        assert.strictEqual(parseStoreKind([]), "sqlite", "product default");
        assert.strictEqual(parseStoreKind(["--store", "sqlite"]), "sqlite");
        assert.strictEqual(parseStoreKind(["--store=sqlite"]), "sqlite");
        assert.strictEqual(parseStoreKind(["--store", "jsonl"]), "jsonl");
        process.env.RESONANCE_STORE = "jsonl";
        assert.strictEqual(parseStoreKind([]), "jsonl", "env pin");
        assert.strictEqual(parseStoreKind(["--store", "sqlite"]), "sqlite", "flag wins over env");
        process.env.RESONANCE_STORE = "sqlite";
        assert.strictEqual(parseStoreKind(["--store", "jsonl"]), "jsonl", "flag wins over env");
        assert.throws(() => parseStoreKind(["--store", "mysql"]), /unknown --store/);
      } finally {
        if (prev === undefined) delete process.env.RESONANCE_STORE;
        else process.env.RESONANCE_STORE = prev;
      }
    });

    // Full golden, both backends, same memory-core. 31 checks, cached
    // embedder, a couple of seconds — cheaper than a fake mini-corpus
    // that could miss a k=5 near-tie. Any pass/fail flip is a STOP.
    await atest("golden scorecard is identical on JsonlStore and SqliteStore", async () => {
      const jsonl = await runEval({ storeKind: "jsonl" });
      const sqlite = await runEval({ storeKind: "sqlite" });
      const j = Object.fromEntries(jsonl.map((r) => [evalKey(r), r.pass]));
      const s = Object.fromEntries(sqlite.map((r) => [evalKey(r), r.pass]));
      const keys = [...new Set([...Object.keys(j), ...Object.keys(s)])];
      const flips = keys.filter((k) => j[k] !== s[k])
        .map((k) => k + " jsonl=" + j[k] + " sqlite=" + s[k]);
      assert.strictEqual(flips.length, 0, "case flips:\n  " + flips.join("\n  "));
      assert.strictEqual(jsonl.length, 31, "golden is 31 checks");
      assert.strictEqual(sqlite.length, 31);
      assert.strictEqual(
        jsonl.filter((r) => r.pass).length,
        sqlite.filter((r) => r.pass).length
      );
    });
  }

  section("RM-01.b save() wiring (Tier 0/1 on the live path)");

  function extractCore(file) {
    let embedCalls = 0;
    const seen = [];
    const store = new JsonlStore(tmp(file));
    const embed = async (texts) => {
      embedCalls += texts.length;
      // Distinct vectors per distinct string so a split's second half is
      // not a cosine-1.0 restatement of the first (the dummy [1,0] trap).
      return texts.map((t) => {
        let i = seen.indexOf(t);
        if (i < 0) { i = seen.length; seen.push(t); }
        const v = new Array(8).fill(0);
        v[i % 8] = 1;
        v[(i * 3 + 1) % 8] = 0.2;
        return v;
      });
    };
    return {
      store,
      core: createCore({ store, embed }),
      embeds: () => embedCalls,
      resetEmbeds() { embedCalls = 0; },
    };
  }

  await atest("save() strips filler and stores the inner proposition", async () => {
    const { store, core } = extractCore("rm01-filler.jsonl");
    const msg = await core.save("I think you should know that Samuel prefers concise answers");
    assert.ok(/Saved/.test(msg));
    assert.strictEqual(store.current().length, 1);
    assert.strictEqual(store.current()[0].text, "Samuel prefers concise answers");
  });

  await atest("save() splits a standalone multi-fact into two records (two embeds)", async () => {
    const { store, core, embeds, resetEmbeds } = extractCore("rm01-split.jsonl");
    resetEmbeds();
    const msg = await core.save("I have a dog named Rex and also I work as a software architect, mostly on games");
    assert.ok(/Saved 2 memories/.test(msg), msg);
    const texts = store.current().map((r) => r.text).sort();
    assert.deepStrictEqual(texts, [
      "I have a dog named Rex",
      "I work as a software architect, mostly on games",
    ].sort());
    assert.strictEqual(embeds(), 2, "a legitimate split is two embeds — the in-scope cost");
  });

  await atest("save() does not split the honey trap", async () => {
    const { store, core, embeds, resetEmbeds } = extractCore("rm01-nosplit.jsonl");
    resetEmbeds();
    await core.save("I like tea more than coffee and also with honey");
    assert.strictEqual(store.current().length, 1);
    assert.strictEqual(store.current()[0].text, "I like tea more than coffee and also with honey");
    assert.strictEqual(embeds(), 1, "no-split is one embed, same as a clean fact");
  });

  await atest("save() refuses each PII shape: stores nothing, returns a refusal", async () => {
    const payloads = [
      "my API key is sk-abcdefghijklmnopqrstuvwxyz123456",
      "password: hunter2secret",
      "my card number is 4242424242424242",
      "the AWS key is AKIAIOSFODNN7EXAMPLE",
      "keep this -----BEGIN RSA PRIVATE KEY-----",
      "my GitHub token is ghp-abcdefghijklmnopqrstuvwx",
      "my GitHub PAT is github_pat_" + "a".repeat(22) + "_" + "b".repeat(59),
      "stripe secret sk_live_" + "a".repeat(24),
    ];
    for (let i = 0; i < payloads.length; i++) {
      const text = payloads[i];
      const { store, core, embeds, resetEmbeds } = extractCore("rm01-pii-" + i + ".jsonl");
      resetEmbeds();
      const msg = await core.save(text);
      assert.ok(/not saved/i.test(msg), text + " → " + msg);
      assert.strictEqual(store.current().length, 0, text + " must not land in the store");
      assert.strictEqual(store.all().length, 0, text + " must not land even as superseded");
      assert.strictEqual(embeds(), 0, "refusal is string-ops only; no embed");
    }
  });

  await atest("save() digit traps and a clean control: one embed, byte-identical text", async () => {
    const { store, core, embeds, resetEmbeds } = extractCore("rm01-control.jsonl");
    resetEmbeds();
    await core.save("My name is Samuel");
    await core.save("The garage code is 4821");
    await core.save("I take 1500mg of metformin daily");
    const texts = store.current().map((r) => r.text);
    assert.deepStrictEqual(texts, [
      "My name is Samuel",
      "The garage code is 4821",
      "I take 1500mg of metformin daily",
    ]);
    assert.strictEqual(embeds(), 3, "clean facts: one embed each, no extra");
  });

  await atest("save() stores prose that mentions secrets (Bitwarden / recipe / username)", async () => {
    const { store, core, embeds, resetEmbeds } = extractCore("rm01-prose-secret.jsonl");
    resetEmbeds();
    const canaries = [
      "The secret to the recipe is browning the butter",
      "My password manager is Bitwarden",
      "Remember my GitHub username is samgrim97",
    ];
    for (const text of canaries) {
      const msg = await core.save(text);
      assert.ok(/Saved/.test(msg), text + " → " + msg);
    }
    const texts = store.current().map((r) => r.text);
    assert.deepStrictEqual(texts, canaries);
    assert.strictEqual(embeds(), 3, "prose canaries: one embed each, no extra");
  });

  await atest("save() mixed fact+secret stores nothing (refusal, not redaction)", async () => {
    const { store, core } = extractCore("rm01-mixed.jsonl");
    const msg = await core.save("I live in Texas; my API key is sk-abcdefghijklmnopqrstuvwxyz123456");
    assert.ok(/not saved/i.test(msg));
    assert.strictEqual(store.current().length, 0);
  });

  section("RM-01.c save() wiring (Tier 2, mock LLM)");

  function tier2Core(file, extra) {
    let embedCalls = 0;
    const seen = [];
    const store = new JsonlStore(tmp(file));
    const embed = async (texts) => {
      embedCalls += texts.length;
      return texts.map((t) => {
        let i = seen.indexOf(t);
        if (i < 0) { i = seen.length; seen.push(t); }
        const v = new Array(8).fill(0);
        v[i % 8] = 1;
        v[(i * 3 + 1) % 8] = 0.2;
        return v;
      });
    };
    const sent = [];
    const opts = Object.assign({ store, embed }, extra || {});
    if (typeof opts.extract === "function") {
      const inner = opts.extract;
      opts.extract = async (text) => { sent.push(text); return inner(text); };
    }
    return { store, core: createCore(opts), embeds: () => embedCalls, sent };
  }

  await atest("toggle off: extract is never called; byte-identical to 01.b", async () => {
    let called = 0;
    const { store, core } = tier2Core("rm01c-off.jsonl", {
      extractEnabled: () => false,
      extract: async () => { called++; return { facts: ["SHOULD NOT STORE"], skip: false }; },
    });
    await core.save("I think you should know that Samuel prefers concise answers");
    assert.strictEqual(called, 0);
    assert.strictEqual(store.current()[0].text, "Samuel prefers concise answers");
  });

  await atest("toggle on + mock facts: ADD-only, those facts are what is stored", async () => {
    const { store, core, sent } = tier2Core("rm01c-on.jsonl", {
      extractEnabled: () => true,
      extract: async () => ({ facts: ["I have a green parrot named Mango", "I go to the gym at 5am"], skip: false }),
    });
    const msg = await core.save("Life at home is loud in a good way. Between the parrot (Mango, the green one) and getting up for the gym at 5am, quiet evenings are rare and I would not trade it.");
    assert.ok(/Saved 2 memories/.test(msg), msg);
    const texts = store.current().map((r) => r.text).sort();
    assert.deepStrictEqual(texts, ["I go to the gym at 5am", "I have a green parrot named Mango"]);
    assert.strictEqual(sent.length, 1, "one extraction call");
    assert.ok(!/Life at home is loud/.test(store.current().map((r) => r.text).join(" ")),
      "the narrative blob is not stored alongside the facts (extraction replaces, ADD-only vs existing memories)");
  });

  await atest("mock throws / times out / returns garbage: silent degrade to Tier 0/1", async () => {
    const src = "I think you should know that Samuel prefers concise answers";
    const { store: s1, core: c1 } = tier2Core("rm01c-throw.jsonl", {
      extractEnabled: () => true,
      extract: async () => { throw new Error("boom"); },
    });
    const m1 = await c1.save(src);
    assert.ok(/Saved/.test(m1), m1);
    assert.strictEqual(s1.current()[0].text, "Samuel prefers concise answers");

    const { store: s2, core: c2 } = tier2Core("rm01c-timeout.jsonl", {
      extractEnabled: () => true,
      extractTimeoutMs: () => 30,
      extract: () => new Promise(() => {}),
    });
    const t0 = Date.now();
    const m2 = await c2.save(src);
    assert.ok(Date.now() - t0 < 2000, "timeout must not hang save");
    assert.ok(/Saved/.test(m2), m2);
    assert.strictEqual(s2.current()[0].text, "Samuel prefers concise answers");

    const { store: s3, core: c3 } = tier2Core("rm01c-garbage.jsonl", {
      extractEnabled: () => true,
      extract: async () => ({ facts: "not-an-array", skip: false }),
    });
    await c3.save(src);
    assert.strictEqual(s3.current()[0].text, "Samuel prefers concise answers");
  });

  await atest("PII is refused BEFORE any LLM call (secret is never sent)", async () => {
    const { store, core, sent } = tier2Core("rm01c-pii.jsonl", {
      extractEnabled: () => true,
      extract: async (t) => ({ facts: ["leaked: " + t], skip: false }),
    });
    const msg = await core.save("my API key is sk-abcdefghijklmnopqrstuvwxyz123456");
    assert.ok(/not saved/i.test(msg), msg);
    assert.strictEqual(store.current().length, 0);
    assert.strictEqual(sent.length, 0, "extract must not see a secret");
  });

  await atest("capability-detect false: toggle on still no-ops (extract never called)", async () => {
    let called = 0;
    const { store, core } = tier2Core("rm01c-incapable.jsonl", {
      extractEnabled: () => true,
      extractCapable: () => false,
      extract: async () => { called++; return { facts: ["SHOULD NOT STORE"], skip: false }; },
    });
    await core.save("I think you should know that Samuel prefers concise answers");
    assert.strictEqual(called, 0);
    assert.strictEqual(store.current()[0].text, "Samuel prefers concise answers");
  });

  await atest("default createCore: Tier 2 off, no extract injector, 01.b path", async () => {
    const { store, core } = extractCore("rm01c-default.jsonl");
    await core.save("FYI, the Friday standup is at 10am");
    assert.strictEqual(store.current()[0].text, "The Friday standup is at 10am");
  });

  section("RM-02.b cosine-banded dedup at save");

  // Unit vectors: cosine([1,0], [c, sqrt(1-c²)]) = c. Lets a test dial an
  // exact band without a live embedder.
  function vecAt(cos) {
    const c = Number(cos);
    return [c, Math.sqrt(Math.max(0, 1 - c * c))];
  }
  const ORIGIN = [1, 0];

  function dedupCore(file, table, thresholds) {
    const store = new JsonlStore(tmp(file));
    const embed = async (texts) => texts.map((t) => {
      if (table[t]) return table[t].slice();
      return ORIGIN.slice();
    });
    const opts = { store, embed };
    if (thresholds) opts.dedupThresholds = () => thresholds;
    return { store, core: createCore(opts) };
  }

  await atest("HI restatement bumps last_confirmed + access_count and does NOT append", async () => {
    const table = {
      "I prefer tea over coffee": ORIGIN,
      "I like tea more than coffee": vecAt(0.9522),
    };
    const { store, core } = dedupCore("dedup-hi.jsonl", table);
    await core.save("I prefer tea over coffee");
    const id = store.current()[0].id;
    store.update(id, { last_confirmed: "2020-01-01T00:00:00.000Z", access_count: 0 });
    const msg = await core.save("I like tea more than coffee");
    assert.ok(/Already remembered/.test(msg));
    assert.strictEqual(store.current().length, 1, "HI paraphrase must not append");
    assert.strictEqual(store.active().length, 1, "and must not persist a superseded copy either");
    const rec = store.get(id);
    assert.strictEqual(rec.text, "I prefer tea over coffee", "original text kept");
    assert.notStrictEqual(rec.last_confirmed, "2020-01-01T00:00:00.000Z", "last_confirmed bumped");
    assert.strictEqual(rec.access_count, 1, "access_count bumped");
  });

  await atest("mid-band merge keeps the longer original text, sets superseded_by, unions metadata", async () => {
    const short = "I have a cat named Koneko";
    const longer = "I have a black cat named Koneko";
    const table = { [short]: ORIGIN, [longer]: vecAt(0.9435) };
    const { store, core } = dedupCore("dedup-mid.jsonl", table);
    await core.save(short);
    const oldId = store.current()[0].id;
    store.update(oldId, { is_constraint: true, access_count: 4, source: "user_stated" });
    const msg = await core.save(longer);
    assert.ok(/merged/i.test(msg), "merge is reported, not a silent restatement");
    assert.strictEqual(store.current().length, 1, "one current survivor");
    const survivor = store.current()[0];
    assert.strictEqual(survivor.text, longer, "longer original text kept (not a blend)");
    assert.notStrictEqual(survivor.id, oldId, "incoming was longer → new row is current");
    assert.strictEqual(survivor.supersedes, oldId);
    assert.strictEqual(survivor.is_constraint, true, "union: constraint flag carried onto survivor");
    assert.ok(survivor.access_count >= 5, "union: access_count inherited + confirmation bump");
    const loser = store.get(oldId);
    assert.ok(loser.valid_to, "loser is superseded, not deleted");
    assert.strictEqual(loser.superseded_by, survivor.id);
    assert.strictEqual(loser.text, short, "loser original text is recoverable");
    assert.strictEqual(store.active().length, 2, "both rows kept (I8)");
  });

  await atest("mid-band merge: existing longer text stays current, incoming is the superseded loser", async () => {
    const longer = "I work as a software architect, mostly on games";
    const short = "I work as a software architect";
    const table = { [longer]: ORIGIN, [short]: vecAt(0.9261) };
    const { store, core } = dedupCore("dedup-mid-keep.jsonl", table);
    await core.save(longer);
    const keepId = store.current()[0].id;
    await core.save(short);
    assert.strictEqual(store.current().length, 1);
    assert.strictEqual(store.current()[0].id, keepId);
    assert.strictEqual(store.current()[0].text, longer);
    const loser = store.active().find((r) => String(r.id) !== String(keepId));
    assert.ok(loser, "shorter incoming was persisted as superseded");
    assert.strictEqual(loser.text, short);
    assert.strictEqual(loser.superseded_by, keepId);
    assert.ok(loser.valid_to);
  });

  await atest("control pair (~0.69, distinct) is NOT merged", async () => {
    const dog = "I have a dog named Rex";
    const cat = "I have a cat named Whiskers";
    const table = { [dog]: ORIGIN, [cat]: vecAt(0.69) };
    const { store, core } = dedupCore("dedup-control.jsonl", table);
    await core.save(dog);
    await core.save(cat);
    assert.strictEqual(store.current().length, 2, "both current — dog/cat must not collapse");
    assert.ok(store.current().every((r) => !r.valid_to && r.superseded_by == null));
  });

  await atest("a save below DEDUP_LO appends normally", async () => {
    const table = {
      "My name is Samuel": ORIGIN,
      "The garage code is 4821": vecAt(0.20),
    };
    const { store, core } = dedupCore("dedup-below-lo.jsonl", table);
    await core.save("My name is Samuel");
    const msg = await core.save("The garage code is 4821");
    assert.ok(/^Saved\./.test(msg), "plain append, not merge/restate");
    assert.strictEqual(store.current().length, 2);
  });

  await atest("thresholds are read from the injected config getter", async () => {
    const table = {
      "I prefer tea over coffee": ORIGIN,
      "I like tea more than coffee": vecAt(0.9522),
    };
    // Raise HI past the tea pair so the default restatement becomes an append.
    const { store, core } = dedupCore("dedup-cfg.jsonl", table, { hi: 0.99, lo: 0.97 });
    await core.save("I prefer tea over coffee");
    await core.save("I like tea more than coffee");
    assert.strictEqual(store.current().length, 2, "pair that is HI at 0.95 appends when config hi=0.99");
  });

  await atest("readDedupThresholds: live config wins over env, env over defaults", async () => {
    assert.deepStrictEqual(readDedupThresholds(null), { hi: DEDUP_HI, lo: DEDUP_LO });
    assert.strictEqual(DEDUP_HI, 0.95);
    assert.strictEqual(DEDUP_LO, 0.88);
    assert.deepStrictEqual(
      readDedupThresholds({ dedup_hi: 0.99, dedup_lo: 0.90 }),
      { hi: 0.99, lo: 0.90 },
      "config keys dedup_hi / dedup_lo"
    );
    const prevHi = process.env.RESONANCE_DEDUP_HI;
    const prevLo = process.env.RESONANCE_DEDUP_LO;
    process.env.RESONANCE_DEDUP_HI = "0.97";
    process.env.RESONANCE_DEDUP_LO = "0.91";
    try {
      assert.deepStrictEqual(readDedupThresholds(null), { hi: 0.97, lo: 0.91 }, "env when no config");
      assert.deepStrictEqual(
        readDedupThresholds({ dedup_hi: 0.93 }),
        { hi: 0.93, lo: 0.91 },
        "config hi wins; env lo fills the other"
      );
    } finally {
      if (prevHi === undefined) delete process.env.RESONANCE_DEDUP_HI;
      else process.env.RESONANCE_DEDUP_HI = prevHi;
      if (prevLo === undefined) delete process.env.RESONANCE_DEDUP_LO;
      else process.env.RESONANCE_DEDUP_LO = prevLo;
    }
  });

  await atest("dedup degrades to append when the new record has no vector", async () => {
    const store = new JsonlStore(tmp("dedup-novec.jsonl"));
    let live = true;
    const embed = async (texts) => {
      if (!live) throw new Error("embedder down");
      return texts.map(() => ORIGIN.slice());
    };
    const core = createCore({ store, embed });
    await core.save("I'm allergic to penicillin");
    live = false;
    const msg = await core.save("I am allergic to penicillin");
    assert.ok(/^Saved\./.test(msg) || /Saved/.test(msg), "save still succeeds");
    assert.strictEqual(store.current().length, 2, "can't compare → append, don't crash or drop");
    assert.strictEqual(store.current()[1].embedding, null);
  });

  await atest("exact byte-identical restatement still confirms (and now bumps access_count)", async () => {
    const { store, core } = dedupCore("dedup-exact.jsonl", { "I drink tea": ORIGIN });
    await core.save("I drink tea");
    const id = store.current()[0].id;
    const msg = await core.save("I drink tea");
    assert.ok(/Already remembered/.test(msg));
    assert.strictEqual(store.current().length, 1);
    assert.strictEqual(store.get(id).access_count, 1);
  });

  await atest("RM-02.b A/B bar on the duplicates corpus: dup_rate ≤ 0.1591 and recall@5 = 1", async () => {
    const { loadScenarios, runScenario } = require("./eval/measure.js");
    const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "duplicates.jsonl"));
    const r = await runScenario(scenarios[0], { k: 5 });
    assert.ok(r.metrics.duplicate_rate <= 0.1591,
      "duplicate_rate " + r.metrics.duplicate_rate + " must drop ≥50% from 0.3182");
    assert.strictEqual(r.metrics.recall_at_k, 1,
      "recall@5 must hold (controls not over-merged); misses=" + (r.recall_at_k.misses || []).join(","));
  });

  section("RM-02.c --dedup-existing backfill");

  // Independent 3-D unit axes so tea/cat/dog groups cannot cosine-bleed.
  function axisAt(axis, cos) {
    const c = Number(cos);
    const s = Math.sqrt(Math.max(0, 1 - c * c));
    if (axis === 0) return [c, s, 0];
    if (axis === 1) return [0, c, s];
    return [0, 0, 1];
  }
  const TEA_A = "I prefer tea over coffee";
  const TEA_B = "I like tea more than coffee";
  const CAT_A = "I have a cat named Koneko";
  const CAT_B = "I have a black cat named Koneko";
  const DOG = "I have a dog named Rex";
  const FIXTURE_TABLE = {
    [TEA_A]: [1, 0, 0],
    [TEA_B]: axisAt(0, 0.9522),
    [CAT_A]: [0, 1, 0],
    [CAT_B]: axisAt(1, 0.9435),
    [DOG]: [0, 0, 1],
  };
  const FIXTURE_TEXTS = [TEA_A, TEA_B, CAT_A, CAT_B, DOG];
  const T_BACKFILL = "2026-09-05T12:00:00.000Z";

  function seedRaw(file, rows) {
    const store = new JsonlStore(tmp(file));
    const t0 = "2026-01-01T00:00:00.000Z";
    for (const row of rows) {
      store.add(normalize({
        id: store.nextId(),
        created: t0, modified: t0, text: row.text,
        embedding: row.embedding != null ? row.embedding : null,
        valid_from: t0, last_confirmed: t0,
        access_count: row.access_count || 0,
      }));
    }
    return store;
  }
  function seedFixture(file, texts) {
    return seedRaw(file, (texts || FIXTURE_TEXTS).map((t) => ({
      text: t, embedding: FIXTURE_TABLE[t] ? FIXTURE_TABLE[t].slice() : null,
    })));
  }
  function currentTexts(store) {
    return store.current().map((r) => r.text).sort();
  }

  await atest("dry-run mutates NOTHING (bytes + mtime) and reports the known plan", async () => {
    const store = seedFixture("dedup-ex-dry.jsonl");
    const before = fs.readFileSync(store.file, "utf8");
    const mtime = fs.statSync(store.file).mtimeMs;
    const plan = await dedupExisting({ store, apply: false, now: T_BACKFILL });
    assert.strictEqual(plan.wrote, false, "dry-run must not apply");
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), before, "store bytes unchanged");
    assert.strictEqual(fs.statSync(store.file).mtimeMs, mtime, "mtime unchanged");
    assert.strictEqual(plan.restatements.length, 1, "tea paraphrase is a restatement");
    assert.strictEqual(plan.restatements[0].incomingText, TEA_B);
    assert.strictEqual(plan.restatements[0].matchText, TEA_A);
    assert.strictEqual(plan.merges.length, 1, "cat pair is a mid-band merge");
    assert.strictEqual(plan.merges[0].survivorText, CAT_B, "longer original survives");
    assert.strictEqual(plan.merges[0].loserText, CAT_A);
    assert.ok(!plan.restatements.some((r) => r.incomingText === DOG || r.matchText === DOG));
    assert.ok(!plan.merges.some((m) => m.survivorText === DOG || m.loserText === DOG),
      "control dog must not enter the plan");
    assert.strictEqual(plan.beforeCount, 5);
    assert.strictEqual(plan.afterCount, 3);
    assert.strictEqual(plan.skipped.length, 0);
    const { formatPlan } = require("./dedup-existing.js");
    const out = formatPlan(plan, { apply: false, storePath: store.file });
    assert.ok(/dry-run/i.test(out));
    assert.ok(/Nothing written/i.test(out));
    assert.ok(/Restatements \(1\)/.test(out));
    assert.ok(/Merges \(1\)/.test(out));
  });

  await atest("apply end state matches sequential save() through 02.b (current texts)", async () => {
    const embed = async (texts) => texts.map((t) => (FIXTURE_TABLE[t] || [0, 0, 1]).slice());
    const online = new JsonlStore(tmp("dedup-ex-online.jsonl"));
    const core = createCore({ store: online, embed });
    for (const t of FIXTURE_TEXTS) await core.save(t);

    const offline = seedFixture("dedup-ex-offline.jsonl");
    const seeded = offline.all().length;
    const plan = await dedupExisting({ store: offline, apply: true, now: T_BACKFILL });
    assert.strictEqual(plan.wrote, true);
    assert.deepStrictEqual(currentTexts(offline), currentTexts(online),
      "offline backfill current() must match one-by-one save()");
    assert.strictEqual(offline.current().length, 3, "tea + cat + dog");
    assert.strictEqual(offline.all().length, seeded, "I8: backfill never hard-deletes");
    const tea = offline.current().find((r) => r.text === TEA_A);
    assert.ok(tea, "HI restatement keeps the earlier original");
    const cat = offline.current().find((r) => r.text === CAT_B);
    assert.ok(cat, "mid merge keeps the longer original");
    const catLoser = offline.active().find((r) => r.text === CAT_A);
    assert.ok(catLoser && catLoser.superseded_by === cat.id && catLoser.valid_to,
      "merge loser is superseded, not deleted");
    const teaLoser = offline.active().find((r) => r.text === TEA_B);
    assert.ok(teaLoser && teaLoser.superseded_by === tea.id,
      "already-stored restatement is superseded (I8) rather than dropped");
  });

  await atest("second --apply is a no-op; clean store reports nothing to do", async () => {
    const store = seedFixture("dedup-ex-idem.jsonl");
    await dedupExisting({ store, apply: true, now: T_BACKFILL });
    const before = fs.readFileSync(store.file, "utf8");
    const mtime = fs.statSync(store.file).mtimeMs;
    const again = await dedupExisting({ store, apply: true, now: T_BACKFILL });
    assert.ok(again.nothingToDo, "nothing left to merge");
    assert.strictEqual(again.wrote, false, "second apply must not rewrite");
    assert.strictEqual(again.restatements.length, 0);
    assert.strictEqual(again.merges.length, 0);
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), before);
    assert.strictEqual(fs.statSync(store.file).mtimeMs, mtime);

    const clean = seedRaw("dedup-ex-clean.jsonl", [
      { text: "alpha", embedding: [1, 0, 0] },
      { text: "beta", embedding: [0, 1, 0] },
    ]);
    const p = await dedupExisting({ store: clean, apply: true });
    assert.ok(p.nothingToDo);
    assert.strictEqual(p.wrote, false);
    assert.strictEqual(clean.current().length, 2);
  });

  await atest("vectorless row is skipped, not merged (embedder down)", async () => {
    const store = seedRaw("dedup-ex-novec.jsonl", [
      { text: TEA_A, embedding: [1, 0, 0] },
      { text: TEA_B, embedding: null },
    ]);
    const before = fs.readFileSync(store.file, "utf8");
    const embed = async () => { throw new Error("embedder down"); };
    const plan = await dedupExisting({ store, embed, apply: true, now: T_BACKFILL });
    assert.strictEqual(plan.skipped.length, 1);
    assert.strictEqual(plan.skipped[0].reason, "no vector");
    assert.strictEqual(plan.restatements.length, 0, "must not merge blind");
    assert.strictEqual(plan.merges.length, 0);
    assert.strictEqual(store.current().length, 2, "both still current");
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), before,
      "apply with nothing to patch must not rewrite");
  });

  await atest("vectorless row re-embeds then restates when the embedder is up", async () => {
    const store = seedRaw("dedup-ex-fill.jsonl", [
      { text: TEA_A, embedding: [1, 0, 0] },
      { text: TEA_B, embedding: null },
    ]);
    const embed = async (texts) => texts.map((t) => (FIXTURE_TABLE[t] || [1, 0, 0]).slice());
    const plan = await dedupExisting({ store, embed, apply: true, now: T_BACKFILL });
    assert.strictEqual(plan.skipped.length, 0);
    assert.strictEqual(plan.vectorBackfills, 1);
    assert.strictEqual(plan.restatements.length, 1);
    assert.strictEqual(store.current().length, 1);
    const loser = store.active().find((r) => r.text === TEA_B);
    assert.ok(loser && Array.isArray(loser.embedding) && loser.embedding.length,
      "filled vector is persisted on the superseded row too");
  });

  await atest("apply is one durable rewrite (I5) and loses no memory (I8)", async () => {
    const store = seedFixture("dedup-ex-i5.jsonl");
    const nSeeded = store.all().length;
    let many = 0, one = 0;
    const origMany = store.updateMany.bind(store);
    const origOne = store.update.bind(store);
    store.updateMany = function () { many++; return origMany.apply(this, arguments); };
    store.update = function () { one++; return origOne.apply(this, arguments); };
    await dedupExisting({ store, apply: true, now: T_BACKFILL });
    assert.strictEqual(many, 1, "one updateMany → one writeFileDurable");
    assert.strictEqual(one, 0, "never a per-pair store.update");
    const dir = path.dirname(store.file);
    const marker = "." + path.basename(store.file) + ".";
    const tmps = fs.readdirSync(dir).filter((n) => n.indexOf(marker) === 0 && n.slice(-4) === ".tmp");
    assert.strictEqual(tmps.length, 0, "writeFileDurable leaves no temp files");
    const raw = fs.readFileSync(store.file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    assert.ok(raw.endsWith("\n"));
    for (const line of lines) JSON.parse(line);  // every line parseable — not truncated
    assert.strictEqual(store.all().length, nSeeded, "I8: survivors + superseded both present");
    assert.ok(store.active().every((r) => !r.deleted), "no hard/soft-delete of losers");
  });

  await atest("CLI --dedup-existing (entry.js) dry-run default; --apply required to mutate", async () => {
    const { spawnSync } = require("child_process");
    const store = seedFixture("dedup-ex-cli.jsonl");
    const before = fs.readFileSync(store.file, "utf8");
    const entry = path.join(__dirname, "entry.js");
    const env = Object.assign({}, process.env);
    delete env.RESONANCE_DEDUP_HI;
    delete env.RESONANCE_DEDUP_LO;
    delete env.RESONANCE_MEMORY_CONFIG;
    const dry = spawnSync(process.execPath, [entry, "--dedup-existing", "--json", store.file], {
      encoding: "utf8", timeout: 15000, env,
    });
    assert.strictEqual(dry.status, 0, "dry-run exit: " + (dry.stderr || dry.stdout));
    const report = JSON.parse(dry.stdout);
    assert.strictEqual(report.applied, false);
    assert.strictEqual(report.wrote, false);
    assert.strictEqual(report.restatements.length, 1);
    assert.strictEqual(report.merges.length, 1);
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), before, "CLI dry-run mutates nothing");

    const applied = spawnSync(process.execPath, [entry, "--dedup-existing", "--apply", "--json", store.file], {
      encoding: "utf8", timeout: 15000, env,
    });
    assert.strictEqual(applied.status, 0, "apply exit: " + (applied.stderr || applied.stdout));
    const after = JSON.parse(applied.stdout);
    assert.strictEqual(after.applied, true);
    assert.strictEqual(after.wrote, true);
    assert.strictEqual(after.afterCount, 3);
    assert.notStrictEqual(fs.readFileSync(store.file, "utf8"), before);
    assert.strictEqual(new JsonlStore(store.file).current().length, 3);
  });

  await atest("duplicates corpus backfill: plan matches groups; dup_rate 0.3182→0; recall@5 holds", async () => {
    const { embed } = require("./eval/embed-cache.js");
    const { loadScenarios, resolveRelevant } = require("./eval/measure.js");
    const { groupsFromWrites, explainMetric, parsePrimaryHits } = require("./eval/metrics.js");
    const scenarios = loadScenarios(path.join(__dirname, "eval", "corpora", "duplicates.jsonl"));
    const writes = scenarios[0].writes;
    const groups = groupsFromWrites(writes);
    const textToGroup = {};
    for (const w of writes) textToGroup[w.text] = w.dup_group;

    // Pre-02.b shape: exact restatement already existed, so drop the second
    // byte-identical coffee-order write. 22 current, 7 extras (4 HI + 3 mid).
    const seenExact = new Set();
    const pre02b = [];
    for (const w of writes) {
      if (w.band === "exact") {
        if (seenExact.has(w.text)) continue;
        seenExact.add(w.text);
      }
      pre02b.push(w);
    }
    const vecs = await embed(pre02b.map((w) => w.text));
    const store = new JsonlStore(tmp("dedup-ex-corpus.jsonl"));
    for (let i = 0; i < pre02b.length; i++) {
      store.add(normalize({
        id: i + 1,
        text: pre02b[i].text,
        embedding: vecs[i],
        created: "2026-01-01T00:00:00.000Z",
      }));
    }
    const beforeBytes = fs.readFileSync(store.file, "utf8");
    const beforeDup = explainMetric("duplicate_rate", { records: store.current() }, { groups });
    assert.strictEqual(beforeDup.extras, 7);
    assert.ok(Math.abs(beforeDup.rate - 7 / 22) < 1e-9, "pre-02.b baseline 0.3182");

    const dry = await dedupExisting({ store, apply: false, now: T_BACKFILL });
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), beforeBytes, "corpus dry-run is a no-write");
    const restateGroups = new Set(dry.restatements.map((r) => textToGroup[r.incomingText]));
    const mergeGroups = new Set(dry.merges.map((m) => textToGroup[m.loserText] || textToGroup[m.survivorText]));
    assert.ok(restateGroups.has("penicillin") && restateGroups.has("tea") && restateGroups.has("peanuts"),
      "HI groups are restatements");
    assert.ok(!restateGroups.has("coffee-order"), "exact pair already collapsed in this fixture");
    assert.ok(mergeGroups.has("job") && mergeGroups.has("cat") && mergeGroups.has("diabetic"),
      "mid groups are merges");
    for (const g of ["dog", "peanut-allergy", "standup", "mechanic", "name", "night-owl", "sister-bday", "garage"]) {
      assert.ok(!restateGroups.has(g) && !mergeGroups.has(g), "control " + g + " must not collapse");
    }
    assert.strictEqual(dry.restatements.length, 4, "4 HI extras");
    assert.strictEqual(dry.merges.length, 3, "3 mid extras");
    assert.strictEqual(dry.afterCount, 15);

    const applied = await dedupExisting({ store, apply: true, now: T_BACKFILL });
    assert.strictEqual(applied.wrote, true);
    const recs = store.current();
    const afterDup = explainMetric("duplicate_rate", { records: recs }, { groups });
    assert.strictEqual(afterDup.rate, 0, "duplicate_rate dropped to 0");
    assert.strictEqual(recs.length, 15);

    const core = createCore({ store, embed });
    let hits = 0;
    const misses = [];
    for (const q of scenarios[0].queries) {
      const output = await core.recall(q.query, 5);
      const ranked = parsePrimaryHits(output).map((h) => String(h.id));
      const relevant = resolveRelevant(q, recs, groups).map(String);
      if (relevant.some((id) => ranked.indexOf(id) >= 0)) hits++;
      else misses.push(q.id);
    }
    assert.strictEqual(hits, scenarios[0].queries.length,
      "recall@5 held; misses=" + misses.join(","));
  });

  section("edit() embedding safety");

  const makeCore = (file, liveRef) => {
    const store = new JsonlStore(tmp(file));
    const embed = async (texts) => {
      if (!liveRef.live) throw new Error("embedder unreachable");
      return texts.map(() => [1, 0, 0]);
    };
    return { store, core: createCore({ store, embed }) };
  };

  await atest("a failed re-embed leaves the prior embedding intact", async () => {
    const ref = { live: true };
    const { store, core } = makeCore("bug007a.jsonl", ref);
    await core.save("the dentist is on Tuesday");
    const before = store.all()[0].embedding;
    assert.ok(Array.isArray(before) && before.length === 3, "saved with an embedding");

    ref.live = false;                       // embedder goes down
    const id = store.all()[0].id;
    await core.edit(id, "the dentist is on Thursday");

    const after = store.all()[0];
    assert.strictEqual(after.text, "the dentist is on Thursday", "text still updates");
    assert.deepStrictEqual(after.embedding, before, "prior embedding survives");
  });

  await atest("a failed re-embed is reported, not silent", async () => {
    const ref = { live: true };
    const { store, core } = makeCore("bug007b.jsonl", ref);
    await core.save("coffee with Dana");
    ref.live = false;
    const msg = await core.edit(store.all()[0].id, "coffee with Dana on Friday");
    assert.ok(/keyword/i.test(msg), "the degraded state is surfaced to the caller");
  });

  await atest("a successful re-embed still replaces the embedding", async () => {
    const ref = { live: true };
    const store = new JsonlStore(tmp("bug007c.jsonl"));
    let vec = [1, 0, 0];
    const embed = async (texts) => {
      if (!ref.live) throw new Error("embedder unreachable");
      return texts.map(() => vec.slice());
    };
    const core = createCore({ store, embed });
    await core.save("first");
    vec = [0, 1, 0];
    await core.edit(store.all()[0].id, "second");
    assert.deepStrictEqual(store.all()[0].embedding, [0, 1, 0], "fresh vector replaces the old one");
  });

  await atest("edit on a missing id still reports not-found", async () => {
    const ref = { live: true };
    const { core } = makeCore("bug007d.jsonl", ref);
    const msg = await core.edit(99999, "nothing here");
    assert.ok(/No memory with id/.test(msg));
  });

  // ------------------------------------------------ embedding_version (Phase 0.0)
  // Validity of cached semantic edges is a version comparison. These four
  // (plus the attack cases) must fail without the schema change / lockstep bump.
  section("embedding_version");

  await atest("a fresh save is embedding_version 1", async () => {
    const ref = { live: true };
    const { store, core } = makeCore("embver-save.jsonl", ref);
    await core.save("brand new memory");
    assert.strictEqual(store.all()[0].embedding_version, 1);
  });

  await atest("a successful edit() re-embed increments embedding_version", async () => {
    const ref = { live: true };
    const store = new JsonlStore(tmp("embver-edit.jsonl"));
    let vec = [1, 0, 0];
    const embed = async (texts) => texts.map(() => vec.slice());
    const core = createCore({ store, embed });
    await core.save("first");
    assert.strictEqual(store.all()[0].embedding_version, 1, "save starts at 1");
    vec = [0, 1, 0];
    await core.edit(store.all()[0].id, "second");
    assert.strictEqual(store.all()[0].embedding_version, 2, "first re-embed -> 2");
    assert.deepStrictEqual(store.all()[0].embedding, [0, 1, 0]);
    vec = [0, 0, 1];
    await core.edit(store.all()[0].id, "third");
    assert.strictEqual(store.all()[0].embedding_version, 3, "second re-embed -> 3");
  });

  await atest("a dead embedder does NOT increment embedding_version AND keeps the vector", async () => {
    const ref = { live: true };
    const { store, core } = makeCore("embver-dead.jsonl", ref);
    await core.save("the dentist is on Tuesday");
    const before = store.all()[0];
    assert.strictEqual(before.embedding_version, 1);
    assert.ok(Array.isArray(before.embedding) && before.embedding.length === 3);

    ref.live = false;
    const id = before.id;
    const msg = await core.edit(id, "the dentist is on Thursday");
    const after = store.all()[0];
    assert.strictEqual(after.text, "the dentist is on Thursday", "text still updates");
    assert.strictEqual(after.embedding_version, 1, "failed embed must not bump the version");
    assert.deepStrictEqual(after.embedding, before.embedding, "prior embedding survives (BUG-008)");
    assert.ok(/keyword/i.test(msg), "degraded state is reported");
  });

  await atest("a save with a dead embedder is still version 1 (not 0, not missing)", async () => {
    const ref = { live: false };
    const { store, core } = makeCore("embver-save-dead.jsonl", ref);
    await core.save("saved while the embedder was down");
    const rec = store.all()[0];
    assert.strictEqual(rec.embedding_version, 1);
    assert.strictEqual(rec.embedding, null, "no vector, but version is still 1");
  });

  await atest("embed returning empty/null without throwing does not bump or clobber", async () => {
    // The throw path is the common outage; a broken embedder that returns a
    // hole instead of throwing is the same class and must take the omit path.
    const store = new JsonlStore(tmp("embver-hole.jsonl"));
    let mode = "ok";
    const embed = async (texts) => {
      if (mode === "ok") return texts.map(() => [1, 0, 0]);
      if (mode === "empty") return texts.map(() => []);
      return texts.map(() => null);
    };
    const core = createCore({ store, embed });
    await core.save("original");
    const before = store.all()[0];
    mode = "empty";
    await core.edit(before.id, "edited with empty vector");
    let after = store.all()[0];
    assert.strictEqual(after.embedding_version, 1, "empty array is not a successful re-embed");
    assert.deepStrictEqual(after.embedding, before.embedding);
    mode = "null";
    await core.edit(before.id, "edited with null vector");
    after = store.all()[0];
    assert.strictEqual(after.embedding_version, 1, "null vector is not a successful re-embed");
    assert.deepStrictEqual(after.embedding, before.embedding);
    assert.strictEqual(after.text, "edited with null vector");
  });

  await atest("exact restatement confirm does not increment embedding_version", async () => {
    const ref = { live: true };
    const { store, core } = makeCore("embver-confirm.jsonl", ref);
    await core.save("I drink tea");
    const id = store.all()[0].id;
    await core.save("I drink tea");          // confirm, not a new row
    assert.strictEqual(store.all().length, 1);
    assert.strictEqual(store.get(id).embedding_version, 1);
  });

  section("warm hook in createCore (silent, flags-off default)");

  // Orthogonal embeddings so ranking is deterministic: query [1,0] hits A, then B.
  const pack = {
    "alpha lives here": [1, 0],
    "beta is nearby": [0.8, 0.6],
    "gamma is far away": [0, 1],
    "alpha": [1, 0],
  };
  const packEmbed = async (texts) => texts.map((t) => pack[t] || [0, 1]);

  function scanActivation(dir) {
    const FORBIDDEN = /^(energy|resonance|activation|current_resonance|warmth|warm_field)$/i;
    const hits = [];
    function walk(v, file, pth) {
      if (!v || typeof v !== "object") return;
      for (const [k, val] of Object.entries(v)) {
        if (FORBIDDEN.test(k)) hits.push(file + ":" + pth + k);
        walk(val, file, pth + k + ".");
      }
    }
    if (!fs.existsSync(dir)) return hits;
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (fs.statSync(fp).isDirectory()) {
        hits.push(...scanActivation(fp).map((h) => name + "/" + h));
        continue;
      }
      if (/\b(warm|activation|energy|resonance)\b/i.test(name)) {
        hits.push("filename:" + name);
      }
      const raw = fs.readFileSync(fp, "utf8");
      for (const line of raw.split("\n").filter(Boolean)) {
        try { walk(JSON.parse(line), name, ""); } catch { /* not json */ }
      }
    }
    return hits;
  }

  await atest("flags-off recall is byte-identical to a core with no warm injection", async () => {
    const store = new JsonlStore(tmp("warm-off.jsonl"));
    const a = createCore({ store, embed: packEmbed });
    await a.save("alpha lives here");
    await a.save("beta is nearby");
    const off = await a.recall("alpha");
    const b = createCore({ store, embed: packEmbed, warmEnabled: () => false });
    const alsoOff = await b.recall("alpha");
    assert.strictEqual(alsoOff, off);
  });

  await atest("warm-ENABLED-but-unconsumed recall is byte-identical to warm-off", async () => {
    const store = new JsonlStore(tmp("warm-silent.jsonl"));
    const W = new WarmField();
    const offCore = createCore({ store, embed: packEmbed });
    await offCore.save("alpha lives here");
    await offCore.save("beta is nearby");
    await offCore.save("gamma is far away");
    const off = await offCore.recall("alpha");

    const onCore = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getWarm: () => W,
      saveSeed: () => false,
    });
    const on = await onCore.recall("alpha");
    assert.strictEqual(on, off, "silent hook must not change the output string");
    assert.ok(W.nodes.size > 0, "decay/seed/spread actually ran (map is not empty)");
    const primaryId = String(store.current()[0].id);
    // ranked order is cosine, first listing is the top hit — seed it at 1.0
    assert.ok(/\[id /.test(on));
    const seeded = [...W.nodes.entries()].some(([, n]) => n.value === 1.0);
    assert.ok(seeded, "at least one node seeded at E=1.0");
    void primaryId;
  });

  await atest("warmth survives a second recall on the same core (session = process)", async () => {
    const store = new JsonlStore(tmp("warm-session.jsonl"));
    const W = new WarmField();
    const core = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getWarm: () => W,
      saveSeed: () => false,
    });
    await core.save("alpha lives here");
    await core.save("beta is nearby");
    await core.recall("alpha");
    const sizeAfterFirst = W.nodes.size;
    assert.ok(sizeAfterFirst > 0);
    await core.recall("alpha");
    assert.ok(W.nodes.size > 0, "second recall did not wipe the map");
  });

  await atest("forget-after-remove: a deleted id is not warm", async () => {
    const store = new JsonlStore(tmp("warm-forget.jsonl"));
    const W = new WarmField();
    const core = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getWarm: () => W,
      saveSeed: () => false,
    });
    await core.save("alpha lives here");
    await core.save("beta is nearby");
    await core.recall("alpha");
    const id = store.current()[0].id;
    assert.ok(W.get(id) > 0, "id was seeded");
    core.remove(id);
    assert.strictEqual(W.get(id), 0, "remove forgot the id");
  });

  await atest("I3: a throwing getEdges degrades to plain cosine, does not break recall", async () => {
    const store = new JsonlStore(tmp("warm-i3.jsonl"));
    const off = createCore({ store, embed: packEmbed });
    await off.save("alpha lives here");
    await off.save("beta is nearby");
    const expected = await off.recall("alpha");
    const on = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getEdges: () => { throw new Error("edges boom"); },
    });
    const got = await on.recall("alpha");
    assert.strictEqual(got, expected, "cosine output survives a warm-path throw");
  });

  await atest("I7: after a warm recall, no activation-shaped key is on disk", async () => {
    const dir = path.join(tmpRoot, "warm-i7");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "store.jsonl");
    const store = new JsonlStore(file);
    const W = new WarmField();
    const core = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getWarm: () => W,
      saveSeed: () => false,
    });
    await core.save("alpha lives here");
    await core.save("beta is nearby");
    await core.recall("alpha");
    assert.ok(W.nodes.size > 0, "warmth existed in RAM");
    const hits = scanActivation(dir);
    assert.deepStrictEqual(hits, [], "I7 violated: " + hits.join(", "));
    // Belt: the in-proc map is the only copy — a new WarmField cannot see it.
    assert.strictEqual(new WarmField().get([...W.nodes.keys()][0]), 0);
  });

  await atest("shouldSpread false still seeds, but does not spread (cap at spread only)", async () => {
    const store = new JsonlStore(tmp("warm-cap.jsonl"));
    const W = new WarmField();
    const core = createCore({
      store, embed: packEmbed,
      warmEnabled: () => true,
      getWarm: () => W,
      saveSeed: () => false,
      warmEdgeCap: () => 0,              // skip spread
      getEdges: () => chainEdges([["will-not", "matter", 1]]),
    });
    await core.save("alpha lives here");
    await core.save("beta is nearby");
    const out = await core.recall("alpha");
    assert.ok(/alpha lives here/.test(out));
    const seeded = [...W.entries()].filter(([, n]) => n.value === 1.0);
    assert.ok(seeded.length > 0, "seed still happens when cap skips spread");
    // With cap 0, getEdges is not consulted for spread; only thisTurn seeds exist at 1.0
    const extras = [...W.entries()].filter(([, n]) => n.value > 0 && n.value < 1.0);
    assert.strictEqual(extras.length, 0, "no spread energy when shouldSpread is false");
  });

  // ------------------------------------------------ Slice C: EdgeStore on the live path
  section("Slice C: EdgeStore wired into recall");

  function primaryBlock(out) {
    const i = String(out).indexOf("\n\nRelated:");
    return i < 0 ? String(out) : String(out).slice(0, i);
  }

  const DIABETIC = "I'm diabetic, so no sugary desserts for me";
  const LEMON = "I always bring lemon bars to the potluck";
  const MEETING = "The quarterly planning meeting is on Tuesday";
  const DESSERT_Q = "dessert for the potluck";
  const rescueVec = {
    [DIABETIC]: [1, 0],
    [LEMON]: [0.6, 0.8],          // cos(diabetic, lemon) = 0.60 >= CONSTRAINT_GATE 0.45
    [MEETING]: [0, 1],
    [DESSERT_Q]: [0.6, 0.8],      // ranks lemon first, meeting second, diabetic third
  };

  function liveField(file, fieldOn, opts = {}) {
    const store = new JsonlStore(tmp(file));
    const edgesPath = opts.edgesPath || tmp(file + ".edges.json");
    const embed = async (texts) => texts.map((t) => rescueVec[t] || [0, 0, 1]);
    let _e = null;
    const getEdgeStore = opts.getEdgeStore || (() => {
      if (!_e) _e = new EdgeStore(edgesPath, { now: () => T0 });
      return _e;
    });
    const core = createCore({
      store, embed,
      fieldEnabled: () => fieldOn,
      getEdgeStore,
    });
    return { store, core, edgesPath, edges: () => getEdgeStore() };
  }

  await atest("constraint-rescue still fires through recall (field experiment #2)", async () => {
    const { core } = liveField("c-rescue.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const out = await core.recall(DESSERT_Q, 1);
    assert.ok(/lemon bars/.test(out), "bridge is the cosine primary");
    assert.ok(!primaryBlock(out).includes("diabetic"), "constraint is NOT in the returned top-k");
    assert.ok(/\n\nRelated:/.test(out), "Related: block present");
    assert.ok(/diabetic/.test(out), "constraint rescued into Related via the lemon-bars bridge");
  });

  await atest("I9: field-on vs field-off primary results are byte-identical", async () => {
    // Same store, two cores: ids must not drift or the primary strings won't match.
    const seeded = liveField("c-i9.jsonl", false);
    await seeded.core.save(DIABETIC);
    await seeded.core.save(LEMON);
    await seeded.core.save(MEETING);
    const embed = async (texts) => texts.map((t) => rescueVec[t] || [0, 0, 1]);
    const off = createCore({
      store: seeded.store, embed, fieldEnabled: () => false,
      getEdgeStore: () => new EdgeStore(tmp("c-i9-off.edges.json")),
    });
    const on = createCore({
      store: seeded.store, embed, fieldEnabled: () => true,
      getEdgeStore: () => new EdgeStore(tmp("c-i9-on.edges.json")),
    });
    const offOut = await off.recall(DESSERT_Q, 1);
    const onOut = await on.recall(DESSERT_Q, 1);
    assert.strictEqual(primaryBlock(onOut), primaryBlock(offOut), "I9: primary cosine must not move");
    assert.strictEqual(primaryBlock(onOut), offOut, "field-off has no Related: tail");
    assert.ok(/\n\nRelated:/.test(onOut), "field-on is allowed to append Related:");
  });

  await atest("entity mismatch at cosine 0.88 is dropped from Related:; same-person pair is kept", async () => {
    const SIS = "My sister Naima teaches chemistry at the local high school";
    const CALL = "I call my sister Naima every Sunday evening to catch up";
    const JOB = "My coworker Naima is a frontend engineer on the infrastructure team";
    const OTHER = "The quarterly planning meeting is on Tuesday";
    const Q = "tell me about my sister Naima";
    const atCos = (c) => [c, Math.sqrt(1 - c * c), 0];
    const vecs = {
      [SIS]: [1, 0, 0],
      [CALL]: atCos(0.80),
      [JOB]: atCos(0.88),
      [OTHER]: [0, 0, 1],
      [Q]: [1, 0, 0],
    };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 1, 0]);
    const store = new JsonlStore(tmp("ent-field.jsonl"));
    const core = createCore({
      store, embed,
      fieldEnabled: () => true,
      getEdgeStore: () => new EdgeStore(tmp("ent-field.edges.json"), { now: () => T0 }),
      dedupThresholds: () => ({ hi: 2, lo: 2 }),
    });
    await core.save(SIS);
    await core.save(CALL);
    await core.save(JOB);
    await core.save(OTHER);
    const out = await core.recall(Q, 1);
    assert.ok(out.includes("sister Naima") && out.includes("chemistry"), "primary is sister-Naima");
    assert.ok(/Sunday/.test(out), "same-person Sunday-call surfaces in Related:");
    assert.ok(!/coworker/.test(out) && !/engineer/.test(out),
      "coworker-Naima must not be Related: despite cosine 0.88");
    assert.strictEqual(primaryBlock(out).includes("coworker"), false, "I2: we did not reorder primary to drop coworker; k=1 just didn't rank it first");
  });

  await atest("I3: corrupt .edges.json still returns cosine; recall does not throw", async () => {
    const seeded = liveField("c-i3.jsonl", false);
    await seeded.core.save(DIABETIC);
    await seeded.core.save(LEMON);
    await seeded.core.save(MEETING);
    const embed = async (texts) => texts.map((t) => rescueVec[t] || [0, 0, 1]);
    const offOut = await createCore({
      store: seeded.store, embed, fieldEnabled: () => false,
    }).recall(DESSERT_Q, 1);
    const edgesPath = tmp("c-i3.edges.json");
    fs.writeFileSync(edgesPath, "{ this is not json");
    let out;
    await assert.doesNotReject(async () => {
      out = await createCore({
        store: seeded.store, embed, fieldEnabled: () => true,
        getEdgeStore: () => new EdgeStore(edgesPath),
      }).recall(DESSERT_Q, 1);
    });
    assert.ok(/lemon bars/.test(out), "cosine primary survived a corrupt sidecar");
    assert.strictEqual(primaryBlock(out), offOut, "corrupt sidecar degrades to plain cosine");
  });

  await atest("I3: a throwing getEdgeStore degrades to plain cosine", async () => {
    const seeded = liveField("c-i3-throw.jsonl", false);
    await seeded.core.save(DIABETIC);
    await seeded.core.save(LEMON);
    const embed = async (texts) => texts.map((t) => rescueVec[t] || [0, 0, 1]);
    const expected = await createCore({
      store: seeded.store, embed, fieldEnabled: () => false,
    }).recall(DESSERT_Q, 1);
    const got = await createCore({
      store: seeded.store, embed, fieldEnabled: () => true,
      getEdgeStore: () => { throw new Error("edges boom"); },
    }).recall(DESSERT_Q, 1);
    assert.strictEqual(got, expected, "throw from getEdgeStore must not escape recall()");
  });

  await atest("I5: reinforcement writes .edges.json and never the JSONL store", async () => {
    const { core, store, edgesPath } = liveField("c-i5.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const jsonlBytes = fs.readFileSync(store.file, "utf8");
    const assocPath = edgesPath.replace(/\.edges\.json$/, ".assoc.json");
    const out = await core.recall(DESSERT_Q, 1);
    assert.ok(/lemon bars/.test(out));
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), jsonlBytes, "recall must not rewrite the JSONL store");
    assert.ok(fs.existsSync(edgesPath), "reinforcement persisted to .edges.json");
    assert.strictEqual(fs.existsSync(assocPath), false, "must not write the retired .assoc.json");
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.strictEqual(j.kind, SIDECAR_KIND);
    assert.strictEqual(j.recalls, 0, "epoch clock is no longer advanced on recall (I6)");
    assert.ok(Object.keys(j.edges).length >= 1, "co-recall wrote at least one Hebbian edge");
  });

  await atest("edit() does not write the edge store (transition table)", async () => {
    const { core, store, edgesPath } = liveField("c-edit.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    await core.recall(DESSERT_Q, 1);
    const before = fs.readFileSync(edgesPath, "utf8");
    const id = store.current().find((m) => m.text === MEETING).id;
    await core.edit(id, MEETING);   // re-embed, bump embedding_version; no edge write
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), before, "edit must not touch .edges.json");
  });

  await atest("legacy .assoc.json bonuses survive through recall (storage move ≠ number move)", async () => {
    const file = tmp("c-mig.jsonl");
    const store = new JsonlStore(file);
    const assoc = file + ".assoc.json";
    const edges = file + ".edges.json";
    const embed = async (texts) => texts.map((t) => rescueVec[t] || [0, 0, 1]);
    const off = createCore({ store, embed, fieldEnabled: () => false });
    await off.save(DIABETIC);
    await off.save(LEMON);
    await off.save(MEETING);
    const ids = store.current().map((m) => String(m.id));
    // Seed a learned weight between lemon and diabetic that Ledger would have held.
    writeLegacyAssoc(assoc, { [ [ids[0], ids[1]].sort().join(":") ]: 0.8 });
    const L = new Ledger(assoc);
    let _e = null;
    const on = createCore({
      store, embed,
      fieldEnabled: () => true,
      getEdgeStore: () => { if (!_e) _e = new EdgeStore(edges, { now: () => T0 }); return _e; },
    });
    // Constructing the store (first field-on recall) migrates. Bonuses must match
    // Ledger's reading of the same fixture BEFORE the recall reinforces.
    const E = new EdgeStore(edges, { now: () => T0 });
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        assert.strictEqual(E.bonus(ids[i], ids[j]), L.bonus(ids[i], ids[j]),
          "migrated bonus drifted for " + ids[i] + ":" + ids[j]);
      }
    }
    const out = await on.recall(DESSERT_Q, 1);
    assert.ok(/lemon bars/.test(primaryBlock(out)));
    assert.strictEqual(fs.readFileSync(assoc, "utf8").includes("resonance-edges"), false,
      ".assoc.json must stay the old format (untouched)");
    void out;
  });

  await atest("I6: 100 field-on recalls under a frozen clock do not decay an uninvolved edge; reinforce still strengthens co-recalled ones", async () => {
    // Headline live-path proof. Old tick() would have multiplied every stored
    // weight by 0.95 on the 10th/20th/... recall. After 0.2 the decay clock
    // is wall-clock, and this clock is frozen, so stored Hebbian of an edge
    // that is NOT co-recalled must be byte-identical after 100 recalls.
    const { core, store, edgesPath, edges } = liveField("c-i6.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const E = edges();   // same instance recall() will mutate — a second load would be overwritten
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    const lemonId = store.current().find((m) => m.text === LEMON).id;
    const meetingId = store.current().find((m) => m.text === MEETING).id;
    // Uninvolved pair: meeting is orthogonal to the dessert query, so it
    // will not land in primary or Related. Seed a learned weight on it.
    E.put(makeEdge(meetingId, diabeticId, {
      origin: "co-activation", now: T0, hebbianWeight: 1.0,
      semantic: { value: 0.4, src_versions: { a: 1, b: 1 } },
    }));
    E.save();
    const snapHeb = JSON.parse(JSON.stringify(E.get(meetingId, diabeticId).hebbian));
    const snapSem = JSON.parse(JSON.stringify(E.get(meetingId, diabeticId).semantic));
    const recallsBefore = E.recalls;
    for (let i = 0; i < 100; i++) await core.recall(DESSERT_Q, 1);
    const live = new EdgeStore(edgesPath, { now: () => T0 });   // reload from disk
    const uninvolved = live.get(meetingId, diabeticId);
    assert.deepStrictEqual(uninvolved.hebbian, snapHeb,
      "uninvolved edge: stored weight + last_updated unmoved after 100 recalls (I6)");
    assert.deepStrictEqual(uninvolved.semantic, snapSem, "semantic unmoved");
    assert.strictEqual(live.recalls, recallsBefore, "recall-epoch clock must not advance");
    // Co-recalled lemon↔diabetic DID strengthen — reinforcement is retained.
    const learned = live.weight(lemonId, diabeticId);
    assert.ok(learned > 0, "co-recall reinforcement still writes Hebbian weight");
    // And a genuine reinforceRecall on the uninvolved pair does change it.
    live.reinforceRecall([String(meetingId), String(diabeticId)], []);
    assert.ok(live.weight(meetingId, diabeticId) > 1.0, "genuine reinforcement still works");
    assert.strictEqual(live.get(meetingId, diabeticId).hebbian.last_updated, T0,
      "frozen clock: last_updated stamps to now, which is still T0 — weight is the signal it fired");
  });

  await atest("I6: recall writes nothing to the edge store on the decay account", async () => {
    // Pair with the I5 test: sidecar writes from reinforceRecall are allowed;
    // decay itself must not move last_updated or stored weight of any edge
    // that was not reinforced this turn.
    const { core, store, edges } = liveField("c-i6-decay-write.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const E = edges();
    const meetingId = store.current().find((m) => m.text === MEETING).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    E.put(makeEdge(meetingId, diabeticId, { origin: "co-activation", now: T0, hebbianWeight: 0.5 }));
    E.save();
    const before = JSON.parse(JSON.stringify(E.get(meetingId, diabeticId)));
    await core.recall(DESSERT_Q, 1);
    const after = E.get(meetingId, diabeticId);
    assert.strictEqual(after.hebbian.weight, before.hebbian.weight, "decay must not rewrite stored weight");
    assert.strictEqual(after.hebbian.last_updated, before.hebbian.last_updated, "decay must not stamp last_updated");
  });

  await atest("reinforceRecall is retained: a co-recalled pair gets stronger", async () => {
    const { core, store, edges } = liveField("c-reinf-kept.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const lemonId = store.current().find((m) => m.text === LEMON).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    const E = edges();
    const before = E.weight(lemonId, diabeticId);
    await core.recall(DESSERT_Q, 1);
    const after = E.weight(lemonId, diabeticId);
    assert.ok(after > before, "co-surfaced lemon↔diabetic gained Hebbian weight");
  });

  // ------------------------------------------------ Phase 0.1: save-time semantic edges
  // Persist-on-save, recall still uses field.js. These must fail without the
  // bind in save() / the 0.25 threshold / canonical src_versions tagging.
  section("Phase 0.1 save-time semantic edges");

  // Unit vector at cosine `c` against [1,0,0].
  function vecAtCos(c) {
    return [c, Math.sqrt(Math.max(0, 1 - c * c)), 0];
  }

  function saveTimeCore(file, embedFn, opts = {}) {
    const store = new JsonlStore(tmp(file));
    const edgesPath = tmp(file + ".edges.json");
    let _e = null;
    const getEdgeStore = opts.getEdgeStore || (() => {
      if (!_e) _e = new EdgeStore(edgesPath, { now: () => T0 });
      return _e;
    });
    const core = createCore({
      store,
      embed: embedFn,
      fieldEnabled: () => !!opts.fieldOn,
      getEdgeStore,
      // Phase 0.1/0.3 bind tests construct many collinear vecAtCos()
      // neighbors whose pairwise cosine is ≥ DEDUP_LO even though the
      // texts are distinct labels ("n90" vs "n80"). Dedup is RM-02.b's
      // job; these tests isolate bind. Bands above 1 disable it.
      dedupThresholds: opts.dedupThresholds || (() => ({ hi: 2, lo: 2 })),
    });
    return { store, core, edgesPath, edges: () => getEdgeStore() };
  }

  await atest("SAVE_TIME constants match the spec (K=5, minCos=0.25, distinct from recall 0.70)", async () => {
    assert.strictEqual(SAVE_TIME_K, 5, "start K ≈ 5");
    assert.strictEqual(SAVE_TIME_MIN_COS, 0.25, "save-time bind ~0.25");
    assert.strictEqual(FIELD_MINSIM, 0.70, "Related: gate is the measured 0.70");
    assert.ok(SAVE_TIME_MIN_COS < FIELD_MINSIM, "must stay looser than field.js recall minSim (Risk #2)");
  });

  await atest("save binds top-K neighbors above ~0.25; extras and below-threshold are dropped", async () => {
    const vecs = {
      hub: [1, 0, 0],
      n90: vecAtCos(0.90),
      n80: vecAtCos(0.80),
      n70: vecAtCos(0.70),
      n60: vecAtCos(0.60),
      n50: vecAtCos(0.50),
      n40: vecAtCos(0.40),   // above 0.25 but 6th — K=5 drops it
      n30: vecAtCos(0.30),
      n20: vecAtCos(0.20),   // below threshold
      n10: vecAtCos(0.10),
    };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("st-k.jsonl", embed);
    for (const name of ["n90", "n80", "n70", "n60", "n50", "n40", "n30", "n20", "n10"]) {
      await core.save(name);
    }
    await core.save("hub");
    const hubId = store.current().find((m) => m.text === "hub").id;
    const incident = edges().incident(hubId);
    assert.strictEqual(incident.length, SAVE_TIME_K, "exactly K neighbors, not every above-threshold pair");
    const nbrIds = new Set();
    for (const e of incident) nbrIds.add(e.a === String(hubId) ? e.b : e.a);
    const byId = new Map(store.current().map((m) => [String(m.id), m]));
    const nbrTexts = [...nbrIds].map((id) => byId.get(String(id)).text).sort();
    assert.deepStrictEqual(nbrTexts, ["n50", "n60", "n70", "n80", "n90"],
      "top-5 by cosine; n40 (6th) and n20 (below 0.25) must not bind");
    for (const e of incident) {
      assert.strictEqual(e.hebbian.weight, 0, "no seeded baseline");
      assert.strictEqual(e.provenance.origin, "save-time-neighbor");
      assert.ok(e.semantic.value >= SAVE_TIME_MIN_COS);
    }
  });

  await atest("fewer-than-K neighbors that clear the threshold still bind (no padding)", async () => {
    const vecs = { hub: [1, 0, 0], near: vecAtCos(0.80), mid: vecAtCos(0.40), far: vecAtCos(0.10) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("st-few.jsonl", embed);
    await core.save("near");
    await core.save("mid");
    await core.save("far");
    await core.save("hub");
    const hubId = store.current().find((m) => m.text === "hub").id;
    const incident = edges().incident(hubId);
    assert.strictEqual(incident.length, 2, "only near+mid clear 0.25; do not pad to K");
    const nbrIds = incident.map((e) => e.a === String(hubId) ? e.b : e.a);
    const texts = nbrIds.map((id) => store.get(id).text).sort();
    assert.deepStrictEqual(texts, ["mid", "near"]);
  });

  await atest("the ~0.25 threshold is a hard floor: 0.25 binds, 0.24 does not", async () => {
    const vecs = { hub: [1, 0, 0], on: vecAtCos(0.25), off: vecAtCos(0.24) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("st-floor.jsonl", embed);
    await core.save("on");
    await core.save("off");
    await core.save("hub");
    const hubId = store.current().find((m) => m.text === "hub").id;
    const onId = store.current().find((m) => m.text === "on").id;
    const offId = store.current().find((m) => m.text === "off").id;
    assert.ok(edges().get(hubId, onId), "cosine 0.25 is on the gate (>=)");
    assert.strictEqual(edges().get(hubId, offId), undefined, "cosine 0.24 must not persist");
    const e = edges().get(hubId, onId);
    assert.ok(Math.abs(e.semantic.value - coreCosine(vecs.hub, vecs.on)) < 1e-12,
      "cached semantic.value is the measured cosine");
  });

  await atest("src_versions follow canonical edge.a/edge.b, not save-argument order", async () => {
    // Give the two endpoints DIFFERENT versions so a swapped tag is detectable.
    // Save A, edit A (v2), save B (v1). B's save binds A↔B; makeEdge(B, A)
    // sorts to a=min(A,B). Tagging by argument order would put B's v1 on
    // src_versions.a whenever B was the save-side argument.
    let vec = [1, 0, 0];
    const embed = async (texts) => texts.map(() => vec.slice());
    const { store, core, edges } = saveTimeCore("st-canon.jsonl", embed);
    await core.save("alpha-endpoint");
    const idA = store.all()[0].id;
    vec = [0.8, 0.6, 0];
    await core.edit(idA, "alpha-endpoint-edited");
    assert.strictEqual(store.get(idA).embedding_version, 2);
    vec = [0.8, 0.6, 0];
    await core.save("beta-endpoint");
    const idB = store.current().find((m) => m.text === "beta-endpoint").id;
    const edge = edges().get(idA, idB);
    assert.ok(edge, "save-time edge exists");
    const recA = store.get(edge.a);
    const recB = store.get(edge.b);
    assert.deepStrictEqual(edge.semantic.src_versions, {
      a: recA.embedding_version,
      b: recB.embedding_version,
    }, "src_versions.a is canonical endpoint a's version, not the save-argument's");
    assert.strictEqual(semanticValid(edge, recA.embedding_version, recB.embedding_version), true);
    assert.notStrictEqual(recA.embedding_version, recB.embedding_version,
      "versions must differ or a swap would still pass");
  });

  await atest("edit() re-embed bumps embedding_version so the save-time edge reads stale (no invalidation event)", async () => {
    let vec = [1, 0, 0];
    const embed = async (texts) => texts.map(() => vec.slice());
    const { store, core, edges, edgesPath } = saveTimeCore("st-stale.jsonl", embed);
    await core.save("first");
    await core.save("second");
    const ids = store.current().map((m) => m.id);
    const edgeBefore = edges().get(ids[0], ids[1]);
    assert.ok(edgeBefore);
    const srcSnap = JSON.parse(JSON.stringify(edgeBefore.semantic.src_versions));
    const sidecarBefore = fs.readFileSync(edgesPath, "utf8");
    const vBefore = store.get(ids[0]).embedding_version;
    vec = [0, 1, 0];
    await core.edit(ids[0], "first-edited");
    assert.strictEqual(store.get(ids[0]).embedding_version, vBefore + 1);
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), sidecarBefore,
      "edit must not write the edge store (transition table)");
    const edgeAfter = edges().get(ids[0], ids[1]);
    assert.deepStrictEqual(edgeAfter.semantic.src_versions, srcSnap,
      "no invalidation event rewrote src_versions");
    const recA = store.get(edgeAfter.a);
    const recB = store.get(edgeAfter.b);
    assert.strictEqual(
      semanticValid(edgeAfter, recA.embedding_version, recB.embedding_version),
      false,
      "stale is structurally self-evident on the next read"
    );
  });

  await atest("a save with the embedder down binds nothing and does not throw", async () => {
    const ref = { live: true };
    const vecs = { live: [1, 0, 0], also: vecAtCos(0.80) };
    const embed = async (texts) => {
      if (!ref.live) throw new Error("embedder unreachable");
      return texts.map((t) => vecs[t] || [1, 0, 0]);
    };
    const { store, core, edges } = saveTimeCore("st-dead.jsonl", embed);
    await core.save("live");
    await core.save("also");
    const sizeBefore = edges().size;
    ref.live = false;
    let msg;
    await assert.doesNotReject(async () => { msg = await core.save("saved while down"); });
    const dead = store.current().find((m) => m.text === "saved while down");
    assert.ok(dead, "vectorless row still lands");
    assert.strictEqual(dead.embedding, null);
    assert.strictEqual(edges().size, sizeBefore, "no new edges against a null vector");
    assert.ok(/Saved/.test(msg));
  });

  await atest("first save ever with a dead embedder does not throw and writes no sidecar", async () => {
    const embed = async () => { throw new Error("embedder unreachable"); };
    const { store, core, edgesPath } = saveTimeCore("st-dead-first.jsonl", embed);
    let msg;
    await assert.doesNotReject(async () => { msg = await core.save("nothing to compare"); });
    assert.ok(/Saved/.test(msg));
    assert.strictEqual(store.all()[0].embedding, null);
    assert.strictEqual(fs.existsSync(edgesPath), false, "no vector → no bind → no sidecar write");
  });

  await atest("save-time bind throwing does not break save (I3)", async () => {
    const store = new JsonlStore(tmp("st-throw.jsonl"));
    const embed = async (texts) => texts.map(() => [1, 0, 0]);
    const core = createCore({
      store, embed,
      getEdgeStore: () => { throw new Error("edges boom"); },
    });
    const msg = await core.save("still saved");
    assert.ok(/Saved/.test(msg));
    assert.strictEqual(store.all().length, 1);
  });

  await atest("existing co-activation Hebbian weight is preserved when save-time fills semantic", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.70) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("st-keep-heb.jsonl", embed);
    await core.save("a");
    await core.save("b");
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    const existing = edges().get(idA, idB);
    assert.ok(existing, "save of b bound the pair");
    // Rewrite as a migrated co-activation edge: learned weight, empty semantic.
    existing.provenance.origin = "co-activation";
    existing.provenance.migrated_from = "assoc.json";
    setHebbian(existing, 0.42, T0);
    setSemantic(existing, null, { a: null, b: null });
    const hebSnap = JSON.parse(JSON.stringify(existing.hebbian));
    const recA = store.get(idA);
    const recB = store.get(idB);
    const result = bindSaveTimeNeighbors(recB, [recA], edges());
    assert.ok(result.wrote, "empty semantic was filled");
    const after = edges().get(idA, idB);
    assert.deepStrictEqual(after.hebbian, hebSnap, "hebbian bytes unmoved");
    assert.strictEqual(after.provenance.origin, "co-activation", "origin is how it came to exist, not rewritten");
    assert.strictEqual(after.provenance.migrated_from, "assoc.json");
    assert.ok(after.semantic.value > 0);
    assert.strictEqual(semanticValid(after, recA.embedding_version, recB.embedding_version), true);
  });

  await atest("Related: still comes from field.js at 0.70, not from persisted 0.25 edges", async () => {
    // Guard against accidentally wiring recall to the save-time table this
    // slice. A pair at cos 0.30 is persisted (0.25 net) but must NOT surface
    // in Related: (0.70 gate). A third orthogonal memory makes
    // mems.length > ranked.length so the field block even runs.
    const vecs = {
      "alpha lives here": [1, 0, 0],
      "barely related": vecAtCos(0.30),
      "totally other": [0, 0, 1],
      alpha: [1, 0, 0],
    };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 1, 0]);
    const { core, edges } = saveTimeCore("st-recall-guard.jsonl", embed, { fieldOn: true });
    await core.save("alpha lives here");
    await core.save("barely related");
    await core.save("totally other");
    assert.ok(edges().size >= 1, "the 0.30 pair was persisted at save");
    const out = await core.recall("alpha", 1);
    assert.ok(/alpha lives here/.test(out));
    assert.strictEqual(out.includes("barely related"), false,
      "cos 0.30 save-time edge must not leak into Related: (recall still uses field.js 0.70)");
  });

  await atest("save-time bind does not write the JSONL store (I5)", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edgesPath } = saveTimeCore("st-i5.jsonl", embed);
    await core.save("a");
    const jsonlAfterFirst = fs.readFileSync(store.file, "utf8");
    await core.save("b");
    const lines = fs.readFileSync(store.file, "utf8").trim().split("\n");
    assert.strictEqual(lines.length, 2, "JSONL gained the new row only");
    assert.ok(jsonlAfterFirst.trim() === lines[0], "first row is unmoved");
    assert.ok(fs.existsSync(edgesPath), "sidecar write is allowed (I5 protects JSONL, not sidecars)");
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.strictEqual(j.kind, SIDECAR_KIND);
  });

  // ------------------------------------------------ Phase 0.3 live path
  // Request ids threaded through createCore; I5 (JSONL unmoved on recall)
  // must stay held. No-id callers (this is also the eval shape) apply.
  section("Phase 0.3 live path (request-ID through core, I5)");

  await atest("same recall requestId applies once; a different id applies again", async () => {
    const { core, store, edges, edgesPath } = liveField("c-03-id.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const lemonId = store.current().find((m) => m.text === LEMON).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    await core.recall(DESSERT_Q, 1, { requestId: "rpc-1" });
    const w1 = edges().weight(lemonId, diabeticId);
    assert.ok(w1 > 0, "first request reinforced");
    await core.recall(DESSERT_Q, 1, { requestId: "rpc-1" });
    assert.strictEqual(edges().weight(lemonId, diabeticId), w1, "retry of rpc-1 is a no-op");
    await core.recall(DESSERT_Q, 1, { requestId: "rpc-2" });
    assert.ok(edges().weight(lemonId, diabeticId) > w1, "rpc-2 is a distinct request");
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.ok(j.processed_ids.indexOf("rpc-1") >= 0);
    assert.ok(j.processed_ids.indexOf("rpc-2") >= 0);
  });

  await atest("no-id recall applies every time (the eval/pipeline shape)", async () => {
    const { core, store, edges } = liveField("c-03-noid.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const lemonId = store.current().find((m) => m.text === LEMON).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    await core.recall(DESSERT_Q, 1);                  // no opts
    const w1 = edges().weight(lemonId, diabeticId);
    await core.recall(DESSERT_Q, 1, { requestId: null });
    const w2 = edges().weight(lemonId, diabeticId);
    assert.ok(w2 > w1, "null requestId is no-id → applies");
    assert.strictEqual(edges().processedIds.length, 0, "eval-shaped calls leave the LRU empty");
  });

  await atest("I5: recall with a requestId still writes nothing to the JSONL store", async () => {
    const { core, store, edgesPath } = liveField("c-03-i5.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const jsonlBytes = fs.readFileSync(store.file, "utf8");
    await core.recall(DESSERT_Q, 1, { requestId: "rpc-i5" });
    assert.strictEqual(fs.readFileSync(store.file, "utf8"), jsonlBytes,
      "recall must not rewrite the JSONL store (I5 / BUG-002)");
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.ok(j.processed_ids.indexOf("rpc-i5") >= 0, "dedup record landed in the SIDECAR");
    assert.ok(Object.keys(j.edges).length >= 1, "weight change landed in the same sidecar");
  });

  await atest("edit with a requestId still writes nothing to the edge store", async () => {
    const { core, store, edgesPath } = liveField("c-03-edit.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    await core.recall(DESSERT_Q, 1, { requestId: "rpc-pre" });
    const before = fs.readFileSync(edgesPath, "utf8");
    const id = store.current().find((m) => m.text === MEETING).id;
    await core.edit(id, MEETING, { requestId: "rpc-edit" });
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), before,
      "edit must not stamp a dedup record (transition table: no edge write)");
  });

  await atest("save-time bind: same requestId does not re-bind; a second id does", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80), c: vecAtCos(0.70) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("st-03-id.jsonl", embed);
    await core.save("a", { requestId: "save-1" });
    await core.save("b", { requestId: "save-2" });
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    const edge = edges().get(idA, idB);
    assert.ok(edge, "save-2 bound a↔b");
    const semSnap = JSON.parse(JSON.stringify(edge.semantic));
    // Retry of save-2: exact-restatement confirm skips bind anyway; force
    // the bind path by saving a NEW neighbor under the same id — bind must skip.
    await core.save("c", { requestId: "save-2" });
    assert.strictEqual(edges().get(idA, idB).semantic.value, semSnap.value,
      "duplicate save-2 did not mutate the existing edge");
    const idC = store.current().find((m) => m.text === "c").id;
    assert.strictEqual(edges().get(idB, idC) == null && edges().get(idA, idC) == null, true,
      "duplicate id skipped the whole bind (c has no save-time edges)");
    await core.save("c-again-different", { requestId: "save-3" });
    // "c-again-different" isn't in vecs → orthogonal vector; may or may not bind.
    // The point: a fresh id is accepted (not stuck after save-2 was claimed).
    assert.ok(edges().hasProcessed("save-2"));
    assert.ok(edges().hasProcessed("save-3"));
  });

  // ------------------------------------------------ Phase 0.4 live path
  // Prune is EXPLICIT (pruneSweep / MCP startup), never recall/save.
  // Reactivation is a consequence of save/edit touching an endpoint.
  section("Phase 0.4 live path (soft prune off the hot path, reactivation on save/edit)");

  await atest("recall does not prune: a weak unreinforced edge stays active", async () => {
    const { core, store, edges, edgesPath } = liveField("c-04-recall.edges.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const E = edges();
    const meetingId = store.current().find((m) => m.text === MEETING).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    E.put(makeEdge(meetingId, diabeticId, {
      origin: "save-time-neighbor", now: T0, hebbianWeight: 0,
      semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
    }));
    E.save();
    const before = fs.readFileSync(edgesPath, "utf8");
    await core.recall(DESSERT_Q, 1);
    assert.strictEqual(E.get(meetingId, diabeticId).pruned_at, null,
      "recall must not prune (maintenance is pruneSweep, not the hot path)");
    // Sidecar may have grown a co-recall edge; the weak row itself is unpruned.
    assert.ok(JSON.parse(fs.readFileSync(edgesPath, "utf8")).edges[edgeKey(meetingId, diabeticId)].pruned_at == null);
    void before;
  });

  await atest("a normal save does not prune existing edges", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80), c: [0, 0, 1] };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 1, 0]);
    const { store, core, edges } = saveTimeCore("c-04-save.jsonl", embed);
    await core.save("a");
    await core.save("b");
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    // Plant a prune-eligible edge that save() must not sweep.
    edges().put(makeEdge(idA, 999, {
      origin: "save-time-neighbor", now: T0, hebbianWeight: 0,
      semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
    }));
    await core.save("c");
    assert.strictEqual(edges().get(idA, 999).pruned_at, null,
      "save must not run pruneSweep");
    assert.strictEqual(edges().get(idA, idB).pruned_at, null);
  });

  await atest("edit of an endpoint reactivates its pruned incident edge; created_at and weight survive", async () => {
    const { core, store, edges, edgesPath } = liveField("c-04-edit.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const E = edges();
    const meetingId = store.current().find((m) => m.text === MEETING).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    const planted = E.put(makeEdge(meetingId, diabeticId, {
      origin: "co-activation", now: T0, hebbianWeight: 0.4,
      semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
    }));
    markPruned(planted, T0);
    E.save();
    assert.ok(E.get(meetingId, diabeticId).pruned_at);
    const sidecarBefore = fs.readFileSync(edgesPath, "utf8");
    await core.edit(meetingId, MEETING);
    const after = E.get(meetingId, diabeticId);
    assert.strictEqual(after.pruned_at, null, "edit touching the endpoint revived it");
    assert.strictEqual(after.created_at, T0);
    assert.strictEqual(after.prune_count, 1);
    assert.strictEqual(after.last_reactivated_at, T0, "frozen clock stamps now=T0");
    assert.strictEqual(after.hebbian.weight, 0.4, "weight not reset to full / zero");
    assert.notStrictEqual(fs.readFileSync(edgesPath, "utf8"), sidecarBefore,
      "reactivation is the one edge write edit is allowed");
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.ok(j.processed_ids.indexOf("rpc-edit") < 0, "edit still must not stamp a dedup id");
  });

  await atest("edit with no pruned incident edges still writes nothing to the sidecar", async () => {
    // Belt on the 0.3 test: reactivation is conditional. No pruned rows → I5-class no-write.
    const { core, store, edgesPath } = liveField("c-04-edit-noop.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    await core.recall(DESSERT_Q, 1);
    const before = fs.readFileSync(edgesPath, "utf8");
    const id = store.current().find((m) => m.text === MEETING).id;
    await core.edit(id, MEETING);
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), before);
  });

  await atest("confirming save (exact restatement) reactivates incident pruned edges", async () => {
    const { core, store, edges } = liveField("c-04-confirm.jsonl", true);
    await core.save(MEETING);
    const id = store.current().find((m) => m.text === MEETING).id;
    const planted = edges().put(makeEdge(id, 999, {
      origin: "save-time-neighbor", now: T0, hebbianWeight: 0,
      semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
    }));
    markPruned(planted, T0);
    const msg = await core.save(MEETING);
    assert.ok(/Already remembered/.test(msg));
    assert.strictEqual(edges().get(id, 999).pruned_at, null);
    assert.strictEqual(edges().get(id, 999).prune_count, 1);
    assert.strictEqual(edges().get(id, 999).last_reactivated_at, T0);
  });

  await atest("save-time bind reactivates a pruned existing edge rather than creating a duplicate", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges } = saveTimeCore("c-04-bind-re.jsonl", embed);
    await core.save("a");
    const recA = store.current().find((m) => m.text === "a");
    const recB = {
      id: 4242, text: "b", embedding: vecs.b, embedding_version: 1,
    };
    const planted = edges().put(makeEdge(recA.id, recB.id, {
      origin: "save-time-neighbor", now: T0, hebbianWeight: 0.22,
      semantic: { value: 0.80, src_versions: { a: 1, b: 1 } },
    }));
    markPruned(planted, T0);
    const created = planted.created_at;
    const result = bindSaveTimeNeighbors(recB, [recA], edges());
    assert.ok(result.wrote);
    const after = edges().get(recA.id, recB.id);
    assert.strictEqual(after.pruned_at, null);
    assert.strictEqual(after.created_at, created, "in-place revive, not a new row");
    assert.strictEqual(after.hebbian.weight, 0.22, "Hebbian carried");
    assert.strictEqual(after.prune_count, 1);
    assert.strictEqual(edges().size, 1, "no duplicate edge");
  });

  await atest("pruneSweep of a strong unreinforced bridge does not regress constraint rescue", async () => {
    const { core, store, edges } = liveField("c-04-rescue.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const lemonId = store.current().find((m) => m.text === LEMON).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    // The save-time lemon↔diabetic edge is semantically strong (cos 0.60) and
    // unreinforced (weight 0). A merged scalar would prune it.
    const bridge = edges().get(lemonId, diabeticId);
    assert.ok(bridge, "save-time bind created the rescue bridge");
    assert.strictEqual(bridge.hebbian.weight, 0);
    assert.ok(bridge.semantic.value >= 0.45);
    const n = edges().pruneSweep();
    assert.strictEqual(edges().get(lemonId, diabeticId).pruned_at, null,
      "two-signal rule: strong unreinforced bridge survives");
    void n;
    const out = await core.recall(DESSERT_Q, 1);
    assert.ok(/diabetic/.test(out), "constraint rescue still fires after the sweep");
  });

  // ------------------------------------------------ Phase 0.5 live-path contract
  // Remaining transition-table rows (save-creates columns, save-where-exists
  // Writes?, field-off recall Writes? no) and the crash-before-edge-write
  // stale-semantic case. Fake clock via EdgeStore.now = T0 throughout.
  section("Phase 0.5 live-path contract (transition table + failure signatures)");

  await atest("transition: save creates edge — all columns + sidecar write", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges, edgesPath } = saveTimeCore("p05-save-creates.jsonl", embed);
    await core.save("a");
    assert.strictEqual(fs.existsSync(edgesPath), false, "first save has no neighbor → no sidecar yet");
    await core.save("b");
    assert.ok(fs.existsSync(edgesPath), "Writes? yes — sidecar appears when an edge is created");
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    const e = edges().get(idA, idB);
    assert.ok(e, "save-time edge exists");
    assert.strictEqual(e.hebbian.weight, 0, "no seeded baseline");
    assert.strictEqual(e.hebbian.last_updated, e.created_at, "last_updated = created_at");
    assert.ok(e.created_at, "created_at set");
    assert.strictEqual(e.pruned_at, null);
    assert.strictEqual(e.provenance.origin, "save-time-neighbor");
    assert.ok(typeof e.semantic.value === "number" && e.semantic.value >= SAVE_TIME_MIN_COS);
    const recA = store.get(e.a);
    const recB = store.get(e.b);
    assert.deepStrictEqual(e.semantic.src_versions, {
      a: recA.embedding_version,
      b: recB.embedding_version,
    });
    const j = JSON.parse(fs.readFileSync(edgesPath, "utf8"));
    assert.strictEqual(j.kind, SIDECAR_KIND);
    assert.ok(j.edges[edgeKey(idA, idB)]);
  });

  await atest("transition: save where edge exists, versions fresh — no sidecar write, columns unmoved", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges, edgesPath } = saveTimeCore("p05-exists-fresh.jsonl", embed);
    await core.save("a");
    await core.save("b");
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    const recA = store.get(idA);
    const recB = store.get(idB);
    const snap = JSON.parse(JSON.stringify(edges().get(idA, idB)));
    const before = fs.readFileSync(edgesPath, "utf8");
    const mtime = fs.statSync(edgesPath).mtimeMs;
    const result = bindSaveTimeNeighbors(recB, [recA], edges());
    assert.strictEqual(result.wrote, false, "fresh src_versions → no recompute");
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), before, "Writes? only if semantic recomputed");
    assert.strictEqual(fs.statSync(edgesPath).mtimeMs, mtime);
    assert.deepStrictEqual(edges().get(idA, idB), snap,
      "semantic, hebbian, created_at, pruned_at all unmoved");
  });

  await atest("transition: save where edge exists, versions stale — recompute semantic, hebbian unmoved, write yes", async () => {
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80) };
    const embed = async (texts) => texts.map((t) => vecs[t] || [0, 0, 1]);
    const { store, core, edges, edgesPath } = saveTimeCore("p05-exists-stale.jsonl", embed);
    await core.save("a");
    await core.save("b");
    const idA = store.current().find((m) => m.text === "a").id;
    const idB = store.current().find((m) => m.text === "b").id;
    const recA = store.get(idA);
    const recB = store.get(idB);
    const edge = edges().get(idA, idB);
    const hebSnap = JSON.parse(JSON.stringify(edge.hebbian));
    const created = edge.created_at;
    const pruned = edge.pruned_at;
    const originSnap = JSON.parse(JSON.stringify(edge.provenance));
    // Simulate an edit() version bump with no edge write (transition table).
    recA.embedding_version = recA.embedding_version + 1;
    const before = fs.readFileSync(edgesPath, "utf8");
    const result = bindSaveTimeNeighbors(recB, [recA], edges());
    assert.strictEqual(result.wrote, true, "stale cache must be refreshed");
    assert.notStrictEqual(fs.readFileSync(edgesPath, "utf8"), before, "Writes? yes");
    const after = edges().get(idA, idB);
    assert.deepStrictEqual(after.hebbian, hebSnap, "hebbian.weight + last_updated unchanged");
    assert.strictEqual(after.created_at, created);
    assert.strictEqual(after.pruned_at, pruned);
    assert.deepStrictEqual(after.provenance, originSnap, "origin is how it came to exist");
    // store.get re-parses from disk; the bump lives on the in-memory recs we
    // passed into bind. Tag must follow canonical edge.a/edge.b, not save-arg order.
    const byId = { [String(idA)]: recA, [String(idB)]: recB };
    assert.strictEqual(
      semanticValid(after, byId[after.a].embedding_version, byId[after.b].embedding_version),
      true,
      "src_versions now match the recs bind saw"
    );
    assert.ok(typeof after.semantic.value === "number");
  });

  await atest("transition: field-off recall writes nothing to the edge store", async () => {
    // The transition-table `recall` row is Writes? no. Field-on recall still
    // co-issues reinforceRecall (sidecar write, not JSONL — I5); that is the
    // retained co-recall path, covered elsewhere. Field-off is the pure read.
    const vecs = { a: [1, 0, 0], b: vecAtCos(0.80), q: [1, 0, 0] };
    const embed = async (texts) => texts.map((t) => vecs[t] || vecs.q);
    const { core, edgesPath } = saveTimeCore("p05-recall-off.jsonl", embed, { fieldOn: false });
    await core.save("a");
    await core.save("b");
    assert.ok(fs.existsSync(edgesPath), "save-time bind already wrote the sidecar");
    const before = fs.readFileSync(edgesPath, "utf8");
    const mtime = fs.statSync(edgesPath).mtimeMs;
    await core.recall("q", 1);
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), before, "field-off recall Writes? no");
    assert.strictEqual(fs.statSync(edgesPath).mtimeMs, mtime);
  });

  await atest("failure: crash-before-edge-write — persist bumped version, reload sidecar, still stale", async () => {
    // Event-based invalidation's failure window: memory persists, invalidation
    // never runs (crash, or by design: edit writes no edge). Stale must be
    // structurally self-evident on a FRESH EdgeStore loaded from disk.
    let vec = [1, 0, 0];
    const embed = async (texts) => texts.map(() => vec.slice());
    const { store, core, edgesPath } = saveTimeCore("p05-crash-stale.jsonl", embed);
    await core.save("first");
    await core.save("second");
    const ids = store.current().map((m) => m.id);
    const sidecarBefore = fs.readFileSync(edgesPath, "utf8");
    const srcBefore = JSON.parse(sidecarBefore).edges[edgeKey(ids[0], ids[1])].semantic.src_versions;
    vec = [0, 1, 0];
    await core.edit(ids[0], "first-edited");
    assert.strictEqual(store.get(ids[0]).embedding_version, 2);
    assert.strictEqual(fs.readFileSync(edgesPath, "utf8"), sidecarBefore,
      "edit did not touch the sidecar (crash-before-edges is the design)");
    // New process: load the sidecar from disk, no in-memory invalidate().
    const reloaded = new EdgeStore(edgesPath, { now: () => T0 });
    const edge = reloaded.get(ids[0], ids[1]);
    assert.deepStrictEqual(edge.semantic.src_versions, srcBefore, "no invalidation event rewrote it");
    const recA = store.get(edge.a);
    const recB = store.get(edge.b);
    assert.strictEqual(semanticValid(edge, recA.embedding_version, recB.embedding_version), false,
      "stale is a version comparison against the persisted memory, not a flag");
  });

  await atest("transition: reactivate does not rewrite semantic — self-heal is version mismatch", async () => {
    const { core, store, edges, edgesPath } = liveField("p05-re-stale.jsonl", true);
    await core.save(DIABETIC);
    await core.save(LEMON);
    await core.save(MEETING);
    const E = edges();
    const meetingId = store.current().find((m) => m.text === MEETING).id;
    const diabeticId = store.current().find((m) => m.text === DIABETIC).id;
    const planted = E.put(makeEdge(meetingId, diabeticId, {
      origin: "co-activation", now: T0, hebbianWeight: 0.4,
      semantic: { value: 0.10, src_versions: { a: 1, b: 1 } },
    }));
    markPruned(planted, T0);
    E.save();
    const semSnap = JSON.parse(JSON.stringify(E.get(meetingId, diabeticId).semantic));
    const hebSnap = JSON.parse(JSON.stringify(E.get(meetingId, diabeticId).hebbian));
    const created = planted.created_at;
    await core.edit(meetingId, MEETING);   // re-embed → version 2; reactivation writes
    const after = E.get(meetingId, diabeticId);
    assert.strictEqual(after.pruned_at, null, "revived");
    assert.strictEqual(after.last_reactivated_at, T0);
    assert.strictEqual(after.created_at, created, "created_at preserved");
    assert.deepStrictEqual(after.hebbian, hebSnap, "weight + last_updated carried, not snapped");
    assert.deepStrictEqual(after.semantic, semSnap, "reactivate does not recompute semantic");
    const recA = store.get(after.a);
    const recB = store.get(after.b);
    assert.strictEqual(semanticValid(after, recA.embedding_version, recB.embedding_version), false,
      "self-heal is the version mismatch on next read, not an invalidation event");
    assert.ok(fs.existsSync(edgesPath), "Writes? yes (reactivation is the one edit write)");
  });

  // ---------------------------------------------- RM-11 CI smoke (live --mcp)
  section("RM-11 CI smoke (live --mcp + hang guard)");

  await atest("failure: a silent child is killed by the smoke timeout (must not hang CI)", async () => {
    const start = Date.now();
    let hungTimer = null;
    let err = null;
    try {
      await Promise.race([
        smokeExe.smoke(process.execPath, {
          args: ["-e", "setInterval(function(){}, 1000)"],
          timeoutMs: 400,
        }),
        new Promise((_, rej) => {
          hungTimer = setTimeout(() => rej(new Error("smoke() itself hung past 2s")), 2000);
        }),
      ]);
    } catch (e) { err = e; }
    if (hungTimer) clearTimeout(hungTimer);
    assert.ok(err, "a child that never speaks JSON-RPC must fail the smoke");
    assert.ok(/timeout/i.test(err.message), err.message);
    assert.ok(Date.now() - start < 2500, "hang-guard took " + (Date.now() - start) + "ms");
  });

  await atest("failure: missing binary fails closed", async () => {
    let err = null;
    try {
      await smokeExe.smoke(path.join(tmpRoot, "no-such-binary-" + Date.now()));
    } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/not found/i.test(err.message), err.message);
  });

  if (!sqliteAvailable()) {
    await atest("smoke against entry.js --mcp SKIPPED (node:sqlite not in this Node)", async () => {
      assert.ok(true);
    });
  } else {
    await atest("smoke: node entry.js --mcp returns serverInfo + exactly four verbs", async () => {
      const result = await smokeExe.smoke(process.execPath, {
        args: [path.join(__dirname, "entry.js"), "--mcp"],
        timeoutMs: 15000,
        expectedVersion: require("./package.json").version,
      });
      assert.strictEqual(result.serverInfo.name, "resonance-memory");
      assert.strictEqual(result.serverInfo.version, require("./package.json").version);
      const names = result.tools.map((t) => t.name).sort();
      assert.deepStrictEqual(names, smokeExe.EXPECTED_TOOLS.slice().sort());
    });
  }
}

// ------------------------------------------------------------------- report
asyncTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { }
  process.exit(failed ? 1 : 0);
});
