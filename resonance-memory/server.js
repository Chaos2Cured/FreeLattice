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
 * resonance-memory - an MCP memory server a small model cannot misuse.
 *
 * Four cognitive verbs, each dead simple:
 *   save_memory({ content })        -> embed once, store, confirm
 *   recall_memory({ query })        -> most relevant saved memories (with ids)
 *   edit_memory({ id, content })    -> replace text, regenerate embedding
 *   delete_memory({ id })           -> soft delete (deleted=true)
 *
 * The graph/store is the SUBSTRATE, never the interface. The model never sees
 * embeddings, importance, timestamps, or any storage internal - only the four verbs
 * and an opaque `id` it copies from a recall listing.
 *
 * Design invariants (see resonance-memory-stack ROADMAP):
 *   - Ranking is COSINE ONLY. importance/access_count govern RETENTION, never rank,
 *     until a labelled-set A/B proves blending helps (measured: weight-in-rank inverts).
 *   - Embed ONCE at save; recall embeds only the query, cosine vs stored vectors.
 *   - Server owns all metadata; the model assigns none of it.
 *   - A Store abstraction sits behind the verbs so the backend (JSONL now, Lantern
 *     later) can be swapped without changing the MCP API.
 *
 * Pure Node stdlib + built-in fetch (Node ≥22.5 for SqliteStore / node:sqlite;
 * JsonlStore itself does not need it). Speaks MCP over stdio as
 * line-delimited JSON-RPC 2.0.
 */

const fs = require("fs");
const path = require("path");
const { hebbianDecayType, openEdgeStore } = require("./edges.js");
const { openStore } = require("./store.js");
const { createCore, defaultGetEdges, readDedupThresholds, readFieldMinSim, readConstraintGate } = require("./memory-core.js");
const extract = require("./extract.js");
const { detectEmbedderFamily, formatEmbedInputs } = require("./embed-invoke.js");
const { WarmField } = require("./warm.js");
// Single source of truth for the version, so serverInfo can't drift from package.json.
// esbuild inlines this JSON into the bundle, so it resolves in the SEA build too.
const VERSION = require("./package.json").version;

// Associative field (Phase 2a/2b). Enabled by the RESONANCE_MEMORY_FIELD env var (default/
// fallback) OR, live, by a shared config.json that the control-panel dashboard writes.
// fieldEnabled() is read per recall, so the browser toggle takes effect without restarting
// the client. Primary cosine results are byte-identical whenever the field is off.
function baseDir() {
  // In a bundled single-executable, __dirname is virtual; resolve next to the exe.
  try { const sea = require("node:sea"); if (sea.isSea()) return path.dirname(process.execPath); } catch { }
  return __dirname;
}
const STORE_PATH = process.env.MEMORY_FILE_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || ".", ".lmstudio", "resonance-memory.jsonl");
// Runtime state lives WITH the data (not next to the exe), matching panel.js so the
// panel toggle and the server read the same file.
const CONFIG_PATH = process.env.RESONANCE_MEMORY_CONFIG ||
  path.join(path.dirname(STORE_PATH), "resonance-memory.config.json");
