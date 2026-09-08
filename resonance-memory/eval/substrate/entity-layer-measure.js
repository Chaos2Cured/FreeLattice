#!/usr/bin/env node
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
 * Measure the entity-id layer on fire-together same-name confounds and the
 * extra probes from the fair embedder run. Lexical resolution is the claim;
 * nomic plain vectors (if the fair-run cache is present) show whether the
 * field filter actually drops the 0.88 Omar-class edges at minSim 0.70.
 *
 *   node eval/substrate/entity-layer-measure.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const entity = require("../../entity.js");
const field = require("../../field.js");

const ROOT = path.join(__dirname, "..", "..");
// Text-only fixture (25 records + pair lists). Studio's 9 MB Gemini-vector
// dump is not on canonical; lexical resolve does not read embeddings.
const CORPUS = path.join(ROOT, "eval", "corpora", "fire-together-corpus.json");
const CACHE = path.join(__dirname, ".cache-embedder-fair", "nomic__plain__records.npy");
const OUT_JSON = path.join(__dirname, "entity-layer-results.json");
const OUT_MD = path.join(__dirname, "entity-layer-results.md");

const PROBES = [
  { id: "A1", cls: "shared-name-conflict-relation", expect: "split",
    a: "My sister Naima teaches chemistry at the local high school",
    b: "My coworker Naima is a frontend engineer on the infrastructure team" },
  { id: "A2", cls: "shared-name-conflict-relation", expect: "split",
    a: "My brother Omar is a dentist in Portland",
    b: "My neighbor Omar is a dentist in Portland" },
  { id: "A3", cls: "shared-name-conflict-relation", expect: "split",
    a: "My wife Priya is a painter who shows at the downtown gallery",
    b: "My colleague Priya is a painter who shows at the downtown gallery" },
  { id: "A4", cls: "shared-name-conflict-relation", expect: "split",
    a: "I call my sister Naima every Sunday evening to catch up",
    b: "I call my coworker Naima every Sunday evening to catch up" },
  { id: "Ap1", cls: "shared-name-same-relation", expect: "merge",
    a: "My sister Naima teaches chemistry at the local high school",
    b: "Naima is my sister and she works as a high school chemistry teacher" },
  { id: "Ap2", cls: "shared-name-same-relation", expect: "merge",
    a: "My brother Omar is a dentist in Portland",
    b: "Omar, my brother, runs a dental practice in Portland" },
  { id: "B1", cls: "same-relation-different-name", expect: "different-ids-no-name-conflict",
    a: "My sister Naima teaches chemistry at the local high school",
    b: "My sister Layla teaches chemistry at the local high school" },
  { id: "F1", cls: "structure-only-no-name", expect: "no-entity-conflict",
    a: "My sister teaches chemistry at the local high school",
    b: "My coworker is a frontend engineer on the infrastructure team" },
  { id: "F2", cls: "structure-only-same-person", expect: "no-entity-conflict",
    a: "My sister teaches chemistry at the local high school",
    b: "My sister works as a high school chemistry teacher" },
  { id: "P1", cls: "polarity", expect: "split",
    a: "Ibuprofen is incompatible with this blood thinner",
    b: "Ibuprofen is synergistic with this blood thinner" },
  { id: "P2", cls: "polarity-different-object", expect: "no-entity-conflict",
    a: "I have a severe allergic reaction to penicillin and amoxicillin",
    b: "I take daily vitamin D and zinc supplements with breakfast" },
];

function loadNpy(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] !== 0x93 || buf.slice(1, 6).toString("latin1") !== "NUMPY") {
    throw new Error("not npy: " + file);
  }
  const major = buf[6];
  const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerOff = major === 1 ? 10 : 12;
  const header = buf.slice(headerOff, headerOff + headerLen).toString("latin1");
  const descr = /'descr':\s*'([^']+)'/.exec(header);
  const shapeM = /'shape':\s*\(([^)]*)\)/.exec(header);
  const shape = shapeM[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  const data = buf.slice(headerOff + headerLen);
  const little = !descr || descr[1][0] !== ">";
  const code = descr ? descr[1].replace(/^[<>|=]/, "") : "f4";
  const n = shape.reduce((a, b) => a * b, 1);
  const out = new Float64Array(n);
  if (code === "f8") {
    for (let i = 0; i < n; i++) out[i] = little ? data.readDoubleLE(i * 8) : data.readDoubleBE(i * 8);
  } else if (code === "f4") {
    for (let i = 0; i < n; i++) out[i] = little ? data.readFloatLE(i * 4) : data.readFloatBE(i * 4);
  } else {
    throw new Error("unsupported npy descr " + (descr && descr[1]));
  }
  return { shape, data: out };
}

