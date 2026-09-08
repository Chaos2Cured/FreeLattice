/*
 * Resonance Memory - A/B value rig (Grok's independent copy)
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * check.js - offline invariants for this rig. No LLM, no embedder, no network.
 *
 * Failure signatures this file exists to catch:
 *   - independence leak: Dana / Ember-facts accidentally reused
 *   - grader leak: an accept token already sits in the probe question
 *     (except the in-session control, which is supposed to be answerable
 *     from the current turn)
 *   - recency-window lie: a "buried" plant still fits in a 700-token
 *     newest-first pack, or a "recent" plant does not
 *   - substrate miss: constraint plants don't match CONSTRAINT_RE, updates
 *     don't carry a supersede cue, the historical probe doesn't match
 *     HISTORICAL_RE (so RM-03 / isHistoricalQuery never fire)
 *   - reject-dominates-accept: a confused answer that also contains the
 *     right word must still FAIL
 *
 * Run: node eval/ab-grok/check.js
 * Also loaded from test.js so a leak cannot ship on the unit gate.
 */

const assert = require("assert");
const scenario = require("./scenario.js");
const { gradeProbe, stats } = require("./grade.js");
const { estTokens } = require("./lib/llm.js");
const { detectConstraint, hasSupersedeCue, isHistoricalQuery } = require("../../record.js");

const EMBER_DENY = [
  "dana", "biscuit", "cedar & vale", "cedar and vale", "shellfish",
  "pediatric nurse", "drowned city", "landscape architect", "pescatarian",
];

function recencyPack(turns, budget) {
  const lines = [];
  let toks = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const line = "- " + turns[i];
    const t = estTokens(line);
    if (toks + t > budget) break;
    lines.unshift(line);
    toks += t;
  }
  return { text: lines.join("\n").toLowerCase(), tokens: toks, n: lines.length };
}

function runChecks(test, assertFn) {
  const A = assertFn;

  test("independence: user is not Dana and Ember-facts are absent", () => {
    A.strictEqual(scenario.meta.user, "Jules Marin");
    const blob = JSON.stringify(scenario.sessions).toLowerCase();
    A.ok(!blob.includes("dana"), "Dana leaked into Grok's scenario");
    for (const w of EMBER_DENY) {
      A.ok(!blob.includes(w), "Ember-fact leaked: " + w);
    }
  });

  test("scenario has buried plants, late plants, and enough filler", () => {
    A.ok(scenario.FILLER_BURIED >= 60, "buried filler too thin");
    A.ok(scenario.FILLER_TAIL >= 30, "tail filler too thin to fill a 700-tok window");
    const probes = scenario.allProbes();
    A.ok(probes.length >= 10, "need a real probe set, got " + probes.length);
    const kinds = new Set(probes.map((p) => p.probe.kind));
    for (const k of ["recall", "update", "update-historical", "discrim", "constraint", "control", "recent"]) {
      A.ok(kinds.has(k), "missing probe kind " + k);
    }
  });

  test("grader leak: accept tokens must not sit in the question (except control)", () => {
    const leaks = [];
    for (const p of scenario.allProbes()) {
      if (p.probe.kind === "control") continue;
      const q = p.u.toLowerCase();
      for (const tok of p.probe.gold.accept || []) {
        if (q.includes(String(tok).toLowerCase())) {
          leaks.push(p.probe.id + " accept:'" + tok + "'");
        }
      }
    }
    A.deepStrictEqual(leaks, [], "accept token already in the probe question: " + leaks.join("; "));
  });

  test("grader leak: reject tokens must not sit in the question (echo would hard-fail everyone)", () => {
    const leaks = [];
    for (const p of scenario.allProbes()) {
      const q = p.u.toLowerCase();
      for (const tok of p.probe.gold.reject || []) {
        if (q.includes(String(tok).toLowerCase())) {
          leaks.push(p.probe.id + " reject:'" + tok + "'");
        }
      }
    }
    A.deepStrictEqual(leaks, [], "reject token already in the probe question: " + leaks.join("; "));
  });

  test("recency window: buried plants OUT, late plants IN, at budget 700", () => {
    const packed = recencyPack(scenario.userTurnsBeforeFirstProbe(), 700);
    A.ok(packed.tokens > 0, "empty pack");
    A.ok(packed.tokens <= 700, "pack exceeded budget");
    const missingRecent = scenario.RECENT_MARKERS.filter((m) => !packed.text.includes(m));
    A.deepStrictEqual(missingRecent, [], "late plant dropped out of the recency window: " + missingRecent.join(", "));
    const leakedBuried = scenario.BURIED_MARKERS.filter((m) => packed.text.includes(m));
    A.deepStrictEqual(leakedBuried, [], "buried plant still inside the recency window (control is dishonest): " + leakedBuried.join(", "));
  });

  test("constraint plants actually match CONSTRAINT_RE", () => {
    const blob = scenario.sessions.map((s) => s.turns.map((t) => t.u).join("\n")).join("\n");
    A.ok(/allergic to mango/i.test(blob));
    A.ok(detectConstraint("I'm allergic to mango. Throat swelling, not a preference."));
    A.ok(detectConstraint("I can't have ibuprofen or any NSAID. It interacts with the lithium I take."));
    A.ok(detectConstraint("I never do cruise ships. I'm terrified of that combination."));
    A.ok(detectConstraint("I'm vegan. No eggs, no dairy, no meat."));
  });

  test("updates carry a supersede cue; historical probe matches HISTORICAL_RE", () => {
    A.ok(hasSupersedeCue("Update: I left Plover & Keel. I'm on a contract with the State Historical Society now."));
    A.ok(hasSupersedeCue("Diet update: I'm not vegan anymore. I eat eggs and dairy again as of this month."));
    const hist = scenario.allProbes().find((p) => p.probe.kind === "update-historical");
    A.ok(hist, "missing historical probe");
    A.ok(isHistoricalQuery(hist.u), "historical probe will not surface superseded rows: " + hist.u);
  });

  test("reject dominates accept (confused fact is a hard fail)", () => {
    const gold = { accept: ["ferry"], reject: ["tax"] };
    A.strictEqual(gradeProbe("she is a ferry captain", gold).pass, true);
    A.strictEqual(gradeProbe("she does tax prep at the ferry dock", gold).pass, false, "reject must dominate");
    A.strictEqual(gradeProbe("I don't know", gold).pass, false);
    A.strictEqual(gradeProbe("", gold).pass, false);
    A.strictEqual(gradeProbe("FERRY CAPTAIN in JUNEAU", { accept: ["ferry"], reject: [] }).pass, true, "case-insensitive");
  });

  test("stats: mean and sample sd", () => {
    const s = stats([0, 1, 0.5]);
    A.ok(Math.abs(s.mean - 0.5) < 1e-9);
    A.ok(s.n === 3);
    A.ok(s.sd > 0);
    A.deepStrictEqual(stats([]), { mean: 0, sd: 0, n: 0 });
    A.strictEqual(stats([0.9]).sd, 0);
  });
}

if (require.main === module) {
  let passed = 0, failed = 0;
  function test(name, fn) {
    try { fn(); console.log("  ok   " + name); passed++; }
    catch (e) { console.log("  FAIL " + name + "\n       " + e.message); failed++; }
  }
  console.log("A/B grok-rig offline checks");
  runChecks(test, assert);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

module.exports = { runChecks, recencyPack };
