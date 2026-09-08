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
 * entity.js - server-assigned identity and polarity features (I4).
 *
 * Embeddings measure topic. They are blind to two logical distinctions that
 * a human sees in one glance:
 *
 *   1. Entity identity. "My brother Omar is a dentist in Portland" vs
 *      "My neighbor Omar is a dentist in Portland" sits at 0.88–0.95 on
 *      nomic, Qwen3-0.6B, and correctly-invoked jina (eval/substrate
 *      fire-together-embedder-fair-report.md, probes A2/A3). Only the
 *      relation token differs. No embedder in that set separates them.
 *      Name-masking drops the near-miss into unrelated territory AND
 *      unbinds true pairs that mostly share the name (t3_m2 ↔ t3_m3 at
 *      0.59). Entity ids are the right mechanism: sister-Naima chemist
 *      and "call my sister Naima on Sunday" share E1; coworker-Naima is E2.
 *
 *   2. Polarity. "incompatible with X" vs "synergistic with X" is the same
 *      class of blind spot — opposite predicate, near-identical vector.
 *      The extractor here is the same shape as (1): a closed-class
 *      logical feature, not a fitted theme ontology.
 *
 * Both are assigned from text by this module, never by the model (I4),
 * same posture as detectConstraint / detectSupersession. They feed the
 * FIELD only (Related: edge drop + Hebbian pairScale) — never primary
 * cosine rank (I2 / I3).
 *
 * Identity key is (canonical name, relation class). Occupation is a
 * feature, not a split key: "sister Naima the chemist" and "call my
 * sister Naima on Sunday" must stay ONE entity. That is the over-split
 * failure mode this file guards. Name-only or relation-only mentions
 * attach only when exactly one candidate exists; ambiguity is left
 * unresolved rather than guessed.
 *
 * Relation classes are a closed set (family / work / friend). Neighbor
 * lives in friend, so brother-Omar vs neighbor-Omar conflicts. Occupations
 * (engineer, chemist) are deliberately NOT in work — that was the 8.8×
 * fitted lexicon, not the shippable 1.78× closed class.
 */

const FAMILY = [
  "sister", "sisters", "brother", "brothers",
  "mother", "father", "mom", "dad", "wife", "husband",
  "son", "sons", "daughter", "daughters",
  "cousin", "cousins", "uncle", "aunt", "aunty",
  "sibling", "siblings", "parent", "parents",
  "child", "children",
  "grandmother", "grandfather", "grandma", "grandpa",
  "niece", "nephew",
  "stepson", "stepdaughter", "stepfather", "stepmother",
  "mother-in-law", "father-in-law", "sister-in-law", "brother-in-law",
];
const WORK = [
  "coworker", "coworkers", "co-worker", "co-workers",
  "colleague", "colleagues",
  "boss", "manager", "teammate", "teammates",
  "employee", "employees", "supervisor",
];
const FRIEND = [
  "friend", "friends", "roommate", "roommates",
  "neighbour", "neighbor", "neighbours", "neighbors",
  "buddy", "buddies", "pal", "pals",
];

const CLASS_OF = Object.create(null);
for (const w of FAMILY) CLASS_OF[w] = "family";
for (const w of WORK) CLASS_OF[w] = "work";
for (const w of FRIEND) CLASS_OF[w] = "friend";

const REL_ALT = Object.keys(CLASS_OF)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// Person-name token: "Naima", "Mary-Anne". Not "I", not "IKEA", not "Sunday".
const NAME_TOKEN = "[A-Z][a-z]+(?:-[A-Z][a-z]+)?";

const DAYS_MONTHS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
]);
const NOT_NAMES = new Set([
  "my", "the", "a", "an", "this", "that", "these", "those",
  "we", "our", "i", "me", "you", "your", "it", "its", "us", "they", "their",
  "every", "last", "someone", "anyone", "everybody",
  "on", "in", "at", "for", "to", "of", "and", "or", "but", "if",
  "when", "what", "who", "how", "which", "there", "here", "then", "so",
  "as", "by", "from", "with", "about", "into", "over", "after", "before",
]);

function isNameToken(w) {
  if (!w) return false;
  if (!/^[A-Z][a-z]+(?:-[A-Z][a-z]+)?$/.test(w)) return false;
  const low = w.toLowerCase();
  return !DAYS_MONTHS.has(low) && !NOT_NAMES.has(low);
}

function relClass(word) {
  return CLASS_OF[String(word || "").toLowerCase()] || null;
}

function mention(name, relation) {
  return {
    name: name ? String(name).toLowerCase() : null,
    relation: relation || null,
  };
}

/*
 * Pull (name, relation) pairs out of one string. Multiple patterns so
 * "My sister Naima …", "Naima is my sister", and "Naima, my sister"
 * resolve to the same mention. Relation-only and name-only mentions
 * are recorded too — resolution decides whether they attach.
 */