const ENV_FIELD = ["1", "true", "yes"].includes(String(process.env.RESONANCE_MEMORY_FIELD || "").toLowerCase());
const ENV_WARM = ["1", "true", "yes"].includes(String(process.env.RESONANCE_WARM_FIELD || "").toLowerCase());
const ENV_WARM_RANK = String(process.env.RESONANCE_WARM_RANK || "off").toLowerCase() || "off";
const ENV_WARM_TRACE = ["1", "true", "yes"].includes(String(process.env.RESONANCE_WARM_TRACE || "").toLowerCase());
function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
const ENV_WARM_EDGE_CAP = envInt("RESONANCE_WARM_EDGE_CAP", 512);
function fieldEnabled() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (typeof c.field === "boolean") return c.field;
  } catch { /* no config yet -> fall back to env */ }
  return ENV_FIELD;
}
// RM-02.b cosine bands. Live-config keys `dedup_hi` / `dedup_lo` win over
// env RESONANCE_DEDUP_HI / RESONANCE_DEDUP_LO, which win over the tuned
// defaults (0.95 / 0.88). Read per save so a config edit needs no restart,
// same as the field toggle. memory-core itself never opens CONFIG_PATH
// (eval/tests must not inherit the user's panel file).
function dedupThresholds() {
  try {
    return readDedupThresholds(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
  } catch { /* no config yet -> env / defaults */ }
  return readDedupThresholds(null);
}
function liveConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { return null; }
}
function fieldMinSim() {
  return readFieldMinSim(liveConfig());
}
function constraintGate() {
  return readConstraintGate(liveConfig());
}
function embedderFamily() {
  const c = liveConfig();
  return detectEmbedderFamily(EMBED_MODEL, c && c.embedder);
}
// RM-01.c Tier 2. Live-config `extract_llm` wins over env RESONANCE_EXTRACT_LLM,
// default false. Read per save so the panel toggle needs no restart, same as
// the field. Capability is a separate probe: toggle-on without a capable path
// is a silent no-op, not a hung save.
function extractEnabled() {
  try {
    return extract.readExtractEnabled(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
  } catch { /* no config yet -> env / default off */ }
  return extract.readExtractEnabled(null);
}

let clientSampling = false;
let capCache = { at: 0, capable: false, model: null };
const CAP_TTL_MS = 30000;

async function extractCapable() {
  if (clientSampling) return true;
  if (Date.now() - capCache.at < CAP_TTL_MS) return capCache.capable;
  const probe = await extract.probeChatCapability({
    modelsUrl: extract.modelsUrl(EMBED_URL),
    preferred: process.env.RESONANCE_EXTRACT_MODEL,
  });
  capCache = { at: Date.now(), capable: probe.capable, model: probe.model };
  return probe.capable;
}

const pendingSamples = new Map();
let sampleSeq = 0;

function mcpSample(params, timeoutMs) {
  const ms = timeoutMs != null ? timeoutMs : extract.EXTRACT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const id = "rm-extract-" + (++sampleSeq);
    const timer = setTimeout(() => {
      if (!pendingSamples.has(id)) return;
      pendingSamples.delete(id);
      reject(new Error("extract timeout"));
    }, ms);
    pendingSamples.set(id, {
      resolve(v) { clearTimeout(timer); resolve(v); },
      reject(e) { clearTimeout(timer); reject(e); },
    });
    send({ jsonrpc: "2.0", id, method: "sampling/createMessage", params });
  });
}

async function extractFn(text) {
  const timeoutMs = extract.envNumber("RESONANCE_EXTRACT_TIMEOUT_MS", extract.EXTRACT_TIMEOUT_MS);
  if (clientSampling) {
    return extract.extractFacts(text, { sample: mcpSample, timeoutMs });
  }
  const model = capCache.model || process.env.RESONANCE_EXTRACT_MODEL;
  const use = model || (await extract.probeChatCapability({
    modelsUrl: extract.modelsUrl(EMBED_URL),
    preferred: process.env.RESONANCE_EXTRACT_MODEL,
  })).model;
  if (!use) throw new Error("extract: no chat model");
  return extract.extractFacts(text, {
    endpoint: extract.chatCompletionsUrl(EMBED_URL),
    model: use,
    timeoutMs,
  });
}
const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";

fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });

// Unified edge store (Phase 0 / Slice C). Constructed on first use (field-on
// recall, save-time bind, or the startup pruneSweep) so the live toggle needs
// no restart. Persistence follows the store backend (RM-07 slice 5):
// SqliteStore → edges table in the same `.db` (one file); JsonlStore →
// <store>.edges.json. NEVER .assoc.json, so an old shipped Ledger cannot
// open the new format and misparse it. A leftover .assoc.json is migrated
// one-way on first load and left untouched (legacy / read-only-for-migration).
let _edges = null;
function getEdgeStore() {
  if (!_edges) _edges = openEdgeStore({ store, storePath: STORE_PATH });
  return _edges;
}

