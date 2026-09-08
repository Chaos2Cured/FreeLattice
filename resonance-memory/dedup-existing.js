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
 * --dedup-existing (RM-02.c): offline banded-dedup backfill for stores
 * written before RM-02.b landed.
 *
 * Dry-run is the DEFAULT (reports the plan, mutates nothing). `--apply`
 * performs it as one durable rewrite. The decision is NOT a second
 * implementation: `dedupExisting()` in memory-core.js calls the same
 * detectNearDuplicate / pickMergeSurvivor / mergeBandPatches path that
 * save() uses, so the offline pass and the write path cannot disagree.
 *
 *   node entry.js --dedup-existing            # dry-run
 *   node entry.js --dedup-existing --apply    # mutate
 *   npm run dedup-existing -- --apply
 *
 * Optional store path as a non-flag argument; otherwise MEMORY_FILE_PATH
 * (same default as the MCP server).
 */

const fs = require("fs");
const path = require("path");
const { JsonlStore } = require("./store.js");
const { readDedupThresholds, dedupExisting } = require("./memory-core.js");

const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";

function defaultStorePath() {
  return process.env.MEMORY_FILE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
}

function parseArgs(argv) {
  const args = argv || [];
  const apply = args.includes("--apply");
  const json = args.includes("--json");
  const help = args.includes("--help") || args.includes("-h");
  const pathArg = args.find((a) => a && !String(a).startsWith("-"));
  return { apply, json, help, storePath: pathArg || defaultStorePath() };
}

function loadThresholds(storePath) {
  const configPath = process.env.RESONANCE_MEMORY_CONFIG ||
    path.join(path.dirname(storePath), "resonance-memory.config.json");
  try {
    return readDedupThresholds(JSON.parse(fs.readFileSync(configPath, "utf8")));
  } catch { /* no config yet -> env / defaults */ }
  return readDedupThresholds(null);
}

async function embed(texts) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("embed HTTP " + res.status);
  const body = await res.json();
  return body.data.map((d) => d.embedding);
}

function snippet(text, n = 64) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function formatPlan(plan, { apply, storePath } = {}) {
  const lines = [];
  const mode = apply ? (plan.wrote ? "applied" : "apply (nothing to write)") : "dry-run";
  lines.push("Resonance Memory — --dedup-existing (" + mode + ")");
  if (storePath) lines.push("Store: " + storePath);
  lines.push("Thresholds: HI=" + plan.hi + "  LO=" + plan.lo);
  lines.push("Pass order: " + plan.passOrder);
  lines.push("");
  lines.push("Current records: " + plan.beforeCount);
  if (plan.vectorBackfills) {
    lines.push("Vector backfills (legacy rows re-embedded): " + plan.vectorBackfills +
      (apply ? " (persisted)" : " (in-memory for the plan; persist on --apply)"));
  }
  if (plan.skipped && plan.skipped.length) {
    lines.push("Skipped (no vector): " + plan.skipped.length);
    for (const s of plan.skipped) {
      lines.push("  skipped: no vector  [id " + s.id + "] " + snippet(s.text));
    }
  } else {
    lines.push("Skipped (no vector): 0");
  }
  lines.push("");

  if (plan.nothingToDo) {
    lines.push("Nothing to do. Store is already clean (0 restatements, 0 merges).");
    if (!apply) lines.push("Nothing written (dry-run).");
    return lines.join("\n");
  }

  lines.push("Restatements (" + plan.restatements.length + "):");
  if (!plan.restatements.length) {
    lines.push("  (none)");
  } else {
    for (const r of plan.restatements) {
      lines.push("  [id " + r.incomingId + "] \"" + snippet(r.incomingText) + "\"" +
        "  → collapse into [id " + r.matchId + "] \"" + snippet(r.matchText) + "\"" +
        "  (cos=" + Number(r.cosine).toFixed(4) + ")");
    }
  }
  lines.push("");
  lines.push("Merges (" + plan.merges.length + "):");
  if (!plan.merges.length) {
    lines.push("  (none)");
  } else {
    for (const m of plan.merges) {
      lines.push("  survivor [id " + m.survivorId + "] \"" + snippet(m.survivorText) + "\"");
      lines.push("    would supersede [id " + m.loserId + "] \"" + snippet(m.loserText) + "\"" +
        "  (cos=" + Number(m.cosine).toFixed(4) + ")");
    }
  }
  lines.push("");
  lines.push("Projected: " + plan.beforeCount + " current → " + plan.afterCount + " current");
  lines.push("duplicate_rate: " + plan.duplicateRateBefore.toFixed(4) +
    " → " + plan.duplicateRateAfter.toFixed(4) +
    "  (extras " + plan.extras + " → 0)");
  if (!apply) {
    lines.push("");
    lines.push("Nothing written (dry-run). Re-run with --apply to perform.");
  } else if (plan.wrote) {
    lines.push("");
    lines.push("Applied as one durable rewrite. Losers kept with superseded_by (I8).");
  }
  return lines.join("\n");
}

const USAGE = [
  "Usage: resonance-memory --dedup-existing [--apply] [--json] [store.jsonl]",
  "",
  "  Scan a store written before RM-02.b and report (or apply) cosine-banded",
  "  restatements and merges. Dry-run is the default — mutates nothing.",
  "",
  "  --apply    perform the plan as one durable rewrite",
  "  --json     machine-readable plan on stdout",
  "  --help     this message",
  "",
  "Store path defaults to MEMORY_FILE_PATH, then ~/.lmstudio/resonance-memory.jsonl.",
  "Thresholds: live-config dedup_hi/dedup_lo, else RESONANCE_DEDUP_HI/LO, else 0.95/0.88.",
].join("\n");

async function run(opts) {
  const storePath = opts.storePath || defaultStorePath();
  const apply = !!opts.apply;
  const store = opts.store || new JsonlStore(storePath);
  const embedFn = opts.embed === undefined ? embed : opts.embed;
  const thresholds = opts.thresholds || loadThresholds(store.file || storePath);
  const plan = await dedupExisting({
    store,
    embed: embedFn,
    apply,
    now: opts.now,
    thresholds,
  });
  plan.storePath = store.file || storePath;
  plan.applied = apply;
  return plan;
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(USAGE);
    return 0;
  }
  if (!fs.existsSync(parsed.storePath)) {
    console.log("No store at " + parsed.storePath + ". Nothing to do.");
    return 0;
  }
  const plan = await run({
    storePath: parsed.storePath,
    apply: parsed.apply,
    embed: embed,
  });
  if (parsed.json) {
    const out = {
      storePath: plan.storePath,
      applied: plan.applied,
      wrote: plan.wrote,
      nothingToDo: plan.nothingToDo,
      hi: plan.hi, lo: plan.lo,
      passOrder: plan.passOrder,
      beforeCount: plan.beforeCount,
      afterCount: plan.afterCount,
      extras: plan.extras,
      duplicateRateBefore: plan.duplicateRateBefore,
      duplicateRateAfter: plan.duplicateRateAfter,
      vectorBackfills: plan.vectorBackfills,
      restatements: plan.restatements,
      merges: plan.merges,
      skipped: plan.skipped,
    };
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(formatPlan(plan, { apply: parsed.apply, storePath: parsed.storePath }));
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
}

module.exports = { parseArgs, run, main, formatPlan, USAGE };