function extractMentions(text) {
  const s = String(text || "");
  const out = [];
  const seen = new Set();
  function add(name, relation) {
    const n = name && isNameToken(name) ? name : null;
    const r = relClass(relation);
    if (!n && !r) return;
    const key = (n ? n.toLowerCase() : "") + "\t" + (r || "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(mention(n, r));
  }

  const pairRes = [
    new RegExp("\\b(?:my|our)\\s+(" + REL_ALT + ")\\s+(" + NAME_TOKEN + ")\\b", "g"),
    new RegExp("\\b(" + NAME_TOKEN + ")\\s+is\\s+(?:my|our)\\s+(" + REL_ALT + ")\\b", "g"),
    new RegExp("\\b(" + NAME_TOKEN + "),?\\s+(?:my|our)\\s+(" + REL_ALT + ")\\b", "g"),
    new RegExp("\\b(" + REL_ALT + ")\\s+(" + NAME_TOKEN + ")\\b", "g"),
  ];
  // Groups: some patterns are (rel, name), some (name, rel).
  const order = ["rel-name", "name-rel", "name-rel", "rel-name"];
  for (let i = 0; i < pairRes.length; i++) {
    const re = pairRes[i];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      if (order[i] === "rel-name") add(m[2], m[1]);
      else add(m[1], m[2]);
    }
  }
  return out;
}

/*
 * Polarity objects. Closed-class predicates, same shape as relation
 * classes — not a theme ontology. "take the bus" is NOT a hit; we only
 * fire on allergy / incompatibility / synergy, the predicates geometry
 * flattens. Objects are lowercased content tokens (no stopwords).
 */
const STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "with", "for", "my", "our",
  "daily", "severe", "reaction", "allergy", "allergic", "anaphylactic",
  "antibiotics", "antibiotic", "supplements", "supplement",
]);

function objectsOf(span) {
  const raw = String(span || "").toLowerCase();
  const toks = raw.match(/[a-z][a-z0-9-]+/g) || [];
  const out = [];
  for (const t of toks) {
    if (STOP.has(t) || CLASS_OF[t]) continue;
    if (t.length < 3) continue;
    out.push(t);
  }
  return out.slice(0, 6);
}

