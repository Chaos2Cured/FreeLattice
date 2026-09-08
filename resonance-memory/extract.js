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
 * extract.js — RM-01.c Tier 2, the opt-in local LLM extraction pass.
 *
 * Off by default on purpose: RM's Tier 0/1 is the reliable floor for everyone.
 * A weak local model can extract WORSE than the heuristics, so this is a
 * CONDITIONAL bonus the user has to turn on — never a silent default. That
 * is an identity choice, not a missing feature: Resonance Memory does the
 * work; the LLM is invited, not required.
 *
 * Capable path (either is enough):
 *   (1) the MCP client advertised `sampling` at initialize — the server
 *       asks whatever agent is driving RM to complete;
 *   (2) the configured inference endpoint serves a chat-capable model
 *       (GET /v1/models, skip embedding ids).
 * If neither, Tier 2 simply cannot run. Honest capability limit, not a
 * buried failure.
 *
 * One call, ADD-only (conflict resolution stays RM-03). Bounded by a
 * timeout. Any throw / timeout / malformed / sanity-fail → caller keeps
 * the Tier 0/1 facts. A save must never fail or hang because extraction
 * did. Zero runtime deps: built-in fetch, same as the embed path.
 *
 * memory-core.js is the only save() caller. This module owns the prompt,
 * the parser, the sanity gate, the chat POST, and capability detection
 * so tests can exercise them without a network, and so server.js /
 * eval/measure.js cannot fork a second extraction policy.
 */

const EXTRACT_PROMPT =
  "Extract durable facts worth remembering long-term.\n" +
  "Return ONLY minified JSON: {\"facts\":[\"...\"],\"skip\":false}\n" +
  "Do not think out loud. No markdown. No extra keys.\n" +
  "\n" +
  "Rules:\n" +
  "- One self-contained fact per string. Resolve pronouns to names.\n" +
  "- Keep the user's own wording where possible; do not editorialize.\n" +
  "- Omit pleasantries, questions, and anything true only right now.\n" +
  "- If nothing is durable, return {\"facts\":[],\"skip\":true}\n" +
  "\n" +
  "Input: ";

// 0001 sketched 4000ms. Too tight for a 20B-class local model sharing a
// 16 GB card with the embedder — the live A/B would measure timeout-
// degrade, not extraction. 8s is the interactive bound: a hung endpoint
// cannot stall save. Measure path passes a longer timeout so the
// RESULTS.md number is extraction quality, not the bound.
const EXTRACT_TIMEOUT_MS = 8000;
const EXTRACT_MAX_FACTS = 6;
const EXTRACT_MAX_TOKENS = 400;
const DEFAULT_EMBED_URL = "http://localhost:1234/v1/embeddings";

function envFlag(name) {
  return ["1", "true", "yes"].includes(String(process.env[name] || "").toLowerCase());
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/*
 * Live-config `extract_llm` wins over env RESONANCE_EXTRACT_LLM, which
 * wins over the default (false). Same pattern as the field toggle and
 * the RM-02.b bands. memory-core never opens CONFIG_PATH — callers
 * inject the boolean so eval/tests cannot inherit the user's panel file.
 */
function readExtractEnabled(config) {
  const c = config && typeof config === "object" ? config : {};
  if (typeof c.extract_llm === "boolean") return c.extract_llm;
  return envFlag("RESONANCE_EXTRACT_LLM");
}

function v1Root(embedUrl) {
  const u = String(embedUrl || process.env.EMBED_ENDPOINT || DEFAULT_EMBED_URL);
  if (/\/v1\/(?:embeddings|chat\/completions|models)\/?$/i.test(u)) {
    return u.replace(/\/v1\/(?:embeddings|chat\/completions|models)\/?$/i, "/v1");
  }
  if (/\/v1\/?$/i.test(u)) return u.replace(/\/?$/, "");
  return "http://localhost:1234/v1";
}

function chatCompletionsUrl(embedUrl) {
  return v1Root(embedUrl) + "/chat/completions";
}

function modelsUrl(embedUrl) {
  return v1Root(embedUrl) + "/models";
}

function isEmbeddingModel(id) {
  const s = String(id || "").toLowerCase();
  if (!s) return true;
  return /embed|text-embedding|nomic-embed|\bbge-|\be5-|\bgte-/.test(s);
}

function modelIdsFrom(body) {
  if (!body) return [];
  const rows = Array.isArray(body) ? body
    : Array.isArray(body.data) ? body.data
    : [];
  const ids = [];
  for (const row of rows) {
    const id = typeof row === "string" ? row : (row && row.id);
    if (id) ids.push(String(id));
  }
  return ids;
}

function pickChatModel(body, preferred) {
  const ids = modelIdsFrom(body);
  const chat = ids.filter((id) => !isEmbeddingModel(id));
  const want = preferred || process.env.RESONANCE_EXTRACT_MODEL || "";
  if (want && chat.includes(want)) return want;
  if (want && ids.includes(want) && !isEmbeddingModel(want)) return want;
  return chat[0] || null;
}

function clientSupportsSampling(initParams) {
  const cap = initParams && initParams.capabilities;
  return !!(cap && typeof cap === "object" && cap.sampling);
}

function stripThink(s) {
  return String(s || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel\|>[\s\S]*?<\|message\|>/g, "")
    .trim();
}

function parseExtractJson(raw) {
  let text = stripThink(raw);
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("extract: no JSON object");
  let obj;
  try { obj = JSON.parse(text.slice(start, end + 1)); }
  catch (e) { throw new Error("extract: malformed JSON"); }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("extract: JSON is not an object");
  }
  const facts = Array.isArray(obj.facts)
    ? obj.facts.filter((f) => typeof f === "string" && f.trim()).map((f) => f.replace(/\s+/g, " ").trim())
    : null;
  if (facts == null) throw new Error("extract: facts is not an array");
  return { facts, skip: !!obj.skip };
}

