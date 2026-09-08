/*
 * Resonance Memory - A/B value rig (Grok's independent copy)
 * Copyright (C) 2026 Samuel Jackson Grim
 * AGPL-3.0-or-later. See <https://www.gnu.org/licenses/>.
 */
/*
 * lib/llm.js - the only network surface of this rig.
 *
 * Two OpenAI-compatible endpoints on the same LM Studio server (:1234):
 *   - /v1/chat/completions  the DRIVER under test
 *   - /v1/embeddings        the embedder RM uses (nomic-embed-text-v1.5)
 *
 * The embedder is role-aware via the SHIPPED embed-invoke formatter, so the
 * RM arm embeds the way the product does. A rig-local shortcut here would
 * make the measurement lie about production geometry.
 */

const { formatEmbedInputs, detectEmbedderFamily } = require("../../../embed-invoke.js");

const CHAT_URL = process.env.AB_CHAT_ENDPOINT || "http://localhost:1234/v1/chat/completions";
const EMBED_URL = process.env.AB_EMBED_ENDPOINT || process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";

// Rough token estimate (chars/4). Only used to hold recency and rm to an
// IDENTICAL injection budget. An approximation is fine as long as both arms
// use the same one. Never reported as a tokenizer-accurate count.
function estTokens(s) { return Math.ceil(String(s || "").length / 4); }

async function chat(messages, { model, temperature = 0.2, maxTokens = 512, timeoutMs = 120000 } = {}) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error("chat HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  const body = await res.json();
  const choice = body.choices && body.choices[0];
  const msg = choice && choice.message;
  return String((msg && msg.content) || (choice && choice.text) || "").trim();
}

// Returns an embed(texts, {role}) matching server.js so it drops into createMemory().
function makeEmbed({ model = process.env.EMBED_MODEL || "nomic-embed-text-v1.5", embedderName } = {}) {
  const family = detectEmbedderFamily(model, embedderName);
  return async function embed(texts, opts) {
    const role = opts && opts.role === "query" ? "query" : "document";
    const input = formatEmbedInputs(texts, role, family);
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error("embed HTTP " + res.status);
    const body = await res.json();
    return body.data.map((d) => d.embedding);
  };
}

async function listLoaded() {
  const url = EMBED_URL.replace(/\/embeddings$/, "/models");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.data || []).map((m) => m.id);
  } catch { return null; }
}

module.exports = { chat, makeEmbed, listLoaded, estTokens, CHAT_URL, EMBED_URL };
