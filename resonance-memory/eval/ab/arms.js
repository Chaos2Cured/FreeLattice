/*
 * Resonance Memory - A/B value rig
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later.
 */
/*
 * arms.js - the three memory conditions. Same driver, same scripted user, same
 * injection budget; the ONLY difference is how each arm chooses what cross-session
 * context to hand the model before a turn.
 *
 *   cold     no cross-session memory. Current session's conversation only. The floor.
 *   recency  the naive thing a dev actually does: dump the most-recent raw user
 *            turns into context, newest first, up to BUDGET tokens.
 *   rm       Resonance Memory as shipped: save every user turn; recall() top-k for
 *            the current turn; inject the real recall string, truncated to BUDGET.
 *
 * recency and rm get an IDENTICAL token budget. That is the whole rig: given the
 * same room in context, does RM's semantic recall pick better than raw recency?
 * cold gets none - it establishes that memory matters at all.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { openStore } = require("../../store.js");
const { createMemory } = require("../pipeline.js");
const { estTokens } = require("./lib/llm.js");

const EMPTY_SENTINELS = [
  "No memories saved yet.",
  "Provide a `query` string to recall.",
];

function truncateToBudget(text, budgetTokens) {
  const s = String(text || "");
  const maxChars = budgetTokens * 4;
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars).replace(/\s+\S*$/, "") + " ...";
}

// cold ------------------------------------------------------------------------
function coldArm() {
  return {
    kind: "cold",
    async observeUser() {},
    async memoryBlock() { return { text: "", tokens: 0 }; },
    async close() {},
  };
}

// recency ---------------------------------------------------------------------
// Holds every prior user turn across all sessions; before a turn, packs the most
// recent ones (newest-first) up to the budget. This is the honest hard control:
// "just keep the recent history."
function recencyArm({ budget }) {
  const history = []; // all prior user turns, oldest -> newest
  return {
    kind: "recency",
    async observeUser(text) { history.push(String(text)); },
    async memoryBlock() {
      const lines = [];
      let toks = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const line = "- " + history[i];
        const t = estTokens(line);
        if (toks + t > budget) break;
        lines.unshift(line);
        toks += t;
      }
      return { text: lines.join("\n"), tokens: toks };
    },
    async close() {},
  };
}

// rm --------------------------------------------------------------------------
async function rmArm({ budget, embed, field, k = 8, runTag }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-ab-"));
  const storeFile = path.join(dir, "store.jsonl");
  const store = await openStore(storeFile, { backend: "sqlite" });
  const mem = createMemory({
    store, embed,
    fieldEnabled: !!field,
    edgesPath: storeFile + ".edges.json",
  });
  return {
    kind: "rm",
    dir,
    async observeUser(text) {
      try { await mem.save(String(text)); }
      catch (e) { process.stderr.write("SAVE-FAIL: " + String(e && e.message || e) + "\n"); }
    },
    async memoryBlock(query) {
      let out = "";
      try { out = await mem.recall(String(query), k); } catch { out = ""; }
      if (!out || EMPTY_SENTINELS.some((s) => out.startsWith(s))) return { text: "", tokens: 0 };
      const clipped = truncateToBudget(out, budget);
      return { text: clipped, tokens: estTokens(clipped) };
    },
    async close() {
      try { store.close && store.close(); } catch {}
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function makeArm(kind, opts) {
  if (kind === "cold") return coldArm();
  if (kind === "recency") return recencyArm(opts);
  if (kind === "rm") return rmArm(opts);
  throw new Error("unknown arm: " + kind);
}

module.exports = { makeArm };