/*
 * Small local models will hallucinate, echo the prompt, or dump a
 * paragraph. Falling back to Tier 0 is always safe, so we reject
 * aggressively (0001: asymmetric costs → asymmetric thresholds).
 */
function sanityCheckExtract(parsed, sourceText) {
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "not-object" };
  if (parsed.skip) return { ok: false, reason: "skip" };
  const facts = Array.isArray(parsed.facts) ? parsed.facts : null;
  if (!facts) return { ok: false, reason: "facts-not-array" };
  if (!facts.length) return { ok: false, reason: "empty" };
  if (facts.length > EXTRACT_MAX_FACTS) return { ok: false, reason: "too-many" };
  const srcLen = String(sourceText || "").length;
  for (const f of facts) {
    if (typeof f !== "string" || !f.trim()) return { ok: false, reason: "non-string" };
    if (srcLen && f.length > srcLen * 1.5) return { ok: false, reason: "too-long" };
    if (/^extract |^return only|^rules:/i.test(f)) return { ok: false, reason: "prompt-echo" };
  }
  return { ok: true, facts };
}

/*
 * Gate a raw extract() return into a fact list, or null (= keep Tier 0).
 * memory-core calls this so a mock that returns garbage degrades the
 * same way a live model that returns garbage does.
 */
function acceptExtract(out, sourceText) {
  if (out == null) return null;
  if (typeof out === "string") {
    try { out = parseExtractJson(out); }
    catch { return null; }
  }
  if (typeof out !== "object") return null;
  const gate = sanityCheckExtract({
    facts: Array.isArray(out.facts) ? out.facts : out.facts,
    skip: !!out.skip,
  }, sourceText);
  return gate.ok ? gate.facts : null;
}

function messageContent(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  const choice = body.choices && body.choices[0];
  const msg = (choice && choice.message) || body.content || body;
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (typeof msg.content === "string") return msg.content;
  if (msg.content && typeof msg.content.text === "string") return msg.content.text;
  if (Array.isArray(msg.content)) {
    return msg.content.map((p) => (typeof p === "string" ? p : (p && p.text) || "")).join("");
  }
  return "";
}

async function chatExtract(text, opts) {
  const cfg = opts || {};
  const endpoint = cfg.endpoint || chatCompletionsUrl();
  const model = cfg.model;
  if (!model) throw new Error("extract: no chat model");
  const timeoutMs = cfg.timeoutMs != null ? cfg.timeoutMs : EXTRACT_TIMEOUT_MS;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: EXTRACT_PROMPT + JSON.stringify(String(text || "")) }],
      temperature: 0,
      max_tokens: EXTRACT_MAX_TOKENS,
      // Qwen3 / gpt-oss thinking channels: off if the server honors it.
      enable_thinking: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error("extract HTTP " + res.status);
  return parseExtractJson(messageContent(await res.json()));
}

async function samplingExtract(text, opts) {
  const cfg = opts || {};
  const sample = cfg.sample;
  if (typeof sample !== "function") throw new Error("extract: no sampler");
  const timeoutMs = cfg.timeoutMs != null ? cfg.timeoutMs : EXTRACT_TIMEOUT_MS;
  const result = await sample({
    messages: [{
      role: "user",
      content: { type: "text", text: EXTRACT_PROMPT + JSON.stringify(String(text || "")) },
    }],
    maxTokens: EXTRACT_MAX_TOKENS,
    temperature: 0,
    includeContext: "none",
  }, timeoutMs);
  return parseExtractJson(messageContent(result));
}

async function extractFacts(text, opts) {
  const cfg = opts || {};
  const parsed = typeof cfg.sample === "function"
    ? await samplingExtract(text, cfg)
    : await chatExtract(text, cfg);
  const gate = sanityCheckExtract(parsed, text);
  if (!gate.ok) throw new Error("extraction failed sanity check: " + gate.reason);
  return { facts: gate.facts, skip: false };
}

function makeChatExtractor(opts) {
  const cfg = opts || {};
  return (text) => extractFacts(text, cfg);
}

async function probeChatCapability(opts) {
  const cfg = opts || {};
  const url = cfg.modelsUrl || modelsUrl();
  const timeoutMs = cfg.timeoutMs != null ? cfg.timeoutMs : 2000;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { capable: false, model: null };
    const body = await res.json();
    const model = pickChatModel(body, cfg.preferred);
    return { capable: !!model, model };
  } catch {
    return { capable: false, model: null };
  }
}

module.exports = {
  EXTRACT_PROMPT, EXTRACT_TIMEOUT_MS, EXTRACT_MAX_FACTS, EXTRACT_MAX_TOKENS,
  envFlag, envNumber, readExtractEnabled,
  v1Root, chatCompletionsUrl, modelsUrl,
  isEmbeddingModel, modelIdsFrom, pickChatModel, clientSupportsSampling,
  stripThink, parseExtractJson, sanityCheckExtract, acceptExtract, messageContent,
  chatExtract, samplingExtract, extractFacts, makeChatExtractor, probeChatCapability,
};