const NEG_RES = [
  /allerg(?:ic|y)\s+(?:reaction\s+)?(?:to|on)\s+([^.,;]+)/ig,
  /anaphylactic(?:\s+allergy)?\s+(?:to\s+)?([^.,;]+)/ig,
  /incompatible\s+with\s+([^.,;]+)/ig,
  /contraindicated\s+(?:with|for)\s+([^.,;]+)/ig,
  /(?:can'?t|cannot|never)\s+(?:take|eat|have|drink|use)\s+([^.,;]+)/ig,
];
const POS_RES = [
  /synergistic\s+with\s+([^.,;]+)/ig,
  /compatible\s+with\s+([^.,;]+)/ig,
];

function extractPolarities(text) {
  const s = String(text || "");
  const out = [];
  function harvest(res, sign) {
    res.lastIndex = 0;
    let m;
    while ((m = res.exec(s))) {
      for (const obj of objectsOf(m[1])) out.push({ object: obj, sign });
    }
  }
  for (const re of NEG_RES) harvest(re, -1);
  for (const re of POS_RES) harvest(re, 1);
  return out;
}

function extractFeatures(text) {
  return {
    mentions: extractMentions(text),
    polarities: extractPolarities(text),
  };
}

function namesOf(features) {
  const s = new Set();
  for (const m of (features && features.mentions) || []) {
    if (m.name) s.add(m.name);
  }
  return s;
}

function relationsOf(features) {
  const s = new Set();
  for (const m of (features && features.mentions) || []) {
    if (m.relation) s.add(m.relation);
  }
  return s;
}

/*
 * Store-wide resolution. Pass A assigns ids from firm (name, relation)
 * mentions so record order cannot split a person. Pass B attaches each
 * record. Name-only / relation-only attach only when the candidate is
 * unique — the over-split guard is "don't guess".
 *
 * Returns Map<string id, { entity_ids: string[], features }>.
 */
function resolveEntities(records) {
  const rows = (records || []).map((r) => ({
    id: String(r.id),
    features: extractFeatures(r.text),
  }));

  const entities = []; // { id, name, relation }
  function nextId() { return "e" + (entities.length + 1); }

  function findByName(name) {
    return entities.filter((e) => e.name === name);
  }

  function firmAssign(name, relation) {
    if (!name) return null;
    const hits = findByName(name);
    const same = hits.find((e) => e.relation === relation);
    if (same) return same.id;
    if (relation) {
      const bare = hits.find((e) => !e.relation);
      if (bare && hits.length === 1) {
        bare.relation = relation;
        return bare.id;
      }
      const other = hits.find((e) => e.relation && e.relation !== relation);
      if (other) {
        const created = { id: nextId(), name, relation };
        entities.push(created);
        return created.id;
      }
    }
    if (hits.length === 1 && (!relation || !hits[0].relation || hits[0].relation === relation)) {
      if (relation && !hits[0].relation) hits[0].relation = relation;
      return hits[0].id;
    }
    if (hits.length === 0) {
      const created = { id: nextId(), name, relation: relation || null };
      entities.push(created);
      return created.id;
    }
    // Multiple same-name entities, this mention has no relation, or
    // conflicting relations already exist and this one is also conflicted
    // (handled above). Last resort: if relation matches none, create.
    if (relation) {
      const created = { id: nextId(), name, relation };
      entities.push(created);
      return created.id;
    }
    return null;
  }

  // Pass A: firm mentions first, across the whole store.
  for (const row of rows) {
    for (const m of row.features.mentions) {
      if (m.name && m.relation) firmAssign(m.name, m.relation);
    }
  }

  const out = new Map();
  for (const row of rows) {
    const ids = new Set();
    for (const m of row.features.mentions) {
      if (m.name && m.relation) {
        const id = firmAssign(m.name, m.relation);
        if (id) ids.add(id);
        continue;
      }
      if (m.name && !m.relation) {
        const hits = findByName(m.name);
        if (hits.length === 1) ids.add(hits[0].id);
        else if (hits.length === 0) {
          const id = firmAssign(m.name, null);
          if (id) ids.add(id);
        }
        // hits.length > 1: ambiguous, do not attach (over-split guard)
        continue;
      }
      if (!m.name && m.relation) {
        const hits = entities.filter((e) => e.relation === m.relation);
        if (hits.length === 1) ids.add(hits[0].id);
      }
    }
    out.set(row.id, { entity_ids: [...ids], features: row.features });
  }
  out.entities = entities.slice();
  return out;
}

function polarityClash(fa, fb) {
  const a = (fa && fa.polarities) || [];
  const b = (fb && fb.polarities) || [];
  if (!a.length || !b.length) return false;
  for (const x of a) {
    for (const y of b) {
      if (x.object === y.object && x.sign && y.sign && x.sign !== y.sign) return true;
    }
  }
  return false;
}

function shareName(fa, fb) {
  const a = namesOf(fa);
  const b = namesOf(fb);
  for (const n of a) if (b.has(n)) return true;
  return false;
}

function disjointNonEmpty(a, b) {
  if (!a.length || !b.length) return false;
  const sb = new Set(b);
  for (const x of a) if (sb.has(x)) return false;
  return true;
}

function relationClashOnSharedName(fa, fb) {
  if (!shareName(fa, fb)) return false;
  const ra = relationsOf(fa);
  const rb = relationsOf(fb);
  if (!ra.size || !rb.size) return false;
  for (const x of ra) if (rb.has(x)) return false;
  return true;
}

/*
 * True when two records should NOT form a Related: edge and should NOT
 * Hebbian-reinforce. Does not speak to primary cosine rank.
 *
 *   entity mismatch  — same surface name, disjoint entity ids
 *   relation clash   — same surface name, conflicting closed-class
 *                      relations, even if ids have not been assigned yet
 *   polarity clash   — same object, opposite logical sign
 */
function logicalConflict(slotA, slotB) {
  if (!slotA || !slotB) return false;
  if (polarityClash(slotA.features, slotB.features)) return true;
  if (shareName(slotA.features, slotB.features) &&
      disjointNonEmpty(slotA.entity_ids || [], slotB.entity_ids || [])) {
    return true;
  }
  if (relationClashOnSharedName(slotA.features, slotB.features)) return true;
  return false;
}

/*
 * Query vs record, for the Related: list only. A name-only query
 * ("tell me about Naima") is ambiguous when two Naimas exist — we do
 * not drop. A relation-anchored query ("my sister Naima") drops the
 * coworker. Never used on primary cosine hits (I2).
 */
function queryConflictsWith(querySlot, recordSlot) {
  if (!querySlot || !recordSlot) return false;
  return logicalConflict(querySlot, recordSlot);
}

function pairConflictFn(resolved) {
  return function conflict(a, b) {
    if (!resolved) return false;
    return logicalConflict(resolved.get(String(a.id)), resolved.get(String(b.id)));
  };
}

module.exports = {
  extractFeatures,
  extractMentions,
  extractPolarities,
  resolveEntities,
  logicalConflict,
  queryConflictsWith,
  pairConflictFn,
  namesOf,
  relationsOf,
  CLASS_OF,
  FAMILY,
  WORK,
  FRIEND,
};
