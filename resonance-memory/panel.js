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
 * panel.js - the zero-terminal control panel for Resonance Memory.
 *
 * A tiny local web server (127.0.0.1 only) that:
 *   - toggles the associative field and (when a capable model is detected) LLM extraction
 *     (writes the shared config.json the MCP server reads live),
 *   - connects/disconnects the server from LM Studio / Claude Desktop,
 *   - draws the association graph (your memories, or a synthetic demo),
 *   - first-run empty-store nudge (RM-20): when the user store has zero
 *     current memories, offer a starter prompt and a "connected but never
 *     saved" hint. Not an MCP tool.
 *   - exports YOUR store as a zip (RM-07 slice 2c; shells export-memory.js, never
 *     demo-seed.jsonl; not an MCP tool — a model that can dump the store is an
 *     exfil path),
 *   - imports a zip or memories.jsonl (RM-17 panel button: confirm modal,
 *     POST /api/import shells runImport(), --with-edges checkbox default-off,
 *     heartbeat pause + yield like export; not an MCP tool),
 *   - W-02: Host must be loopback, Origin (when present) must be this panel,
 *     mutating POSTs require a per-process token baked into the page. Settles
 *     the CSRF / DNS-rebinding ship-gate before RM-12 documents the HTTP
 *     surface. Residual: a local process that reads the page can steal the
 *     token — same class as "any process on this machine can talk to 127.0.0.1".
 *     No CORS. Not a fifth MCP verb, and
 *   - shuts itself down shortly after you close the page (heartbeat), so nothing lingers.
 *     Export pauses that watchdog and yields the event loop so a 30–60s zip of
 *     50k members cannot starve /api/ping and process.exit(0) a truncated tmp.
 *
 * Launch it hidden with start-panel.vbs (no console window). No CLI knowledge required.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec, execFile } = require("child_process");
const install = require("./install.js");
const field = require("./field.js");
const engine = require("./engine.js");
const { openEdgeStore } = require("./edges.js");
const { normalize, isCurrent, isVector } = require("./record.js");
const { openStore } = require("./store.js");
const { readFieldMinSim } = require("./memory-core.js");
const { pairConflictFn, resolveEntities } = require("./entity.js");
const extract = require("./extract.js");
const exp = require("./export-memory.js");
const imp = require("./import-memory.js");

function baseDir() {
  // In a bundled single-executable, __dirname is virtual; resolve next to the exe.
  try { const sea = require("node:sea"); if (sea.isSea()) return path.dirname(process.execPath); } catch { }
  return __dirname;
}
const STORE_PATH = process.env.MEMORY_FILE_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
// Keep runtime state WITH the data (not next to the exe) so the downloaded exe leaves
// nothing beside itself, and the field on/off setting survives moving the exe.
const CONFIG_PATH = process.env.RESONANCE_MEMORY_CONFIG ||
  path.join(path.dirname(STORE_PATH), "resonance-memory.config.json");
const DEMO_PATH = path.join(baseDir(), "demo-seed.jsonl");
const PORT = Number(process.env.RESONANCE_MEMORY_PANEL_PORT || 9090);
// W-02: per-process CSRF token. Injected into the page; required on every
// mutating POST as X-Resonance-Token. A form from another origin cannot set
// a custom header. Tests may pin RM_PANEL_TOKEN; production is random.
const PANEL_TOKEN = process.env.RM_PANEL_TOKEN || crypto.randomBytes(16).toString("hex");
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const KOFI = "https://ko-fi.com/thearchitectofresonance";
const PAYPAL = "https://paypal.me/SamuelGrim91";

// Runtime assets baked into the exe by build-exe.js (single-file distribution).
// Absent when running from source (node panel.js) - then we just read from disk.
let EMBEDDED = { demoSeed: "", systemPrompt: "" };
try { EMBEDDED = require("./embedded-assets.js"); } catch { }

// system-prompt.md is a human-facing doc: a short intro, the paste-ready block
// inside a ``` fence, and an outro. The "copy" button must hand over ONLY the
// fenced block — pasting the intro ("paste the block below…") into a model's
// system prompt is instructions-about-instructions, not a prompt. Extract the
// first fenced block; fall back to the whole text if the file has no fence.
function pickPromptBlock(md) {
  const s = String(md || "");
  const m = s.match(/```[^\n]*\n([\s\S]*?)\n```/);
  return (m ? m[1] : s).trim();
}

function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { return {}; } }
function writeConfig(c) { fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true }); fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2), "utf8"); }
function fieldOn() { const c = readConfig(); return typeof c.field === "boolean" ? c.field : false; }
function extractOn() { return extract.readExtractEnabled(readConfig()); }

// --- Per-embedder tuning presets ---------------------------------------
// Recall geometry is embedder-specific: the cosine thresholds (dedup bands,
// field minSim, constraint gate, save-bind) are calibrated to ONE model's
// distribution, and a value tuned for nomic is wrong for jina or qwen. So
// each supported embedder carries its own preset.
//
// Calibration: eval/substrate/fire-together-embedder-fair-report.md (2026-09-06).
// nomic numbers are the shipped duplicates-tuned values, re-confirmed, except
// field_minsim 0.55 → 0.70 (measured: 0 near-miss Related: edges, true-pair
// recall 0.93). Qwen/jina from each model's own duplicates.jsonl + fire-together
// pairwise. server.js now applies embedder-specific invocation (nomic raw,
// Qwen Instruct-query, jina Query:/Document:) keyed off config.embedder, so
// a jina/Qwen selection is no longer the broken plain geometry. Anti-lock-in
// by design: many options, each independently usable.
const NOMIC_TUNING = { dedup_hi: 0.95, dedup_lo: 0.88, field_minsim: 0.70, constraint_gate: 0.45, save_bind: 0.25 };
const QWEN_TUNING  = { dedup_hi: 0.95, dedup_lo: 0.89, field_minsim: 0.65, constraint_gate: 0.55, save_bind: 0.26 };
const JINA_TUNING  = { dedup_hi: 0.98, dedup_lo: 0.84, field_minsim: 0.55, constraint_gate: 0.40, save_bind: 0.15 };
const EMBEDDER_PRESETS = [
  { key: "nomic-embed-text",   label: "Nomic embed v1.5",         license: "Apache-2.0",                dim: 768,  calibrated: true,  tuning: NOMIC_TUNING },
  { key: "qwen3-embedding",    label: "Qwen3-Embedding 0.6B",     license: "Apache-2.0",                dim: 1024, calibrated: true,  tuning: QWEN_TUNING },
  { key: "embeddinggemma",     label: "EmbeddingGemma 300M",      license: "Gemma license",             dim: 768,  calibrated: false, tuning: NOMIC_TUNING },
  { key: "jina-embeddings-v5", label: "Jina embeddings v5 (nano)", license: "CC-BY-NC · personal use", dim: 768,  calibrated: true,  tuning: JINA_TUNING },
];
function matchPreset(modelId) {
  if (!modelId) return null;
  const m = String(modelId).toLowerCase();
  return EMBEDDER_PRESETS.find((p) => m.includes(p.key)) || null;
}
const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";

function parseJsonl(text) {
  return String(text).split("\n").filter(Boolean)
    .map((l) => { try { return normalize(JSON.parse(l)); } catch { return null; } })
    .filter((r) => r && !r.deleted);
}
function parseJsonlFile(file) {
  try { return parseJsonl(fs.readFileSync(file, "utf8")); } catch { return []; }
}
async function loadUserRecords(file) {
  // Slice 4: same openStore walk as the MCP server (sqlite default,
  // auto-migrate on first open, fail-open to JSONL). Demo seed is never
  // this path — auto-migrating demo-seed.jsonl would mutate a tracked file.
  let s;
  try {
    s = await openStore(file, { config: readConfig() });
    return s.active();
  } catch { return []; }
  finally { try { if (s && typeof s.close === "function") s.close(); } catch { /* */ } }
}
// Demo: prefer a loose demo-seed.jsonl (dev) but fall back to the embedded copy so a
// bare, single-file exe still draws the demo graph with nothing beside it.
function loadDemo() {
  const disk = parseJsonlFile(DEMO_PATH);
  return disk.length ? disk : parseJsonl(EMBEDDED.demoSeed);
}
// Currently-true memories. Superseded ones are still on disk (history is kept),
// but "how many memories do I have" means the ones that are actually true now.
async function memCount() {
  return (await loadUserRecords(STORE_PATH)).filter(isCurrent).length;
}