// Warm field (Phase 1). In-proc Map, never persisted (I7). Flags default off so
// the 27/31 golden is untouched. RESONANCE_WARM_RANK is read here so the MCP
// process actually ships the flag; ranking consumption is PR3 and ignored until then.
let _warm = null;
function getWarm() { if (!_warm) _warm = new WarmField(); return _warm; }
function warmEnabled() { return ENV_WARM; }
function warmTrace() { return ENV_WARM_TRACE; }
function warmEdgeCap() { return ENV_WARM_EDGE_CAP; }
// ENV_WARM_RANK is read (so the MCP process ships the flag) and ignored until PR3.

// --------------------------------------------------------------- embedding
// Role-aware: nomic stays raw (verified best); Qwen queries get Instruct;
// jina gets Query:/Document:. Family is keyed off panel `config.embedder`
// then EMBED_MODEL — LM Studio often ignores the request's model field
// and serves whatever is loaded, so the panel selection is the honest key.
async function embed(texts, opts) {
  const role = opts && opts.role === "query" ? "query" : "document";
  const input = formatEmbedInputs(texts, role, embedderFamily());
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("embed HTTP " + res.status);
  const body = await res.json();
  return body.data.map((d) => d.embedding);
}

let _bootConfig = {};
try { _bootConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { /* no config yet */ }
// RM-07 slice 4: openStore is the default-switch path (sqlite default,
// auto-migrate existing JSONL via the 2a protocol, fail-open to JSONL).
// Async because migrate streams. requestChain starts as this boot so an
// MCP initialize that arrives mid-migrate waits rather than racing.
let store;
let core;

async function bootStore() {
  store = await openStore(STORE_PATH, { config: _bootConfig });
  // The four verbs live in the shared engine (memory-core.js); server.js only wires
  // the environment into it - network embed, the live field toggle, the lazy EdgeStore.
  // eval/pipeline.js wires the SAME core to a cached embedder, so there is exactly one
  // implementation of save/recall and the RM-00 golden guards that they never diverge.
  core = createCore({
    store, embed, fieldEnabled, getEdgeStore, dedupThresholds, fieldMinSim, constraintGate,
    warmEnabled, getWarm, getEdges: defaultGetEdges,
    saveSeed: () => true,          // production: a just-saved fact is warm without a recall
    warmTrace, warmEdgeCap,
    extractEnabled, extractCapable, extract: extractFn,
    extractTimeoutMs: () => extract.envNumber("RESONANCE_EXTRACT_TIMEOUT_MS", extract.EXTRACT_TIMEOUT_MS),
  });
  // Compact soft-deleted rows once at startup (keeps the file bounded; embeddings kept).
  try { if (store.hasDeleted()) store.vacuum(); } catch { /* non-fatal */ }
  // Soft-prune faded+weak edges (Phase 0.4 / I8). Explicit maintenance, same
  // class as vacuum() — startup or on demand, NEVER recall/save. That is the
  // golden guardrail: eval never starts the MCP server, so this sweep cannot
  // move RM-00. Hard drop of pruned edges is EdgeStore.vacuum(), on demand.
  try {
    const E = getEdgeStore();
    const byId = new Map(store.all().map((r) => [String(r.id), r]));
    E.pruneSweep({
      typeFn: (a, b) => hebbianDecayType(byId.get(String(a)), byId.get(String(b))),
    });
  } catch { /* non-fatal: maintenance must never break startup */ }
  const kind = store.access ? "jsonl" : "sqlite";
  process.stderr.write("resonance-memory MCP server (v2) running on stdio (store: " +
    (store.file || STORE_PATH) + ", backend: " + kind + ")\n");
}

// -------------------------------------------------------------------- tools
const TOOLS = [
  {
    name: "save_memory",
    description: "Store something worth remembering in future conversations. Call this PROACTIVELY, without being asked, whenever the user tells you something durable: a preference, a decision and its reason, a correction, a personal fact or relationship, a constraint, or a commitment. Do NOT save passing small talk, one-off details that won't matter next time, or passwords/secrets. Prefer editing an existing memory over saving a near-duplicate. Pass the full statement as `content`. Example: save_memory({\"content\":\"Samuel prefers I act and report rather than ask permission.\"})",
    inputSchema: {
      type: "object",
      properties: { content: { type: "string", description: "The text to remember." } },
      required: ["content"],
    },
  },
  {
    name: "recall_memory",
    description: "Check what you already know before you answer. Call this at the START of a conversation, and any time the user refers to earlier context, their preferences, past decisions, or anything you may have been told before — including cues like 'remember', 'as I said', or 'my ...'. When unsure whether you know something relevant, recall first: it is read-only and cheap, and the memories are the user's own. Returns the most relevant memories, each prefixed with an `[id N]` you can pass to edit_memory or delete_memory. Example: recall_memory({\"query\":\"how does Samuel want me to handle permission\"})",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What you are trying to remember." } },
      required: ["query"],
    },
  },
  {
    name: "edit_memory",
    description: "Update a memory when a fact changes or the user corrects something — prefer this over saving a near-duplicate. Recall first to get the `id`, then pass `id` and the new `content`. Example: edit_memory({\"id\":\"1737400000000\",\"content\":\"corrected fact\"})",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: ["string", "number"], description: "The id shown as [id N] in a recall listing." },
        content: { type: "string", description: "The new text to store." },
      },
      required: ["id", "content"],
    },
  },
  {
    name: "delete_memory",
    description: "Remove a memory when it is wrong, obsolete, or the user asks you to forget it. Recall first to get the `id`. Example: delete_memory({\"id\":\"1737400000000\"})",
    inputSchema: {
      type: "object",
      properties: { id: { type: ["string", "number"], description: "The id shown as [id N] in a recall listing." } },
      required: ["id"],
    },
  },
];