function row(mat, i) {
  const cols = mat.shape[1];
  return mat.data.subarray(i * cols, (i + 1) * cols);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function shareId(a, b) {
  const sb = new Set(b || []);
  return (a || []).some((x) => sb.has(x));
}

function main() {
  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const records = corpus.records.map((r) => ({
    id: r.id, text: r.text, theme_id: r.theme_id, role: r.role,
  }));
  const resolved = entity.resolveEntities(records);

  const assignments = {};
  for (const r of records) {
    const slot = resolved.get(r.id);
    assignments[r.id] = {
      role: r.role,
      theme_id: r.theme_id,
      entity_ids: slot.entity_ids,
      mentions: slot.features.mentions,
      polarities: slot.features.polarities,
    };
  }

  function pairReport(pairs, kind) {
    return pairs.map((p) => {
      const A = resolved.get(p.a), B = resolved.get(p.b);
      return {
        a: p.a, b: p.b, kind,
        share_entity: shareId(A.entity_ids, B.entity_ids),
        conflict: entity.logicalConflict(A, B),
        ids_a: A.entity_ids, ids_b: B.entity_ids,
      };
    });
  }

  const trueRep = pairReport(corpus.true_pairs, "true");
  const nmRep = pairReport(corpus.near_miss_pairs, "near-miss");
  const trueMerged = trueRep.filter((x) => x.share_entity).length;
  const trueSplit = trueRep.filter((x) => !x.share_entity && (x.ids_a.length || x.ids_b.length)).length;
  const nmConflict = nmRep.filter((x) => x.conflict).length;
  const nmSister = nmRep.filter((x) => String(x.a).startsWith("t3") || String(x.b).startsWith("t3"));

  const probeRows = PROBES.map((p) => {
    const recs = [{ id: "a", text: p.a }, { id: "b", text: p.b }];
    const r = entity.resolveEntities(recs);
    const conflict = entity.logicalConflict(r.get("a"), r.get("b"));
    const share = shareId(r.get("a").entity_ids, r.get("b").entity_ids);
    let ok;
    if (p.expect === "split") ok = conflict && !share;
    else if (p.expect === "merge") ok = share && !conflict;
    else if (p.expect === "different-ids-no-name-conflict") ok = !share && !conflict;
    else ok = !conflict;
    return {
      id: p.id, cls: p.cls, expect: p.expect, ok,
      conflict, share,
      ids_a: r.get("a").entity_ids, ids_b: r.get("b").entity_ids,
      mentions_a: r.get("a").features.mentions, mentions_b: r.get("b").features.mentions,
    };
  });

  let fieldKn = null;
  if (fs.existsSync(CACHE)) {
    let mat;
    try { mat = loadNpy(CACHE); } catch (e) {
      fieldKn = { error: String(e.message || e) };
      mat = null;
    }
    if (mat) {
    const recs = records.map((r, i) => ({
      id: r.id, text: r.text, embedding: Array.from(row(mat, i)),
    }));
    const raw = field.buildEdges(recs, { k: 3, minSim: 0.70, mutual: true });
    const filtered = field.buildEdges(recs, {
      k: 3, minSim: 0.70, mutual: true,
      conflict: entity.pairConflictFn(resolved),
    });
    function edgeSet(m) {
      const s = new Set();
      for (const [a, list] of m) {
        for (const e of list) s.add([String(a), String(e.id)].sort().join("\t"));
      }
      return s;
    }
    const rawS = edgeSet(raw), filS = edgeSet(filtered);
    const nmIds = new Set();
    for (const p of corpus.near_miss_pairs) {
      nmIds.add([p.a, p.b].sort().join("\t"));
    }
    const trueIds = new Set();
    for (const p of corpus.true_pairs) trueIds.add([p.a, p.b].sort().join("\t"));
    const count = (set, keys) => [...keys].filter((k) => set.has(k)).length;
    fieldKn = {
      cache: CACHE,
      raw_edges: rawS.size,
      filtered_edges: filS.size,
      true_raw: count(rawS, trueIds),
      true_filtered: count(filS, trueIds),
      nm_raw: count(rawS, nmIds),
      nm_filtered: count(filS, nmIds),
      true_pairs: corpus.true_pairs.length,
      nm_pairs: corpus.near_miss_pairs.length,
    };
    }
  }

  const out = {
    generated: new Date().toISOString(),
    assignments,
    true_pairs: trueRep,
    near_miss_pairs: nmRep,
    summary: {
      true_pairs: trueRep.length,
      true_share_entity: trueMerged,
      true_named_but_split: trueSplit,
      nm_pairs: nmRep.length,
      nm_conflict: nmConflict,
      sister_nm: nmSister,
      probes_ok: probeRows.filter((p) => p.ok).length,
      probes_n: probeRows.length,
    },
    probes: probeRows,
    field_knn_nomic_plain_0_70: fieldKn,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

  const lines = [];
  lines.push("# Entity-id layer — measured");
  lines.push("");
  lines.push("**Date:** " + out.generated.slice(0, 10));
  lines.push("**Mechanism:** `entity.js` — closed-class relation (family/work/friend) + proper-name mentions, store-wide resolve. Polarity is the same shape (incompatible/synergistic, allergy-to). Feeds Related: `conflict` + Hebbian `pairScale`. Never primary cosine (I2/I3). Server-assigned (I4).");
  lines.push("");
  lines.push("## Fire-together");
  lines.push("");
  lines.push("| kind | n | share entity | conflict |");
  lines.push("|---|---:|---:|---:|");
  lines.push("| true pairs | " + trueRep.length + " | " + trueMerged + " | " + trueRep.filter((x) => x.conflict).length + " |");
  lines.push("| near-miss pairs | " + nmRep.length + " | " + nmRep.filter((x) => x.share_entity).length + " | " + nmConflict + " |");
  lines.push("");
  lines.push("Sister-Naima true members (t3_m1/m2/m3) must share one id; t3_nm must conflict.");
  const t3 = ["t3_m1", "t3_m2", "t3_m3"].map((id) => assignments[id].entity_ids.join(","));
  lines.push("- t3_m1/m2/m3 ids: `" + t3.join("` / `") + "`");
  lines.push("- t3_nm ids: `" + assignments.t3_nm.entity_ids.join(",") + "` conflict vs t3_m1: " + entity.logicalConflict(resolved.get("t3_m1"), resolved.get("t3_nm")));
  lines.push("");
  lines.push("## Probes");
  lines.push("");
  lines.push("| id | class | expect | ok | conflict | share |");
  lines.push("|---|---|---|---|---|---|");
  for (const p of probeRows) {
    lines.push("| " + p.id + " | " + p.cls + " | " + p.expect + " | " + (p.ok ? "yes" : "NO") + " | " + p.conflict + " | " + p.share + " |");
  }
  lines.push("");
  lines.push("Over-split guard is Ap1/Ap2 + t3_m1↔t3_m3: same person, two phrasings, one entity.");
  lines.push("B1 (Naima vs Layla) gets different ids but **no** name-conflict flag — the field filter is name-keyed; same-role different-name is still a geometric near-paraphrase (fair-run 0.88). Named as a ceiling, not a miss.");
  lines.push("");
  if (fieldKn && fieldKn.true_pairs != null) {
    lines.push("## Field kNN at minSim 0.70 (nomic plain cache)");
    lines.push("");
    lines.push("| | true-pair edges | near-miss edges |");
    lines.push("|---|---:|---:|");
    lines.push("| geometry only | " + fieldKn.true_raw + " / " + fieldKn.true_pairs + " | " + fieldKn.nm_raw + " / " + fieldKn.nm_pairs + " |");
    lines.push("| + entity filter | " + fieldKn.true_filtered + " / " + fieldKn.true_pairs + " | " + fieldKn.nm_filtered + " / " + fieldKn.nm_pairs + " |");
    lines.push("");
  } else {
    lines.push("Nomic fair-run cache not used for field kNN" + (fieldKn && fieldKn.error ? " (" + fieldKn.error + ")" : "") + ".");
    lines.push("");
  }
  lines.push("## Polarity ceiling");
  lines.push("");
  lines.push("The same logical-feature approach catches incompatible vs synergistic on a shared object (P1). It does **not** invent a topic ontology: penicillin-allergy vs vitamin-D (P2 / fire-together allergy near-miss) is a different object, left to geometry (already well separated, nm mean 0.45). A general 'opposite meaning, near-identical vector' solver for arbitrary predicates would need a closed-class of predicates (this file) or an NLI/cross-encoder on the recall path — not a bigger embedder.");
  lines.push("");
  fs.writeFileSync(OUT_MD, lines.join("\n"));
  console.log(JSON.stringify(out.summary, null, 2));
  if (fieldKn) console.log("field_knn", fieldKn);
  console.log("probes", probeRows.map((p) => p.id + "=" + (p.ok ? "ok" : "FAIL")).join(" "));
  console.log("wrote", OUT_MD);
}

main();