// Build the association graph for the view: nodes = memories, edges = kNN semantic links,
// annotated with any learned Hebbian weight so the UI can highlight what use has reinforced.
async function graphData(demo) {
  let recs;
  let edges = null;
  let opened = null;
  if (demo) {
    recs = loadDemo().filter((r) => isVector(r.embedding));
  } else {
    try {
      opened = await openStore(STORE_PATH, { config: readConfig() });
      recs = opened.active().filter((r) => isVector(r.embedding));
      if (fieldOn()) {
        try { edges = openEdgeStore({ store: opened, storePath: STORE_PATH }); } catch { /* I3 */ }
      }
    } catch {
      recs = [];
    }
  }
  try {
    const byId = new Map(recs.map((r) => [String(r.id), r]));
    const bonus = edges ? (a, b) => edges.bonus(a, b) : () => 0;
    const minSim = readFieldMinSim(readConfig());
    const m = field.buildEdges(recs, {
      k: 3, minSim, bonus,
      conflict: pairConflictFn(resolveEntities(recs)),
    });
    const seen = new Map();
    for (const [a, list] of m) {
      for (const e of list) {
        const key = [String(a), String(e.id)].sort().join(":");
        if (seen.has(key)) continue;
        const ra = byId.get(String(a)), rb = byId.get(String(e.id));
        const base = field.cosine(ra.embedding, rb.embedding);
        const heb = edges ? edges.weight(a, e.id) : 0;
        seen.set(key, { a: String(a), b: String(e.id), w: Number(base.toFixed(4)), hebbian: Number(heb.toFixed(4)) });
      }
    }
    return {
      nodes: recs.map((r) => ({
        id: String(r.id),
        text: r.text,
        current: isCurrent(r),                       // superseded ones render dimmed
        superseded_by: r.superseded_by != null ? String(r.superseded_by) : null,
      })),
      edges: [...seen.values()],
      source: demo ? "demo" : "your memories",
      field: !!edges,
      current_count: recs.filter(isCurrent).length,
    };
  } finally {
    try { if (opened && typeof opened.close === "function") opened.close(); } catch { /* */ }
  }
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resonance Memory</title>
<style>
  :root { color-scheme: light dark; --acc: #2f9e6b; --heb: #d9873b; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 12px;
    font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f4f5f7; color: #1c1e21; }
  .card { width: min(94vw, 560px); background: #fff; border-radius: 18px; padding: 28px;
    box-shadow: 0 12px 40px rgba(0,0,0,.10); border: 1px solid rgba(0,0,0,.06); }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 13px; margin: 0 0 22px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 16px 18px; border-radius: 14px; background: #f7f8fa; border: 1px solid rgba(0,0,0,.05); }
  .label { font-weight: 600; } .hint { color: #6b7280; font-size: 12.5px; margin-top: 3px; }
  .switch { position: relative; width: 60px; height: 34px; flex: none; cursor: pointer; }
  .switch input { display: none; }
  .slider { position: absolute; inset: 0; background: #cbd0d8; border-radius: 999px; transition: .22s; }
  .slider::before { content: ""; position: absolute; height: 26px; width: 26px; left: 4px; top: 4px;
    background: #fff; border-radius: 50%; transition: .22s; box-shadow: 0 2px 5px rgba(0,0,0,.25); }
  input:checked + .slider { background: var(--acc); }
  input:checked + .slider::before { transform: translateX(26px); }
  .switch input:disabled + .slider { opacity: .55; cursor: default; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 600; font-size: 12px; }
  .on { background: #dcf5e8; color: #1c7a4f; } .off { background: #eceef1; color: #6b7280; }
  .warn { background: #fceccb; color: #8a5a00; }
  .label .pill { margin-left: 7px; vertical-align: middle; }
  .sec { margin-top: 20px; }
  .sechead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .ctitle { font-weight: 600; } .clients { margin-bottom: 4px; }
  .linkish { background: none; border: none; padding: 0; margin: 0; font: inherit; font-weight: 600;
    color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .linkish:hover { color: var(--acc); } #caret { font-size: 11px; color: #9aa1ab; }
  .client { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 14px; border-radius: 12px; background: #f7f8fa; border: 1px solid rgba(0,0,0,.05); margin-bottom: 8px; }
  .cname { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 9px;
    border: 1px solid rgba(0,0,0,.12); background: #fff; color: #1c1e21; cursor: pointer; }
  button.primary { background: var(--acc); border-color: var(--acc); color: #fff; }
  button:disabled { opacity: .55; cursor: default; }
  .btncol { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
  .pickrow { display: flex; gap: 8px; margin: 0 0 12px; }
  .pickrow input[type=text] { flex: 1; font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,.12); background: #f7f8fa; color: inherit; }
  .modal-card label.check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px;
    margin: 0 0 10px; color: #374151; line-height: 1.4; }
  .modal-card label.check input { margin-top: 3px; }
  .graphwrap { border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,.08); background: #fbfbfd; }
  canvas { display: block; width: 100%; height: 340px; touch-action: none; cursor: grab; }
  canvas:active { cursor: grabbing; }
  .cap { min-height: 34px; padding: 8px 12px; font-size: 12.5px; color: #4b5563;
    border-top: 1px solid rgba(0,0,0,.06); background: #f7f8fa; }
  .cap b { color: var(--acc); }
  .legend { font-size: 11.5px; color: #9aa1ab; margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: middle; margin-right: 4px; }
  .foot { margin-top: 20px; font-size: 12px; color: #9aa1ab; line-height: 1.5; }
  .foot a { color: var(--acc); } #spMsg { color: var(--acc); font-weight: 600; }
  .foot code { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px;
    background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 5px; word-break: break-all; }
  .support { margin-top: 18px; text-align: center; font-size: 13px; }
  .support a { display: inline-block; margin: 6px 5px 0; padding: 8px 16px; border-radius: 10px;
    text-decoration: none; font-weight: 600; border: 1px solid rgba(0,0,0,.12); color: #1c1e21; }
  .support a.kofi { background: #ffdd66; border-color: #ffcf33; color: #4a3a00; }
  .support .why { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid;
    place-items: center; z-index: 40; padding: 16px; }
  .modal[hidden] { display: none; }
  .modal-card { width: min(92vw, 460px); background: #fff; border-radius: 16px;
    padding: 22px 22px 18px; box-shadow: 0 16px 50px rgba(0,0,0,.25);
    border: 1px solid rgba(0,0,0,.08); }
  .modal-card h2 { font-size: 17px; margin: 0 0 10px; }
  .modal-card p { margin: 0 0 10px; font-size: 13.5px; color: #374151; }
  .modal-card .dest { font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    background: #f7f8fa; padding: 8px 10px; border-radius: 8px; word-break: break-all;
    margin: 0 0 12px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
  .toast { margin-top: 10px; font-size: 13px; color: #1c7a4f; }
  .toast code { font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 5px; word-break: break-all; }
  .busy-note { color: #8a5a00; font-size: 12.5px; margin-top: 6px; }
  .firstrun { margin: 0 0 14px; padding: 12px 14px; border-radius: 12px;
    background: #fff8e8; border: 1px solid rgba(180,130,20,.25); }
  .firstrun .label { margin-bottom: 4px; }
  .firstrun .hint { margin: 0 0 8px; color: #5b4a20; }
  .firstrun button { margin-top: 2px; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181c; color: #e6e8eb; }
    .card { background: #1f2227; border-color: rgba(255,255,255,.07); box-shadow: 0 12px 40px rgba(0,0,0,.4); }
    .row, .client, .cap, .graphwrap { background: #171a1e; border-color: rgba(255,255,255,.06); }
    .sub, .hint, .foot, .support .why, .cap { color: #9aa1ab; }
    .off { background: #2a2e35; color: #9aa1ab; }
    .warn { background: #4a3a12; color: #f0c674; }
    .foot code { background: rgba(255,255,255,.08); }
    button { background: #2a2e35; color: #e6e8eb; border-color: rgba(255,255,255,.12); }
    button.primary { background: var(--acc); border-color: var(--acc); color: #fff; }
    .support a { background: #2a2e35; color: #e6e8eb; border-color: rgba(255,255,255,.12); }
    .support a.kofi { background: #ffdd66; color: #4a3a00; border-color: #ffcf33; }
    .modal-card { background: #1f2227; border-color: rgba(255,255,255,.08); }
    .modal-card p { color: #c5cad3; }
    .modal-card .dest { background: #171a1e; }
    .pickrow input[type=text] { background: #171a1e; border-color: rgba(255,255,255,.12); color: #e6e8eb; }
    .modal-card label.check { color: #c5cad3; }
    .toast { color: #6ee7b7; }
    .toast code { background: rgba(255,255,255,.08); }
    .firstrun { background: #3a2f12; border-color: rgba(240,198,116,.25); }
    .firstrun .hint { color: #f0c674; }
  }
</style></head>
<body>
  <div class="card">
    <h1>&#128220; Resonance Memory</h1>
    <p class="sub">A local memory for your AI. Nothing leaves this machine.</p>

    <div id="clients" class="clients sec"></div>

    <div id="firstRun" class="firstrun" hidden>
      <div class="label" id="firstRunTitle">Nothing saved yet</div>
      <div class="hint" id="firstRunHint">Your AI has a memory, but the store is empty. In your next chat, tell it a few things worth keeping &mdash; who you are, a rule it should follow, the project you&rsquo;re in &mdash; then say <b>remember that</b>.</div>
      <button type="button" id="seedBtn">Copy a starter prompt</button>
      <span id="seedMsg" class="hint" style="margin-left:8px"></span>
    </div>

    <div class="row" id="engineRow" style="margin-bottom:10px">
      <div>
        <div class="label">Meaning engine <span id="enginePill" class="pill off">checking&hellip;</span></div>
        <div class="hint" id="engineHint">The model that lets recall match by meaning, not just exact words.</div>
      </div>
      <button id="engineBtn" style="display:none"></button>
    </div>

    <div class="row" id="embedderRow" style="margin-top:10px">
      <div>
        <div class="label">Embedder tuning <span id="embedderPill" class="pill off">&hellip;</span></div>
        <div class="hint" id="embedderHint">Recall geometry depends on which embedder you run. Pick your model and Resonance applies its tuning. More options means no single model can lock you in.</div>
      </div>
      <select id="embedderSel" style="max-width:200px"></select>
    </div>

    <div class="row">
      <div>
        <div class="label">Associative field</div>
        <div class="hint">Recall also surfaces related memories, and the graph learns which ideas go together as you use it.</div>
      </div>
      <label class="switch"><input type="checkbox" id="tog"><span class="slider"></span></label>
    </div>

    <div class="row" id="extractRow" style="margin-top:10px">
      <div>
        <div class="label">LLM extraction <span id="extractPill" class="pill off">off</span></div>
        <div class="hint" id="extractHint">Optional. Resonance already extracts the cheap, reliable way; a local model can pull implicit facts on top. Off by default on purpose.</div>
      </div>
      <label class="switch"><input type="checkbox" id="extractTog"><span class="slider"></span></label>
    </div>

    <div class="row" id="exportRow" style="margin-top:10px">
      <div>
        <div class="label">Your memories</div>
        <div class="hint">Download a zip of everything stored on this machine, or restore one from another machine. Nothing is sent anywhere.</div>
        <div id="exportToast" class="toast" hidden></div>
        <div id="importToast" class="toast" hidden></div>
        <div id="exportBusy" class="busy-note" hidden>Exporting&hellip; (this can take a minute at large N)</div>
        <div id="importBusy" class="busy-note" hidden>Importing&hellip; (this can take a minute at large N)</div>
      </div>
      <div class="btncol">
        <button id="exportBtn">Export my memories</button>
        <button id="importBtn">Import memories</button>
      </div>
    </div>

    <div class="sec">
      <div class="sechead">
        <button id="graphToggle" class="linkish" aria-expanded="true">Association graph <span id="caret">&#9662;</span></button>
        <button id="demoBtn">Show demo graph</button>
      </div>
      <div id="graphBody">
        <div class="graphwrap">
          <canvas id="cv"></canvas>
          <div class="cap" id="cap">Drag to rotate. Hover a dot to read a memory. Related ideas cluster together in 3D &mdash; thicker lines mean more similar.</div>
        </div>
        <div class="legend">
          <span><span class="dot" style="background:var(--acc)"></span>related (meaning)</span>
          <span><span class="dot" style="background:var(--heb)"></span>reinforced by use</span>
          <span>bigger dot = more connected</span>
          <span id="counts"></span>
        </div>
      </div>
    </div>

    <div class="support">
      <div class="label">Support the Architect</div>
      <div class="why">If this is useful to you, it stays free &mdash; but coffee helps it keep improving.</div>
      <a class="kofi" href="${KOFI}" target="_blank" rel="noopener">&#9749; Ko-fi</a>
      <a href="${PAYPAL}" target="_blank" rel="noopener">PayPal</a>
    </div>

    <div class="foot">
      <div><b>For weaker models</b> that forget to save or recall: <a href="#" id="spBtn">copy a ready-made system prompt</a> and paste it into your app's system-prompt box. <span id="spMsg"></span></div>
      <div style="margin-top:11px"><b>Removing it?</b> Click <b>Disconnect</b> next to each app above, then delete <code>resonance-memory.exe</code> &mdash; that's the whole app. Your memories live at <code id="storePath">&hellip;</code> and stay put unless you delete that file too. SQLite is one <code>.db</code> (facts, access counts, and learned associations). A JSONL pin still has the small <code>.edges.json</code> / <code>.access.json</code> companions beside it (and a leftover <code>.assoc.json</code> if an older build wrote one).</div>
      <div style="margin-top:11px">The field and extraction switches apply instantly &mdash; no restart. This panel closes itself a few seconds after you close the tab.</div>
    </div>
  </div>

  <div id="exportModal" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="exportModalTitle">
    <div class="modal-card">
      <h2 id="exportModalTitle">Export my memories</h2>
      <p>This writes a <b>.zip</b> of <b>YOUR</b> memories &mdash; a machine-readable <code>memories.jsonl</code> plus one file per memory &mdash; to the path below.</p>
      <p>This is <b>read-only</b>: nothing is deleted, nothing is sent anywhere, the live store stays put.</p>
      <p id="exportCount">Counting&hellip;</p>
      <div class="dest" id="exportDest">&hellip;</div>
      <p>Filenames may contain a preview of the memory text.</p>
      <p id="exportModalBusy" class="busy-note" hidden>Exporting&hellip; (this can take a minute at large N)</p>
      <div class="modal-actions">
        <button type="button" id="exportCancel">Cancel</button>
        <button type="button" id="exportConfirm" class="primary">Export</button>
      </div>
    </div>
  </div>

  <div id="importModal" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="importModalTitle">
    <div class="modal-card">
      <h2 id="importModalTitle">Import memories</h2>
      <p>This restores a <b>.zip</b> (or <code>memories.jsonl</code>) into <b>this</b> store. Ids, embeddings, and history survive. Nothing is sent anywhere.</p>
      <p>This <b>writes</b> to the live store. An empty store is restored as-is. A store that already has memories needs <b>Merge</b> (existing kept).</p>
      <p>Pick the file to import:</p>
      <div class="pickrow">
        <input type="text" id="importPath" spellcheck="false" placeholder="path to .zip or memories.jsonl">
        <button type="button" id="importBrowse">Browse</button>
      </div>
      <p id="importPlan">Pick a file to see the plan.</p>
      <label class="check"><input type="checkbox" id="importWithEdges"> Also restore learned associations. Off by default &mdash; a planted sidecar is an injection path, not a missing feature.</label>
      <label class="check" id="importMergeRow" hidden><input type="checkbox" id="importMerge"> Merge with the memories already here (required when this store is not empty). Existing memories are kept.</label>
      <label class="check" id="importReplaceRow" hidden><input type="checkbox" id="importReplaceEdges"> Replace existing learned associations (only with the box above).</label>
      <p id="importModalBusy" class="busy-note" hidden>Importing&hellip; (this can take a minute at large N)</p>
      <div class="modal-actions">
        <button type="button" id="importCancel">Cancel</button>
        <button type="button" id="importConfirm" class="primary" disabled>Import</button>
      </div>
    </div>
  </div>
<script>
  var RM_PANEL_TOKEN = ${JSON.stringify(PANEL_TOKEN)};
  (function(){
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function(url, opts){
      opts = opts || {};
      var h = opts.headers;
      if (h && typeof Headers !== 'undefined' && h instanceof Headers) {
        if (!h.has('X-Resonance-Token')) h.set('X-Resonance-Token', RM_PANEL_TOKEN);
      } else {
        opts.headers = Object.assign({'X-Resonance-Token': RM_PANEL_TOKEN}, h || {});
      }
      return nativeFetch(url, opts);
    };
  })();
  var tog = document.getElementById('tog');
  var extractTog = document.getElementById('extractTog');
  var extractHint = document.getElementById('extractHint');
  var extractPill = document.getElementById('extractPill');
  var demoBtn = document.getElementById('demoBtn');
  var cap = document.getElementById('cap'), counts = document.getElementById('counts');
  var showDemo = false;
  var extractCapable = false;

  function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function renderExtract(s){
    extractCapable = !!s.extract_capable;
    extractTog.disabled = !extractCapable;
    extractTog.checked = !!(s.extract_llm && extractCapable);
    if(extractCapable){
      extractPill.textContent = extractTog.checked ? 'on' : 'available';
      extractPill.className = 'pill ' + (extractTog.checked ? 'on' : 'warn');
      extractHint.textContent = extractTog.checked
        ? 'A capable model will extract implicit facts on save. Failures fall back to the reliable path \u2014 a save never hangs on this.'
        : 'A capable model is available \u2014 enable LLM extraction?';
    } else {
      extractPill.textContent = 'unavailable';
      extractPill.className = 'pill off';
      extractHint.textContent = 'No chat-capable model detected. Load one at the local endpoint, or use an MCP client that supports sampling. Resonance still extracts the cheap, reliable way.';
    }
  }

  var firstRunMemories = null;
  var firstRunConnected = false;
  var SEED_PROMPT = 'Please remember these things about me, then check your memory so I know they stuck:\\n' +
    '- My name is \\u2026\\n' +
    '- I live in \\u2026\\n' +
    '- I prefer \\u2026\\n' +
    '- A rule you should always follow: \\u2026\\n' +
    '- What I\\u2019m working on right now: \\u2026';

  function renderFirstRun(){
    var box = document.getElementById('firstRun');
    var title = document.getElementById('firstRunTitle');
    var hint = document.getElementById('firstRunHint');
    if(!box) return;
    if(firstRunMemories === 0){
      box.hidden = false;
      if(firstRunConnected){
        title.textContent = 'Connected, but nothing saved yet';
        hint.innerHTML = 'You\\u2019re hooked up, and the store is still empty. In your next chat, tell your AI who you are and a rule it should follow, then say <b>remember that</b>. Smaller models sometimes need the nudge. Have a zip from another machine? Use <b>Import memories</b> below.';
      } else {
        title.textContent = 'Nothing saved yet';
        hint.innerHTML = 'Your AI has a memory, but the store is empty. Connect an app above, then in your next chat tell it a few things worth keeping &mdash; who you are, a rule it should follow, the project you&rsquo;re in &mdash; and say <b>remember that</b>. Have a zip from another machine? Use <b>Import memories</b> below.';
      }
    } else {
      box.hidden = true;
    }
  }

  async function loadState(){
    var s = await (await fetch('/api/state')).json();
    tog.checked = s.field;
    renderExtract(s);
    if(s.store){ var sp = document.getElementById('storePath'); if(sp) sp.textContent = s.store; }
    firstRunMemories = typeof s.memories === 'number' ? s.memories : null;
    renderFirstRun();
    loadEmbedder();
  }

  var embedderSel = document.getElementById('embedderSel');
  var embedderPill = document.getElementById('embedderPill');
  function renderEmbedderPill(p){
    if(!p){ embedderPill.textContent = '?'; embedderPill.className = 'pill off'; return; }
    embedderPill.textContent = p.calibrated ? 'tuned' : 'default tuning';
    embedderPill.className = 'pill ' + (p.calibrated ? 'on' : 'warn');
  }
  async function loadEmbedder(){
    try {
      var e = await (await fetch('/api/embedder')).json();
      var avail = e.available || [];
      embedderSel.innerHTML = '';
      e.presets.forEach(function(p){
        var here = avail.some(function(id){ return String(id).toLowerCase().indexOf(p.key) >= 0; });
        var o = document.createElement('option');
        o.value = p.key;
        o.textContent = p.label + ' · ' + p.license
          + (p.calibrated ? '' : ' · pending calibration')
          + (here ? '' : ' · not loaded');
        if(p.key === e.selected) o.selected = true;
        embedderSel.appendChild(o);
      });
      renderEmbedderPill(e.presets.find(function(p){ return p.key === e.selected; }));
    } catch(err){ renderEmbedderPill(null); }
  }
  embedderSel.addEventListener('change', async function(){
    try {
      var r = await (await fetch('/api/embedder', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ embedder: embedderSel.value }) })).json();
      renderEmbedderPill({ calibrated: r.calibrated });
    } catch(err){}
  });

  var seedBtn = document.getElementById('seedBtn'), seedMsg = document.getElementById('seedMsg');
  if(seedBtn){
    seedBtn.addEventListener('click', async function(){
      try {
        await navigator.clipboard.writeText(SEED_PROMPT);
        seedMsg.textContent = 'copied \\u2014 paste it into your next chat';
      } catch(e){
        seedMsg.textContent = 'copy failed \\u2014 select the starter text in README instead';
      }
      setTimeout(function(){ seedMsg.textContent=''; }, 4000);
    });
  }

  var spBtn = document.getElementById('spBtn'), spMsg = document.getElementById('spMsg');
  spBtn.addEventListener('click', async function(ev){
    ev.preventDefault();
    try {
      var t = (await (await fetch('/api/system-prompt')).json()).text || '';
      if(!t){ spMsg.textContent = '(none available)'; return; }
      await navigator.clipboard.writeText(t);
      spMsg.textContent = 'copied to clipboard \\u2713';
    } catch(e){ spMsg.textContent = 'copy failed \\u2014 select the text in system-prompt.md instead'; }
    setTimeout(function(){ spMsg.textContent=''; }, 4000);
  });
  tog.addEventListener('change', async function(){
    await fetch('/api/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ field: tog.checked }) });
    if(!showDemo && !graphCollapsed) loadGraph(true);
  });
  extractTog.addEventListener('change', async function(){
    if(!extractCapable){ extractTog.checked = false; return; }
    var r = await (await fetch('/api/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ extract_llm: extractTog.checked }) })).json();
    renderExtract(r);
  });

  // --- sovereignty export (RM-07 slice 2c). Confirm first; nothing is
  // written until Export. Server writes the zip (a browser cannot pick an
  // arbitrary FS path, and streaming a GB-class zip through the download
  // manager is a footgun at 100k). Not an MCP tool.
  var exportBtn = document.getElementById('exportBtn');
  var exportModal = document.getElementById('exportModal');
  var exportCancel = document.getElementById('exportCancel');
  var exportConfirm = document.getElementById('exportConfirm');
  var exportCount = document.getElementById('exportCount');
  var exportDest = document.getElementById('exportDest');
  var exportToast = document.getElementById('exportToast');
  var exportBusy = document.getElementById('exportBusy');
  var exportModalBusy = document.getElementById('exportModalBusy');
  var exportInFlight = false;
  var exportPreview = null;

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatCount(c){
    c = c || {};
    var total = c.total || 0;
    var cur = c.current || 0;
    var hist = total - cur;
    if(total === 0) return '0 memories';
    if(hist > 0) return total + ' memories (' + cur + ' current, ' + hist + ' history)';
    return total + ' memories';
  }
  function setExportBusy(on){
    exportInFlight = !!on;
    exportBtn.disabled = !!on;
    exportConfirm.disabled = !!on;
    exportCancel.disabled = !!on;
    exportBusy.hidden = !on;
    exportModalBusy.hidden = !on;
    exportBtn.textContent = on ? 'Exporting\\u2026' : 'Export my memories';
  }
  function showToast(filePath){
    exportToast.hidden = false;
    exportToast.innerHTML = 'Saved to <code id="exportSavedPath">' + esc(filePath) +
      '</code> \\u2014 <a href="#" id="exportCopyPath">copy path</a> <span id="exportCopyMsg"></span>';
    var copyBtn = document.getElementById('exportCopyPath');
    var copyMsg = document.getElementById('exportCopyMsg');
    copyBtn.addEventListener('click', async function(ev){
      ev.preventDefault();
      try {
        await navigator.clipboard.writeText(filePath);
        copyMsg.textContent = 'copied to clipboard \\u2713';
      } catch(e){
        copyMsg.textContent = 'copy failed \\u2014 select the path instead';
      }
      setTimeout(function(){ copyMsg.textContent=''; }, 4000);
    });
  }
  function closeExportModal(){
    exportModal.hidden = true;
  }
  exportBtn.addEventListener('click', async function(){
    if(exportInFlight) return;
    exportToast.hidden = true;
    exportCount.textContent = 'Counting\\u2026';
    exportDest.textContent = '\\u2026';
    exportConfirm.disabled = false;
    exportCancel.disabled = false;
    exportModalBusy.hidden = true;
    exportModal.hidden = false;
    try {
      var p = await (await fetch('/api/export')).json();
      exportPreview = p;
      var size = p.estimateLabel && p.estimateLabel !== 'empty' ? ', about ' + p.estimateLabel : '';
      exportCount.textContent = formatCount(p.count) + size + '.';
      exportDest.textContent = p.destPath || '';
    } catch(e){
      exportPreview = null;
      exportCount.textContent = 'Could not read the store. Export will still write an empty bundle.';
      exportDest.textContent = '';
    }
  });
  exportCancel.addEventListener('click', function(){
    if(exportInFlight) return;
    closeExportModal();
  });
  exportModal.addEventListener('click', function(ev){
    if(exportInFlight) return;
    if(ev.target === exportModal) closeExportModal();
  });
  exportConfirm.addEventListener('click', async function(){
    if(exportInFlight) return;
    setExportBusy(true);
    try {
      var r = await (await fetch('/api/export', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })).json();
      if(r && r.ok && r.path){
        closeExportModal();
        showToast(r.path);
      } else if(r && r.code === 'busy'){
        exportCount.textContent = 'An export is already running.';
      } else {
        exportCount.textContent = (r && r.error) ? r.error : 'Export failed.';
      }
    } catch(e){
      exportCount.textContent = 'Export failed. The live store was not changed.';
    }
    setExportBusy(false);
  });

  // --- sovereignty import (RM-17). Confirm first; nothing is written
  // until Import. Shells runImport() — same engine as --import, not a
  // second writer. --with-edges is a checkbox default-off (0009 planted-
  // sidecar refusal). Not an MCP tool.
  var importBtn = document.getElementById('importBtn');
  var importModal = document.getElementById('importModal');
  var importCancel = document.getElementById('importCancel');
  var importConfirm = document.getElementById('importConfirm');
  var importPath = document.getElementById('importPath');
  var importBrowse = document.getElementById('importBrowse');
  var importPlan = document.getElementById('importPlan');
  var importWithEdges = document.getElementById('importWithEdges');
  var importMerge = document.getElementById('importMerge');
  var importReplaceEdges = document.getElementById('importReplaceEdges');
  var importMergeRow = document.getElementById('importMergeRow');
  var importReplaceRow = document.getElementById('importReplaceRow');
  var importToast = document.getElementById('importToast');
  var importBusy = document.getElementById('importBusy');
  var importModalBusy = document.getElementById('importModalBusy');
  var importInFlightUi = false;
  var importDestMeta = null;
  var importPreview = null;

  function setImportBusy(on){
    importInFlightUi = !!on;
    importBtn.disabled = !!on;
    importConfirm.disabled = !!on;
    importCancel.disabled = !!on;
    importBrowse.disabled = !!on;
    importPath.disabled = !!on;
    importBusy.hidden = !on;
    importModalBusy.hidden = !on;
    importBtn.textContent = on ? 'Importing\\u2026' : 'Import memories';
  }
  function showImportToast(msg){
    importToast.hidden = false;
    importToast.textContent = msg;
  }
  function closeImportModal(){
    importModal.hidden = true;
  }
  function formatImportPlan(p){
    if (!p) return 'Pick a file to see the plan.';
    if (p.error && !p.records) return p.error;
    var c = p.records || {};
    var bits = [];
    bits.push((c.total || 0) + ' records in the file (' + (c.current || 0) + ' current).');
    bits.push('Will add ' + (p.willAdd || 0) +
      (p.willSkipId ? ', skip ' + p.willSkipId + ' already here' : '') +
      (p.willRemap ? ', remap ' + p.willRemap + ' colliding ids' : '') + '.');
    if (p.withEdges) bits.push('Associations: restore ' + (p.edgesWillRestore || 0) + ' of ' + (p.edgesInSource || 0) + '.');
    else bits.push('Associations: not restoring (box above is off on purpose).');
    (p.warnings || []).forEach(function(w){ bits.push('Warning: ' + w); });
    (p.errors || []).forEach(function(e){
      // Speak the panel's language, not the CLI's: the non-empty-dest guard
      // points at the checkbox below, not at a --merge flag.
      if (e && e.code === 'IMPORT_DEST_NONEMPTY') {
        bits.push('This store already has memories \\u2014 tick \\u201cMerge\\u201d below to add these to them (nothing existing is removed).');
      } else {
        bits.push('Cannot import: ' + (e.message || e.code || e));
      }
    });
    return bits.join(' ');
  }
  function importFlags(){
    return {
      source: (importPath.value || '').trim(),
      apply: false,
      withEdges: !!(importWithEdges && importWithEdges.checked),
      merge: !!(importMerge && importMerge.checked),
      replaceEdges: !!(importReplaceEdges && importReplaceEdges.checked)
    };
  }
  function refreshImportChecks(){
    var destCount = importDestMeta && importDestMeta.destCount || 0;
    var destEdges = importDestMeta && importDestMeta.destEdges || 0;
    importMergeRow.hidden = destCount <= 0;
    // Merge is an explicit opt-in, NOT a default (product call 2026-09-07):
    // blending an imported set into a store that already has memories is the
    // one destructive-feeling path, so it asks first — the checkbox starts
    // unchecked and the dry-run's IMPORT_DEST_NONEMPTY error keeps Import
    // disabled until the user ticks it. This mirrors the CLI, which refuses
    // without --merge. The safe common case (empty store) never shows the row.
    importReplaceRow.hidden = !(importWithEdges && importWithEdges.checked && destEdges > 0);
  }
  async function loadImportPlan(){
    var flags = importFlags();
    importConfirm.disabled = true;
    importPreview = null;
    if (!flags.source){
      importPlan.textContent = 'Pick a file to see the plan.';
      return;
    }
    importPlan.textContent = 'Reading\\u2026';
    try {
      var r = await (await fetch('/api/import', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(flags)
      })).json();
      importPreview = r;
      importPlan.textContent = formatImportPlan(r);
      var errs = (r && r.errors) || [];
      importConfirm.disabled = !!(r && r.error && !r.records) || errs.length > 0 || importInFlightUi;
    } catch(e){
      importPlan.textContent = 'Could not read that file.';
      importConfirm.disabled = true;
    }
  }
  importBtn.addEventListener('click', async function(){
    if (importInFlightUi) return;
    importToast.hidden = true;
    importPath.value = '';
    importWithEdges.checked = false;
    importMerge.checked = false;
    delete importMerge.dataset.touched;
    importReplaceEdges.checked = false;
    importConfirm.disabled = true;
    importCancel.disabled = false;
    importModalBusy.hidden = true;
    importPlan.textContent = 'Pick a file to see the plan.';
    importModal.hidden = false;
    try {
      importDestMeta = await (await fetch('/api/import')).json();
      refreshImportChecks();
      if (importDestMeta && importDestMeta.suggestedSource){
        importPath.value = importDestMeta.suggestedSource;
        await loadImportPlan();
      }
    } catch(e){
      importDestMeta = null;
    }
  });
  importCancel.addEventListener('click', function(){
    if (importInFlightUi) return;
    closeImportModal();
  });
  importModal.addEventListener('click', function(ev){
    if (importInFlightUi) return;
    if (ev.target === importModal) closeImportModal();
  });
  importBrowse.addEventListener('click', async function(){
    if (importInFlightUi) return;
    try {
      var r = await (await fetch('/api/import/pick', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'
      })).json();
      if (r && r.ok && r.path){
        importPath.value = r.path;
        await loadImportPlan();
      } else if (r && r.code === 'no_dialog'){
        importPlan.textContent = 'Paste the path to the zip (file dialog is off).';
      }
    } catch(e){
      importPlan.textContent = 'Could not open a file dialog. Paste the path instead.';
    }
  });
  importPath.addEventListener('change', function(){ loadImportPlan(); });
  importWithEdges.addEventListener('change', function(){
    refreshImportChecks();
    loadImportPlan();
  });
  importMerge.addEventListener('change', function(){
    importMerge.dataset.touched = '1';
    loadImportPlan();
  });
  importReplaceEdges.addEventListener('change', function(){ loadImportPlan(); });
  importConfirm.addEventListener('click', async function(){
    if (importInFlightUi) return;
    var flags = importFlags();
    if (!flags.source) return;
    flags.apply = true;
    setImportBusy(true);
    try {
      var r = await (await fetch('/api/import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(flags)
      })).json();
      if (r && r.ok && r.apply){
        closeImportModal();
        showImportToast('Imported ' + (r.added || 0) + ' memories into this store.');
        loadState();
        if (!showDemo && !graphCollapsed) loadGraph(true);
      } else if (r && r.code === 'busy'){
        importPlan.textContent = 'An export or import is already running.';
      } else {
        importPlan.textContent = formatImportPlan(r) || ((r && r.error) ? r.error : 'Import failed.');
      }
    } catch(e){
      importPlan.textContent = 'Import failed. Check the path and try again.';
    }
    setImportBusy(false);
  });

  async function loadClients(){
    var list = await (await fetch('/api/clients')).json();
    var el = document.getElementById('clients');
    el.innerHTML = '<div class="ctitle" style="margin-bottom:10px">Connect to your AI app</div>' + list.map(function(c){
      var status = c.installed ? '<span class="pill on">connected</span>'
        : (c.present ? '<span class="pill off">not connected</span>' : '<span class="pill off">not found</span>');
      var btn = c.installed ? '<button data-id="'+c.id+'" data-act="disconnect">Disconnect</button>'
        : (c.present ? '<button class="primary" data-id="'+c.id+'" data-act="connect">Connect</button>' : '');
      return '<div class="client"><div><div class="cname">'+c.name+'</div>'+status+'</div>'+btn+'</div>';
    }).join('') + '<div class="hint" style="margin-bottom:4px">After connecting, restart that app once so it loads your memory.</div>';
    firstRunConnected = list.some(function(c){ return c.installed; });
    renderFirstRun();
    el.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', async function(){
        b.disabled = true; b.textContent = '\\u2026';
        var act = b.dataset.act === 'connect' ? 'connect' : 'disconnect';
        await fetch('/api/'+act, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: b.dataset.id }) });
        loadClients();
      });
    });
  }

  demoBtn.addEventListener('click', function(){
    showDemo = !showDemo;
    demoBtn.textContent = showDemo ? 'Show my memories' : 'Show demo graph';
    demoBtn.className = showDemo ? 'primary' : '';
    loadGraph(true);
  });

  // --- collapsible graph section (remembers your choice) ---
  var graphToggle = document.getElementById('graphToggle');
  var graphBody = document.getElementById('graphBody');
  var caret = document.getElementById('caret');
  var graphCollapsed = localStorage.getItem('rm_graph_collapsed') === '1';
  function applyGraphCollapsed(){
    graphBody.style.display = graphCollapsed ? 'none' : '';
    demoBtn.style.display = graphCollapsed ? 'none' : '';
    caret.innerHTML = graphCollapsed ? '&#9656;' : '&#9662;'; // right when hidden, down when shown
    graphToggle.setAttribute('aria-expanded', String(!graphCollapsed));
    if(!graphCollapsed) loadGraph(true);
    else if(raf){ cancelAnimationFrame(raf); raf=null; }   // stop animating while hidden
  }
  graphToggle.addEventListener('click', function(){
    graphCollapsed = !graphCollapsed;
    localStorage.setItem('rm_graph_collapsed', graphCollapsed ? '1' : '0');
    applyGraphCollapsed();
  });

  // --- meaning engine (embedding model) setup ---
  var enginePill = document.getElementById('enginePill');
  var engineHint = document.getElementById('engineHint');
  var engineBtn = document.getElementById('engineBtn');
  var engineBusy = false;

  function renderEngine(s){
    if(engineBusy) return;
    if(s.state === 'ready'){
      enginePill.className = 'pill on'; enginePill.textContent = 'ready';
      engineHint.textContent = 'Recall matches by meaning. You\\u2019re all set.';
      engineBtn.style.display = 'none';
    } else if(s.state === 'needs-setup'){
      enginePill.className = 'pill warn'; enginePill.textContent = 'not set up';
      engineHint.innerHTML = 'Recall is matching on exact words only. One click downloads &amp; loads the embedding model in LM Studio.';
      engineBtn.style.display = ''; engineBtn.className = 'primary'; engineBtn.textContent = 'Set up'; engineBtn.disabled = false;
    } else {
      enginePill.className = 'pill off'; enginePill.textContent = 'LM Studio needed';
      engineHint.innerHTML = 'Install <a href="https://lmstudio.ai" target="_blank" rel="noopener">LM Studio</a> (free), then reopen this page to finish setup in one click.';
      engineBtn.style.display = 'none';
    }
  }
  async function loadEngine(){
    if(engineBusy) return;
    try { renderEngine(await (await fetch('/api/engine')).json()); } catch(e){}
  }
  engineBtn.addEventListener('click', async function(){
    engineBusy = true; engineBtn.disabled = true; engineBtn.textContent = 'Setting up\\u2026';
    enginePill.className = 'pill warn'; enginePill.textContent = 'working';
    engineHint.textContent = 'Downloading and loading the model. The first time this can take a minute or two\\u2026';
    var r; try { r = await (await fetch('/api/engine/setup', { method:'POST' })).json(); } catch(e){ r = { ok:false }; }
    engineBusy = false;
    if(r && r.ok){ renderEngine({ state:'ready' }); if(!graphCollapsed) loadGraph(); }
    else {
      renderEngine({ state:'needs-setup' });
      engineHint.textContent = (r && r.message) ? r.message : 'Setup didn\\u2019t complete. Make sure LM Studio is installed, then try again.';
    }
  });

  // --- graph rendering (3D force-directed layout) -------------------------
  // Memories are placed in 3D by association: every semantic/Hebbian link is a
  // spring whose rest length shrinks as similarity rises, so strongly-related
  // notes collapse together while unrelated ones drift apart - reachable only
  // through the memories that bridge them. Positions persist across polls, so
  // the cloud only re-settles ("bounces") when a memory is added or removed.
  var cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  var G = { nodes: [], edges: [] }, hover = -1, raf = null, W = 0, H = 0, lastKey = '';
  var alpha = 0;                       // simulation heat: >0 settling, 0 at rest
  var yaw = 0.6, pitch = -0.32;        // camera angles
  var autoRotate = true, dragging = false, lastX = 0, lastY = 0;
  var saved = {};                      // id -> {x,y,z}, preserved across reloads

  // physics constants (world units)
  var REP = 60, L0 = 20, SPRING = 0.03, CENTER = 0.004, DAMP = 0.85, MAXV = 8;

  function fit(){ var r = cv.getBoundingClientRect(); W = cv.width = r.width * devicePixelRatio; H = cv.height = r.height * devicePixelRatio; }
  window.addEventListener('resize', fit);

  function color(i){ var h = (i * 47) % 360; return 'hsl('+h+' 55% 55%)'; }

  // connected components -> cluster color; edge endpoints -> indices; degree -> mass
  function analyze(nodes, edges){
    var idx = {}; nodes.forEach(function(n,i){ idx[n.id]=i; n.c=-1; n.deg=0; });
    edges.forEach(function(e){ e.ai=idx[e.a]; e.bi=idx[e.b];
      if(nodes[e.ai]){ nodes[e.ai].deg += 0.5 + e.w; }
      if(nodes[e.bi]){ nodes[e.bi].deg += 0.5 + e.w; } });
    var comp = 0;
    nodes.forEach(function(n){ if(n.c>=0) return; var stack=[n]; n.c=comp;
      while(stack.length){ var x=stack.pop();
        edges.forEach(function(e){ var o=null; if(e.a===x.id)o=nodes[idx[e.b]]; else if(e.b===x.id)o=nodes[idx[e.a]];
          if(o && o.c<0){ o.c=comp; stack.push(o); } });
      } comp++; });
  }

  async function loadGraph(force){
    var g = await (await fetch('/api/graph?demo=' + (showDemo?1:0))).json();
    var stale = g.nodes.length - (g.current_count != null ? g.current_count : g.nodes.length);
    counts.textContent = g.nodes.length + ' memories, ' + g.edges.length + ' links'
      + (stale > 0 ? ', ' + stale + ' superseded' : '');
    // Re-settle only when the SET of memories changes. Edge-only churn (Hebbian
    // reinforcement nudging weights) refreshes the springs in place - no bounce.
    var key = g.nodes.map(function(n){ return n.id; }).sort().join(',');
    if(!force && key === lastKey){ analyze(G.nodes, g.edges); G.edges = g.edges; return; }
    lastKey = key;
    if(!g.nodes.length){
      cap.innerHTML = showDemo ? 'Demo unavailable.' : 'No memories yet. Click <b>Show demo graph</b> to see what this looks like in action.';
      G = { nodes: [], edges: [] }; alpha = 0; if(raf){ cancelAnimationFrame(raf); raf=null; } draw(); return;
    }
    cap.innerHTML = showDemo
      ? 'A <b>demo</b> cloud in 3D. Related memories pull together; unrelated ones drift apart, reachable only through what bridges them. <b>Drag to rotate.</b>'
      : 'Your memories in 3D - related ones cluster together. <b>Drag to rotate</b>, hover a dot to read it.';
    fit();
    // Keep where existing nodes already settled; only brand-new ones get a fresh
    // spot near the origin, so an add is a gentle local settle, not a re-scatter.
    g.nodes.forEach(function(n){
      var p = saved[n.id];
      if(p){ n.x=p.x; n.y=p.y; n.z=p.z; }
      else { n.x=(Math.random()-0.5)*24; n.y=(Math.random()-0.5)*24; n.z=(Math.random()-0.5)*24; }
      n.vx=0; n.vy=0; n.vz=0;
    });
    analyze(g.nodes, g.edges);
    G = g; alpha = 1;                    // reheat: the only place a bounce begins
    if(!raf) raf = requestAnimationFrame(frame);
  }

  function simulate(){
    var n = G.nodes, e = G.edges, i, j;
    // repulsion: every memory pushes every other apart (inverse-square, 3D)
    for(i=0;i<n.length;i++){
      var a = n[i];
      for(j=i+1;j<n.length;j++){
        var b = n[j];
        var dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
        var d2=dx*dx+dy*dy+dz*dz+0.1, d=Math.sqrt(d2);
        var rep=REP/d2, ux=dx/d, uy=dy/d, uz=dz/d;
        a.vx-=ux*rep; a.vy-=uy*rep; a.vz-=uz*rep;
        b.vx+=ux*rep; b.vy+=uy*rep; b.vz+=uz*rep;
      }
    }
    // springs: each association pulls to a rest length that shrinks with
    // similarity (and shrinks further where use has reinforced the link)
    e.forEach(function(ed){
      var a=n[ed.ai], b=n[ed.bi]; if(!a||!b) return;
      var dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
      var d=Math.sqrt(dx*dx+dy*dy+dz*dz)+0.01;
      var rest=L0*(1.5-Math.min(ed.w,1)); if(ed.hebbian>0){ rest*=(1-Math.min(ed.hebbian,0.4)); }
      var f=(d-rest)*SPRING*(0.4+ed.w), ux=dx/d, uy=dy/d, uz=dz/d;
      a.vx+=ux*f; a.vy+=uy*f; a.vz+=uz*f;
      b.vx-=ux*f; b.vy-=uy*f; b.vz-=uz*f;
    });
    // integrate: pull gently to center, damp, clamp; heavier (more-connected)
    // nodes carry more mass, so hubs sit steady while leaves swing into place
    for(i=0;i<n.length;i++){
      var p=n[i], mass=0.6+0.5*Math.min(p.deg,6);
      p.vx-=p.x*CENTER; p.vy-=p.y*CENTER; p.vz-=p.z*CENTER;
      p.vx*=DAMP; p.vy*=DAMP; p.vz*=DAMP;
      var sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy+p.vz*p.vz);
      if(sp>MAXV){ var s=MAXV/sp; p.vx*=s; p.vy*=s; p.vz*=s; }
      p.x+=p.vx/mass; p.y+=p.vy/mass; p.z+=p.vz/mass;
      saved[p.id]={ x:p.x, y:p.y, z:p.z };
    }
  }

  // rotate by the camera angles, then perspective-project to the canvas
  function project(nx,ny,nz,D,scale){
    var cy=Math.cos(yaw), sy=Math.sin(yaw), cx=Math.cos(pitch), sx=Math.sin(pitch);
    var x1=nx*cy - nz*sy, z1=nx*sy + nz*cy;
    var y1=ny*cx - z1*sx, z2=ny*sx + z1*cx;
    var denom=D-z2, lo=D*0.2; if(denom<lo){ denom=lo; }
    var k=D/denom;
    return { x:W/2 + x1*k*scale, y:H/2 + y1*k*scale, depth:z2, k:k };
  }

  function kick(){ if(!raf){ raf = requestAnimationFrame(frame); } }  // wake the loop
  function frame(){
    var settling = alpha > 0.01;
    if(settling){ simulate(); alpha *= 0.96; }        // cools to rest; no perpetual jitter
    var spinning = autoRotate && !dragging && hover<0;
    if(spinning){ yaw += 0.0024; }                    // gentle spin sells the 3D
    draw();
    // Keep animating only while there's motion; otherwise idle to zero CPU and
    // let a hover/drag/reheat wake us via kick(). A settled, still cloud costs nothing.
    raf = (settling || spinning || dragging) ? requestAnimationFrame(frame) : null;
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    var n=G.nodes, e=G.edges, i;
    if(!n.length){ return; }
    // auto-fit: scale the cloud to the canvas from its own bounding radius
    var R=1; for(i=0;i<n.length;i++){ var rr=Math.sqrt(n[i].x*n[i].x+n[i].y*n[i].y+n[i].z*n[i].z); if(rr>R){ R=rr; } }
    var scale=0.42*Math.min(W,H)/R, D=R*2.6;
    for(i=0;i<n.length;i++){ var pr=project(n[i].x,n[i].y,n[i].z,D,scale); n[i].sx=pr.x; n[i].sy=pr.y; n[i].sz=pr.depth; n[i].sk=pr.k; }
    var heb=css('--heb'), acc=css('--acc');
    e.forEach(function(ed){
      var a=n[ed.ai], b=n[ed.bi]; if(!a||!b) return;
      var lit = hover>=0 && (ed.ai===hover||ed.bi===hover);
      ctx.strokeStyle = ed.hebbian>0 ? heb : acc;
      ctx.globalAlpha = lit ? 0.95 : (hover>=0 ? 0.05 : 0.26);
      ctx.lineWidth = (0.5 + Math.max(0,(ed.w-0.5))*5 + (ed.hebbian>0?1:0)) * devicePixelRatio * (a.sk+b.sk)/2;
      ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke();
    });
    ctx.globalAlpha=1;
    // paint far-to-near so nearer memories sit on top
    var order=[]; for(i=0;i<n.length;i++){ order.push(i); }
    order.sort(function(p,q){ return n[p].sz - n[q].sz; });
    order.forEach(function(i){
      var nd=n[i];
      var base=3 + Math.min(nd.deg,6)*0.6;      // more-connected memories draw larger
      var r=(hover===i?base+2:base)*devicePixelRatio*nd.sk; if(r<0.5){ r=0.5; }
      var stale = nd.current === false;         // superseded: still there, visibly past
      ctx.beginPath(); ctx.arc(nd.sx,nd.sy,r,0,7); ctx.fillStyle=color(nd.c);
      var a=(hover>=0 && hover!==i && !isNeighbor(i)) ? 0.28 : 1;
      ctx.globalAlpha = stale ? a*0.3 : a; ctx.fill();
      ctx.globalAlpha = stale ? 0.4 : 1; ctx.lineWidth=1.2*devicePixelRatio;
      ctx.strokeStyle = stale ? 'rgba(150,150,150,.6)' : 'rgba(255,255,255,.7)'; ctx.stroke();
    });
  }
  function isNeighbor(i){ return G.edges.some(function(e){ return (e.ai===hover&&e.bi===i)||(e.bi===hover&&e.ai===i); }); }

  // hover to read a memory (uses the last projected screen positions)
  cv.addEventListener('mousemove', function(ev){
    if(dragging) return;
    var r = cv.getBoundingClientRect();
    var mx=(ev.clientX-r.left)*devicePixelRatio, my=(ev.clientY-r.top)*devicePixelRatio;
    var best=-1, bd=1e9;
    G.nodes.forEach(function(nd,i){ if(nd.sx==null) return; var d=(nd.sx-mx)*(nd.sx-mx)+(nd.sy-my)*(nd.sy-my); if(d<bd){ bd=d; best=i; } });
    var thr=15*devicePixelRatio, nh=(bd<thr*thr)?best:-1;
    if(nh!==hover){ hover=nh; kick();
      if(hover>=0){
        var hn = G.nodes[hover];
        cap.innerHTML = '<b>&#8220;</b>' + hn.text.replace(/</g,'&lt;') + '<b>&#8221;</b>'
          + (hn.current === false ? ' <span style="opacity:.7">&mdash; no longer current</span>' : '');
      }
      else { cap.innerHTML = 'Drag to rotate. Hover a dot to read the memory.'; }
    }
  });
  cv.addEventListener('mouseleave', function(){ hover=-1; kick(); });

  // drag to rotate (mouse + touch); taking control ends the gentle auto-spin
  function startDrag(x,y){ dragging=true; autoRotate=false; lastX=x; lastY=y; kick(); }
  function moveDrag(x,y){ if(!dragging) return; yaw += (x-lastX)*0.01; pitch += (y-lastY)*0.01; pitch=Math.max(-1.45,Math.min(1.45,pitch)); lastX=x; lastY=y; kick(); }
  cv.addEventListener('mousedown', function(ev){ startDrag(ev.clientX, ev.clientY); });
  window.addEventListener('mousemove', function(ev){ moveDrag(ev.clientX, ev.clientY); });
  window.addEventListener('mouseup', function(){ dragging=false; });
  cv.addEventListener('touchstart', function(ev){ if(ev.touches[0]){ startDrag(ev.touches[0].clientX, ev.touches[0].clientY); } }, { passive:true });
  cv.addEventListener('touchmove', function(ev){ if(ev.touches[0]){ moveDrag(ev.touches[0].clientX, ev.touches[0].clientY); ev.preventDefault(); } }, { passive:false });
  window.addEventListener('touchend', function(){ dragging=false; });

  // --- heartbeat: keep the (hidden) process alive only while a tab is open ---
  function ping(){ fetch('/api/ping', { method:'POST' }).catch(function(){}); }
  setInterval(ping, 4000); ping();

  loadState(); loadClients(); loadEngine(); applyGraphCollapsed();
  setInterval(function(){ loadState(); loadEngine(); if(!showDemo && !graphCollapsed) loadGraph(); }, 8000);
</script>
</body></html>`;

// --- heartbeat shutdown: exit ~12s after the last tab stops pinging ---
// Export of a 50k store is a 30–60s zip on one thread. If we keep the
// 12s idle timer armed, unanswered /api/ping → process.exit(0) → truncated
// .zip.tmp on the Desktop. Pause for the duration; re-arm when done/failed.
// Tests may shorten RESONANCE_MEMORY_WATCHDOG_MS so the pause is provable
// without a 15s sleep.
const WATCHDOG_MS = Math.max(200, Number(process.env.RESONANCE_MEMORY_WATCHDOG_MS || 12000) || 12000);
const WATCHDOG_CHECK_MS = Math.min(3000, Math.max(50, Math.floor(WATCHDOG_MS / 4)));
let lastPing = Date.now();
let connectedOnce = false;
let watchdogPaused = false;
let exportInFlight = false;
let importInFlight = false;

function pauseWatchdog() { watchdogPaused = true; }
function resumeWatchdog() {
  watchdogPaused = false;
  lastPing = Date.now();
}
function watchdogShouldExit(now) {
  if (watchdogPaused) return false;
  return connectedOnce && ((now || Date.now()) - lastPing > WATCHDOG_MS);
}
setInterval(() => {
  if (watchdogShouldExit()) process.exit(0);
}, WATCHDOG_CHECK_MS);

const YIELD_EVERY = Math.max(1, Number(process.env.RM_PANEL_YIELD_EVERY || 32) || 32);

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitForTestHold() {
  // Test hook (same family as RM_EXPORT_CRASH_AFTER): if set to a path,
  // sit here — in-flight + watchdog already paused — until that file
  // exists. Lets tests prove 409-on-double-POST and "no pings for >12s
  // does not kill the process" without a 50k zip. Import uses the
  // sibling RM_PANEL_IMPORT_HOLD so the two cannot starve each other.
  const p = importInFlight
    ? process.env.RM_PANEL_IMPORT_HOLD
    : process.env.RM_PANEL_EXPORT_HOLD;
  if (!p) return;
  await new Promise((resolve) => {
    const t = setInterval(() => {
      try {
        if (fs.existsSync(p)) { clearInterval(t); resolve(); }
      } catch { /* */ }
    }, 25);
  });
}

function suggestImportSource() {
  const dir = exp.defaultOutDir(STORE_PATH);
  try {
    const names = fs.readdirSync(dir);
    let best = null, bestM = 0;
    for (const n of names) {
      if (!/^resonance-memories.*\.zip$/i.test(n)) continue;
      const p = path.join(dir, n);
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) continue;
        if (st.mtimeMs >= bestM) { bestM = st.mtimeMs; best = p; }
      } catch { /* */ }
    }
    return best;
  } catch { return null; }
}

function pickImportFile() {
  return new Promise((resolve) => {
    // Tests set NO_OPEN so a dialog cannot steal focus / hang the suite.
    if (process.env.RESONANCE_MEMORY_NO_OPEN === "1") {
      resolve({ ok: false, code: "no_dialog", error: "file dialog disabled" });
      return;
    }
    const desktop = exp.defaultOutDir(STORE_PATH);
    if (process.platform === "win32") {
      const initial = String(desktop).replace(/'/g, "''");
      const script =
        "Add-Type -AssemblyName System.Windows.Forms; " +
        "$d = New-Object System.Windows.Forms.OpenFileDialog; " +
        "$d.Filter = 'Memory export (*.zip;*.jsonl)|*.zip;*.jsonl|All files (*.*)|*.*'; " +
        "$d.Title = 'Import memories'; " +
        "$d.InitialDirectory = '" + initial + "'; " +
        "if ($d.ShowDialog() -eq 'OK') { [Console]::Out.Write($d.FileName) }";
      execFile("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
        timeout: 300000, windowsHide: true, maxBuffer: 1024 * 1024,
      }, (err, stdout) => {
        const p = String(stdout || "").trim();
        if (p) resolve({ ok: true, path: p });
        else resolve({
          ok: false,
          code: err ? "failed" : "cancelled",
          error: err ? String(err && err.message || err) : "cancelled",
        });
      });
      return;
    }
    if (process.platform === "darwin") {
      execFile("osascript", ["-e", 'POSIX path of (choose file with prompt "Import memories")'], {
        timeout: 300000,
      }, (err, stdout) => {
        const p = String(stdout || "").trim();
        if (p) resolve({ ok: true, path: p });
        else resolve({ ok: false, code: "cancelled", error: "cancelled" });
      });
      return;
    }
    execFile("zenity", ["--file-selection", "--title=Import memories", "--file-filter=*.zip *.jsonl"], {
      timeout: 300000,
    }, (err, stdout) => {
      const p = String(stdout || "").trim();
      if (p) resolve({ ok: true, path: p });
      else resolve({ ok: false, code: "cancelled", error: "cancelled" });
    });
  });
}

function revealExportedFile(filePath) {
  // Courtesy only. RESONANCE_MEMORY_NO_OPEN already means "don't pop OS
  // windows" (panel listen); tests set it so explorer does not steal focus.
  if (process.env.RESONANCE_MEMORY_NO_OPEN === "1") return;
  if (!filePath) return;
  try {
    if (process.platform === "win32") {
      execFile("explorer", ["/select," + filePath], () => { });
    } else if (process.platform === "darwin") {
      execFile("open", ["-R", filePath], () => { });
    } else {
      execFile("xdg-open", [path.dirname(filePath)], () => { });
    }
  } catch { /* reveal is a courtesy; the zip is already on disk */ }
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function body(req, cb) { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => cb(b)); }

function parseHostHeader(hostHeader) {
  const raw = String(hostHeader || "").trim();
  if (!raw) return { host: "", port: "" };
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return {
      host: end >= 0 ? raw.slice(1, end) : raw,
      port: end >= 0 && raw[end + 1] === ":" ? raw.slice(end + 2) : "",
    };
  }
  const i = raw.lastIndexOf(":");
  if (i >= 0 && raw.indexOf(":") === i) {
    return { host: raw.slice(0, i), port: raw.slice(i + 1) };
  }
  return { host: raw, port: "" };
}

function panelOrigins() {
  const p = String(PORT);
  return new Set([
    "http://127.0.0.1:" + p,
    "http://localhost:" + p,
    "http://[::1]:" + p,
  ]);
}

function originAllowed(originHeader) {
  if (originHeader == null || originHeader === "") return null;
  const origin = String(originHeader).trim();
  if (!origin || origin.toLowerCase() === "null") return false;
  return panelOrigins().has(origin);
}

function hostAllowed(hostHeader) {
  const parsed = parseHostHeader(hostHeader);
  if (!LOOPBACK_HOSTS.has(String(parsed.host).toLowerCase())) return false;
  if (parsed.port && String(parsed.port) !== String(PORT)) return false;
  return true;
}

function tokenAllowed(req) {
  const sent = req.headers["x-resonance-token"];
  return !!sent && sent === PANEL_TOKEN;
}

function isMutating(method) {
  const m = String(method || "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD";
}

/*
 * W-02 ship-gate. Three cheap checks, in order:
 *   1. Host is loopback (DNS rebinding arrives as Host: evil.example).
 *   2. If Origin is present, it is this panel (CSRF from a web page).
 *   3. Mutating methods need the per-process token (forms cannot set it).
 * Residual: a local process that GETs the page can steal the token and
 * drive the API — same class as binding 127.0.0.1 at all. No CORS.
 */
function allowPanelRequest(req, res) {
  if (!hostAllowed(req.headers.host)) {
    json(res, 403, {
      ok: false, code: "forbidden_host",
      error: "panel binds 127.0.0.1 only",
    });
    return false;
  }
  const origin = originAllowed(req.headers.origin);
  if (origin === false) {
    json(res, 403, {
      ok: false, code: "forbidden_origin",
      error: "cross-origin panel requests are refused",
    });
    return false;
  }
  if (isMutating(req.method) && !tokenAllowed(req)) {
    json(res, 403, {
      ok: false, code: "forbidden_csrf",
      error: "missing or invalid panel token",
    });
    return false;
  }
  return true;
}

const server = http.createServer((req, res) => {
  if (!allowPanelRequest(req, res)) return;
  const url = req.url || "/";
  if (req.method === "GET" && (url === "/" || url.startsWith("/?"))) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(PAGE); return;
  }
  if (req.method === "POST" && url === "/api/ping") {
    lastPing = Date.now(); connectedOnce = true;
    res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); return;
  }
  if (req.method === "GET" && url === "/api/state") {
    extract.probeChatCapability({ modelsUrl: extract.modelsUrl(EMBED_URL) }).then(async (probe) => {
      const memories = await memCount();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        field: fieldOn(),
        extract_llm: extractOn(),
        extract_capable: probe.capable,
        extract_model: probe.model,
        memories,
        store: STORE_PATH,
      }));
    }).catch(async () => {
      const memories = await memCount();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        field: fieldOn(), extract_llm: extractOn(), extract_capable: false,
        extract_model: null, memories, store: STORE_PATH,
      }));
    });
    return;
  }
  if (req.method === "GET" && url === "/api/system-prompt") {
    let raw = "";
    try { raw = fs.readFileSync(path.join(baseDir(), "system-prompt.md"), "utf8"); } catch { raw = EMBEDDED.systemPrompt || ""; }
    const text = pickPromptBlock(raw); // paste-ready block only, never the surrounding doc
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ text })); return;
  }
  if (req.method === "GET" && url === "/api/embedder") {
    const c = readConfig();
    const envModel = process.env.EMBED_MODEL || "";
    const auto = matchPreset(envModel);
    const selected = c.embedder || (auto && auto.key) || "nomic-embed-text";
    const respond = (available) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ presets: EMBEDDER_PRESETS, selected, available, embed_model: envModel }));
    };
    Promise.resolve()
      .then(() => fetch(extract.modelsUrl(EMBED_URL)))
      .then((r) => r.json())
      .then((j) => respond(((j && j.data) || []).map((m) => m.id)))
      .catch(() => respond([]));
    return;
  }
  if (req.method === "POST" && url === "/api/embedder") {
    body(req, (b) => {
      let parsed = {};
      try { parsed = JSON.parse(b) || {}; } catch { parsed = {}; }
      const preset = EMBEDDER_PRESETS.find((p) => p.key === parsed.embedder);
      const c = readConfig();
      if (preset) {
        c.embedder = preset.key;
        // dedup_hi / dedup_lo are read live by the server today; write them now.
        c.dedup_hi = preset.tuning.dedup_hi;
        c.dedup_lo = preset.tuning.dedup_lo;
        // field_minsim is read live by the server (readFieldMinSim). Also
        // stamp the top-level key so a config without embedder_tuning still
        // picks up the preset gate.
        c.embedder_tuning = preset.tuning;
        c.field_minsim = preset.tuning.field_minsim;
        c.constraint_gate = preset.tuning.constraint_gate;
        writeConfig(c);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: !!preset,
        selected: preset ? preset.key : (c.embedder || null),
        applied: preset ? preset.tuning : null,
        calibrated: preset ? preset.calibrated : false,
      }));
    });
    return;
  }
  if (req.method === "GET" && url.startsWith("/api/graph")) {
    const demo = /[?&]demo=1/.test(url);
    Promise.resolve().then(() => graphData(demo)).then((data) => {
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(data));
    }).catch(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ nodes: [], edges: [], source: demo ? "demo" : "your memories" }));
    });
    return;
  }
  if (req.method === "POST" && url === "/api/toggle") {
    body(req, (b) => {
      let parsed = {};
      try { parsed = JSON.parse(b) || {}; } catch { parsed = {}; }
      const c = readConfig();
      const hasField = Object.prototype.hasOwnProperty.call(parsed, "field");
      const hasExtract = Object.prototype.hasOwnProperty.call(parsed, "extract_llm");
      if (hasField) c.field = typeof parsed.field === "boolean" ? parsed.field : !fieldOn();
      else if (!hasExtract) c.field = !fieldOn();
      const finish = (probe) => {
        if (hasExtract) {
          const want = !!parsed.extract_llm;
          c.extract_llm = want && !!(probe && probe.capable);
        }
        writeConfig(c);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          field: typeof c.field === "boolean" ? c.field : fieldOn(),
          extract_llm: !!c.extract_llm,
          extract_capable: !!(probe && probe.capable),
          extract_model: probe && probe.model || null,
        }));
      };
      if (hasExtract) {
        extract.probeChatCapability({ modelsUrl: extract.modelsUrl(EMBED_URL) })
          .then(finish)
          .catch(() => finish({ capable: false, model: null }));
      } else {
        finish({ capable: false, model: null });
      }
    }); return;
  }
  if (req.method === "GET" && url === "/api/clients") {
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(install.detect())); return;
  }
  if (req.method === "GET" && url === "/api/engine") {
    engine.status().then((s) => {
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(s));
    }).catch(() => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ state: "no-lmstudio" })); });
    return;
  }
  if (req.method === "POST" && url === "/api/engine/setup") {
    engine.setup().then((r) => {
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(r));
    }).catch((e) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, state: "needs-setup", message: String(e && e.message || e) })); });
    return;
  }
  if (req.method === "POST" && (url === "/api/connect" || url === "/api/disconnect")) {
    body(req, (b) => {
      let id; try { id = JSON.parse(b).id; } catch { }
      const r = url === "/api/connect" ? install.install(id) : install.uninstall(id);
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(r));
    }); return;
  }
  // RM-07 slice 2c: panel export. GET = confirm-modal preview (read-only).
  // POST = write the zip via the 2b engine. Never demo-seed.jsonl. Not an
  // MCP tool — a model that can dump the store is an exfil path.
  if (req.method === "GET" && url === "/api/export") {
    exp.previewExport(STORE_PATH).then((p) => {
      json(res, 200, Object.assign({
        busy: exportInFlight,
        watchdog_paused: watchdogPaused,
        demo: false,
      }, p));
    }).catch((e) => {
      json(res, 200, {
        busy: exportInFlight, watchdog_paused: watchdogPaused, demo: false,
        destPath: "", destDir: "", destName: "",
        storePath: STORE_PATH, backend: "jsonl",
        count: { total: 0, current: 0, superseded: 0, deleted: 0 },
        estimateBytes: 0, estimateLabel: "empty",
        error: String(e && e.message || e),
      });
    });
    return;
  }
  if (req.method === "POST" && url === "/api/export") {
    body(req, () => {
      if (exportInFlight || importInFlight) {
        json(res, 409, { ok: false, code: "busy", error: "export already in progress" });
        return;
      }
      exportInFlight = true;
      pauseWatchdog();
      const run = async () => {
        await waitForTestHold();
        await yieldToEventLoop();
        const result = await exp.runExport({
          mode: "zip",
          storePath: STORE_PATH,
          name: exp.defaultExportName(),
          outDir: exp.defaultOutDir(STORE_PATH),
        }, {
          onAfterEntry: async (ctx) => {
            if (ctx && ctx.n % YIELD_EVERY === 0) await yieldToEventLoop();
          },
        });
        return result;
      };
      run().then((result) => {
        try { revealExportedFile(result.path); } catch { /* */ }
        json(res, 200, {
          ok: true,
          path: result.path,
          count: result.count,
          zipBytes: result.zipBytes,
          entries: result.entries,
          storePath: STORE_PATH,
          demo: false,
        });
      }).catch((e) => {
        json(res, 500, {
          ok: false,
          code: "failed",
          error: String(e && e.message || e),
        });
      }).finally(() => {
        exportInFlight = false;
        resumeWatchdog();
      });
    });
    return;
  }
  // RM-17: panel import. GET = dest snapshot + suggested Desktop zip
  // (read-only; does not mint an empty .db). POST with apply:false is
  // the CLI dry-run. POST with apply:true shells runImport() into THIS
  // store. --with-edges is a body flag, default off. Not an MCP tool.
  if (req.method === "GET" && (url === "/api/import" || url.startsWith("/api/import?"))) {
    imp.probeDest(STORE_PATH).then((dest) => {
      json(res, 200, {
        destEmpty: !!dest.empty,
        destCount: dest.count || 0,
        destEdges: dest.edgeCount || 0,
        destPath: dest.path || STORE_PATH,
        destBackend: dest.backend || "jsonl",
        suggestedSource: suggestImportSource(),
        withEdgesDefault: false,
        busy: !!(exportInFlight || importInFlight),
        import_busy: !!importInFlight,
        watchdog_paused: watchdogPaused,
      });
    }).catch((e) => {
      json(res, 200, {
        destEmpty: true, destCount: 0, destEdges: 0,
        destPath: STORE_PATH, destBackend: "jsonl",
        suggestedSource: suggestImportSource(),
        withEdgesDefault: false,
        busy: !!(exportInFlight || importInFlight),
        import_busy: !!importInFlight,
        watchdog_paused: watchdogPaused,
        error: String(e && e.message || e),
      });
    });
    return;
  }
  if (req.method === "POST" && url === "/api/import/pick") {
    body(req, () => {
      pickImportFile().then((r) => json(res, 200, r)).catch((e) => {
        json(res, 200, { ok: false, code: "failed", error: String(e && e.message || e) });
      });
    });
    return;
  }
  if (req.method === "POST" && url === "/api/import") {
    body(req, (b) => {
      let parsed = {};
      try { parsed = JSON.parse(b) || {}; } catch { parsed = {}; }
      const source = parsed && parsed.source;
      if (!source || !String(source).trim()) {
        json(res, 400, { ok: false, code: "IMPORT_NO_SOURCE", error: "missing source path" });
        return;
      }
      const flags = {
        source: String(source).trim(),
        apply: !!parsed.apply,
        merge: !!parsed.merge,
        withEdges: !!parsed.withEdges,
        replaceEdges: !!parsed.replaceEdges,
        destPath: STORE_PATH,
      };
      if (!flags.apply) {
        imp.runImport(flags).then((plan) => {
          json(res, 200, Object.assign({
            ok: !(plan.errors && plan.errors.length),
            apply: false,
          }, plan));
        }).catch((e) => {
          json(res, 200, {
            ok: false,
            apply: false,
            code: e && e.code || "failed",
            error: String(e && e.message || e),
          });
        });
        return;
      }
      if (exportInFlight || importInFlight) {
        json(res, 409, { ok: false, code: "busy", error: "import already in progress" });
        return;
      }
      importInFlight = true;
      pauseWatchdog();
      const run = async () => {
        await waitForTestHold();
        await yieldToEventLoop();
        return imp.runImport(flags, {
          onAfterRecord: async (ctx) => {
            if (ctx && ctx.n % YIELD_EVERY === 0) await yieldToEventLoop();
          },
        });
      };
      run().then((result) => {
        json(res, 200, Object.assign({ ok: true }, result));
      }).catch((e) => {
        json(res, 200, {
          ok: false,
          apply: true,
          code: e && e.code || "failed",
          error: String(e && e.message || e),
        });
      }).finally(() => {
        importInFlight = false;
        resumeWatchdog();
      });
    });
    return;
  }
  res.writeHead(404); res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  const addr = server.address();
  const url = "http://127.0.0.1:" + (addr && addr.port ? addr.port : PORT) + "/";
  // Guarded: as a windowless (GUI-subsystem) exe there's no console to write to.
  try { process.stdout.write("Resonance Memory control panel running at " + url + "\n"); } catch { }
  if (process.env.RESONANCE_MEMORY_NO_OPEN !== "1") {
    const cmd = process.platform === "win32" ? 'start "" "' + url + '"'
      : process.platform === "darwin" ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
    exec(cmd, () => { });
  }
});
