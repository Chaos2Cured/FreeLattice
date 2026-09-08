/*
 * Resonance Memory - A/B value rig (Grok's independent copy)
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * run.js - orchestrates the three arms x N runs over one scripted scenario
 * and one driver model, then scores and writes results.
 *
 *   node eval/ab-grok/run.js --model openai/gpt-oss-20b --arms cold,recency,rm --runs 5 --budget 700
 *   node eval/ab-grok/run.js --selftest            # stub driver: proves plumbing, no chat LLM
 *
 * Within a session the model sees normal conversation. Across sessions context
 * RESETS - only the arm's memory bridges. Probes measure cross-session recall.
 *
 * Pre-declared verdict bands (two-sided; advisory - the numbers are the artifact).
 * Declared in scenario.js meta.bands BEFORE any live driver run; do not edit
 * them after seeing numbers.
 *   PASS         rm >= cold + 0.15  AND  rm >= recency  AND  rm >= recency on
 *                {update, update-historical, discrim}
 *   FAIL-DEAD    rm <= cold + 0.05
 *   FAIL-NOISE   rm <  recency - 0.05
 *   SCENARIO-WEAK annotation if recency scores < 0.5 on the `recent` subset
 *                (late plants not actually in the window; the control is broken)
 */

const fs = require("fs");
const path = require("path");
const { chat, makeEmbed, listLoaded } = require("./lib/llm.js");
const { makeArm } = require("./arms.js");
const { gradeProbe, stats } = require("./grade.js");
const scenario = require("./scenario.js");

function parseArgs(argv) {
  const a = { model: "loaded-model", arms: ["cold", "recency", "rm"], runs: 5, budget: 700,
    field: true, temp: 0.2, selftest: false, out: path.join(__dirname, "results") };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--model") a.model = argv[++i];
    else if (k === "--arms") a.arms = argv[++i].split(",").map((s) => s.trim());
    else if (k === "--runs") a.runs = parseInt(argv[++i], 10);
    else if (k === "--budget") a.budget = parseInt(argv[++i], 10);
    else if (k === "--temp") a.temp = parseFloat(argv[++i]);
    else if (k === "--field") a.field = argv[++i] !== "off";
    else if (k === "--selftest") a.selftest = true;
    else if (k === "--out") a.out = argv[++i];
  }
  return a;
}

// Stub driver for --selftest: echoes the injected memory block so we can
// verify (a) memory reaches the prompt and (b) grading fires. It "knows"
// nothing on its own, so cold should score near-zero except the in-session
// control, recency should recover only the late plants, and rm should
// recover buried facts if recall is firing. Plumbing check, NOT a model result.
function stubChat(messages) {
  const mem = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const convo = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  return Promise.resolve((mem + "\n" + convo + "\n" + (lastUser ? lastUser.content : "")).toLowerCase());
}

// One combined system message: base persona + (if any) the arm's memory block,
// framed as established fact. A weak SECOND system message is ignored by
// gpt-oss-20b even when it holds the answer - so both recency and rm inject
// the SAME way and the comparison stays about block CONTENT, not framing.
function buildSystem(base, block) {
  if (!block) return base;
  return base +
    "\n\nSAVED MEMORY ABOUT JULES (treat as established fact; use it to answer, and prefer the most recent when facts conflict):\n" +
    block;
}

async function playRun({ model, arm, budget, field, temp, embed, selftest }) {
  const results = [];
  let injTokTotal = 0, injTokCount = 0;

  for (const session of scenario.sessions) {
    const convo = [];
    for (const turn of session.turns) {
      // Non-probe turns are only ever SAVED. Their throwaway assistant reply
      // is never scored and never enters a probe's context (sessions reset).
      if (!turn.probe) { await arm.observeUser(turn.u); continue; }

      const block = await arm.memoryBlock(turn.u);
      if (block.tokens) { injTokTotal += block.tokens; injTokCount++; }
      const turnMessages = [
        { role: "system", content: buildSystem(scenario.SYSTEM, block.text) },
        ...convo,
        { role: "user", content: turn.u },
      ];

      const answer = selftest
        ? await stubChat(turnMessages)
        : await chat(turnMessages, { model, temperature: temp, maxTokens: 400 });

      const g = gradeProbe(answer, turn.probe.gold);
      results.push({ id: turn.probe.id, kind: turn.probe.kind, ...g, answer, injected: block.text });
      if (process.env.AB_DEBUG) {
        process.stderr.write(`\n--DEBUG ${arm.kind} ${turn.probe.id} inj=${block.tokens}tok--\nBLOCK: ${block.text.slice(0, 500)}\nANSWER: ${answer.slice(0, 200)}\n`);
      }
      convo.push({ role: "user", content: turn.u });
      convo.push({ role: "assistant", content: answer });
      await arm.observeUser(turn.u);
    }
  }
  await arm.close();
  const injAvg = injTokCount ? injTokTotal / injTokCount : 0;
  return { results, injAvg };
}