async function callTool(name, args, requestId) {
  args = args || {};
  // JSON-RPC request id, extracted at this boundary (Phase 0.3). Threaded
  // into every verb; EdgeStore only *uses* it on mutating ops (save-time
  // bind, reinforceRecall). Missing/null id → no dedup (eval, panel, tests).
  const opts = { requestId };
  if (name === "save_memory") return await core.save(args.content, opts);
  if (name === "recall_memory") return await core.recall(args.query, 5, opts);
  if (name === "edit_memory") return await core.edit(args.id, args.content, opts);
  if (name === "delete_memory") return core.remove(args.id, opts);
  throw new Error("unknown tool: " + name);
}

// --------------------------------------------------------- MCP stdio plumbing
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }

async function handle(req) {
  const { id, method, params } = req;
  if (method === "initialize") {
    clientSampling = extract.clientSupportsSampling(params);
    return { jsonrpc: "2.0", id, result: {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "resonance-memory", version: VERSION },
    } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    try {
      const text = await callTool(params.name, params.arguments || {}, id);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
    } catch (e) {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Error: " + e.message }], isError: true } };
    }
  }
  if (method && method.startsWith("notifications/")) return null;
  if (id !== undefined) return { jsonrpc: "2.0", id, error: { code: -32601, message: "method not found: " + method } };
  return null;
}

let buf = "";
let requestChain = bootStore().catch((e) => {
  process.stderr.write("resonance-memory failed to open store: " +
    String(e && e.message || e) + "\n");
  process.exit(1);
});
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    // Response to an outbound sampling/createMessage. Resolve immediately so
    // a save() waiting on mcpSample can finish; do NOT queue behind handle().
    if (msg && msg.id != null && pendingSamples.has(msg.id) && msg.method == null) {
      const p = pendingSamples.get(msg.id);
      pendingSamples.delete(msg.id);
      if (msg.error) p.reject(new Error((msg.error && msg.error.message) || "sampling error"));
      else p.resolve(msg.result);
      continue;
    }
    const req = msg;
    requestChain = requestChain.then(async () => {
      const res = await handle(req);
      if (res) send(res);
    }).catch((e) => {
      if (req && req.id !== undefined) {
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: String(e && e.message || e) } });
      }
    });
  }
});