function acc(results, pred = () => true) {
  const xs = results.filter(pred);
  if (!xs.length) return null;
  return xs.filter((r) => r.pass).length / xs.length;
}

const HARD_KINDS = new Set(["update", "update-historical", "discrim"]);
const RECENT_KINDS = new Set(["recent"]);

async function runArm(armKind, opts) {
  const perRun = [];
  const perRunHard = [];
  const perRunRecent = [];
  const injAvgs = [];
  const lastAnswers = [];
  for (let r = 0; r < opts.runs; r++) {
    const arm = await makeArm(armKind, {
      budget: opts.budget, embed: opts.embed, field: opts.field, runTag: armKind + "-" + r,
    });
    const { results, injAvg } = await playRun({ ...opts, arm });
    perRun.push(acc(results));
    perRunHard.push(acc(results, (x) => HARD_KINDS.has(x.kind)) ?? 0);
    perRunRecent.push(acc(results, (x) => RECENT_KINDS.has(x.kind)) ?? 0);
    injAvgs.push(injAvg);
    if (r === opts.runs - 1) lastAnswers.push(...results);
    process.stdout.write(`  ${armKind} run ${r + 1}/${opts.runs}: acc=${(acc(results) * 100).toFixed(0)}%` +
      ` hard=${((acc(results, (x) => HARD_KINDS.has(x.kind)) ?? 0) * 100).toFixed(0)}%` +
      ` recent=${((acc(results, (x) => RECENT_KINDS.has(x.kind)) ?? 0) * 100).toFixed(0)}%\n`);
  }
  return {
    arm: armKind,
    acc: stats(perRun),
    hardAcc: stats(perRunHard),
    recentAcc: stats(perRunRecent),
    injTokAvg: stats(injAvgs).mean,
    sampleAnswers: lastAnswers,
  };
}

function verdict(by) {
  const cold = by.cold?.acc.mean, rec = by.recency?.acc.mean, rm = by.rm?.acc.mean;
  const rmHard = by.rm?.hardAcc.mean, recHard = by.recency?.hardAcc.mean;
  const recRecent = by.recency?.recentAcc.mean;
  if (rm == null || cold == null || rec == null) return "INCOMPLETE (need cold+recency+rm arms)";
  let note = "";
  if (recRecent != null && recRecent < 0.5) {
    note = " [SCENARIO-WEAK: recency < 50% on in-window `recent` probes; do not read an RM win as beating a working control]";
  }
  if (rm <= cold + 0.05) return "FAIL-DEAD (RM no better than cold; recall not firing)" + note;
  if (rm < rec - 0.05) return "FAIL-NOISE (RM worse than recency at equal budget)" + note;
  const pass = rm >= cold + 0.15 && rm >= rec && (recHard == null || rmHard >= recHard);
  return (pass ? "PASS" : "MIXED (memory helps, but RM did not clear the pre-declared bar over recency)") + note;
}

function toMarkdown(a, by, v, loaded) {
  const pct = (x) => x == null ? "  -  " : (x * 100).toFixed(1) + "%";
  const L = [];
  L.push(`# A/B value rig - Grok's scenario (Jules Marin)`);
  L.push("");
  L.push(`- driver (label): \`${a.model}\`   loaded on server: ${loaded ? loaded.join(", ") : "unknown"}`);
  L.push(`- runs per arm: ${a.runs}   injection budget: ${a.budget} tok   field: ${a.field ? "on" : "off"}   temp: ${a.temp}`);
  L.push(`- scenario: ${scenario.sessions.length} sessions, ${scenario.sessions.reduce((n, s) => n + s.turns.filter((t) => t.probe).length, 0)} probes, user=${scenario.meta.user}`);
  L.push(`- selftest: ${a.selftest ? "yes (stub driver)" : "no"}`);
  L.push("");
  L.push(`## Verdict: ${v}`);
  L.push("");
  L.push(`| arm | probe accuracy (mean +/- sd) | hard-subset acc | recent-subset acc | inj tok/turn |`);
  L.push(`|---|---|---|---|---|`);
  for (const arm of a.arms) {
    const x = by[arm]; if (!x) continue;
    L.push(`| ${arm} | ${pct(x.acc.mean)} +/- ${(x.acc.sd * 100).toFixed(1)} | ${pct(x.hardAcc.mean)} | ${pct(x.recentAcc.mean)} | ${x.injTokAvg.toFixed(0)} |`);
  }
  L.push("");
  L.push(`hard-subset = {update, update-historical, discrim} - where naive recency structurally loses the old/superseded/same-name facts.`);
  L.push(`recent-subset = {recent} - late plants left inside the recency window on purpose. Recency is *supposed* to win or tie here.`);
  L.push("");
  L.push(`Pre-declared bands: ${scenario.meta.bands.pass}`);
  L.push(`FAIL-DEAD: ${scenario.meta.bands.failDead}`);
  L.push(`FAIL-NOISE: ${scenario.meta.bands.failNoise}`);
  L.push("");
  L.push(`## Sample per-probe results (final run of each arm)`);
  for (const arm of a.arms) {
    const x = by[arm]; if (!x) continue;
    L.push(`\n### ${arm}`);
    for (const r of x.sampleAnswers) {
      L.push(`- ${r.pass ? "PASS" : "FAIL"} \`${r.id}\` (${r.kind}) ${r.hitReject ? "reject:'" + r.hitReject + "'" : r.hitAccept ? "accept:'" + r.hitAccept + "'" : "no-match"}`);
    }
  }
  return L.join("\n");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const embed = makeEmbed({ model: process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5" });
  const loaded = a.selftest ? ["(selftest stub)"] : await listLoaded();

  console.log(`\nA/B grok-rig  model=${a.model}  arms=${a.arms.join(",")}  runs=${a.runs}  budget=${a.budget}  field=${a.field ? "on" : "off"}${a.selftest ? "  [SELFTEST]" : ""}`);
  console.log(`scenario user=${scenario.meta.user}  (independent of eval/ab Dana)`);
  if (!a.selftest) {
    console.log(`server /v1/models: ${loaded ? loaded.join(", ") : "UNREACHABLE"}`);
    if (!loaded) { console.error("ERROR: LM Studio server not reachable on the embed/chat endpoint. Load a chat model + an embedder and retry."); process.exit(2); }
    const hasEmbed = loaded.some((m) => /embed|nomic|bge|gte|jina|gemma/i.test(m));
    if (!hasEmbed) console.warn("WARN: no embedding-looking model in /v1/models - the RM arm will fall back to keyword ranking. Load nomic-embed-text-v1.5.");
  } else {
    const ping = await listLoaded();
    if (!ping) {
      console.warn("WARN: --selftest still needs the embedder for the RM arm (chat is stubbed). LM Studio unreachable; RM saves will fail open.");
    }
  }

  const by = {};
  for (const armKind of a.arms) {
    console.log(`\n[${armKind}]`);
    by[armKind] = await runArm(armKind, { model: a.model, runs: a.runs, budget: a.budget, field: a.field, temp: a.temp, embed, selftest: a.selftest });
  }

  const v = verdict(by);
  const md = toMarkdown(a, by, v, loaded);
  fs.mkdirSync(a.out, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(a.out, `${a.model.replace(/[^a-z0-9]+/gi, "-")}-${a.selftest ? "selftest-" : ""}${stamp}`);
  fs.writeFileSync(base + ".json", JSON.stringify({ args: a, loaded, by, verdict: v, meta: scenario.meta }, null, 2));
  fs.writeFileSync(base + ".md", md);
  console.log("\n" + md);
  console.log(`\nwrote ${base}.json / .md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
