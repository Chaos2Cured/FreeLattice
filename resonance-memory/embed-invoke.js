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
 * embed-invoke.js - per-embedder input formatting for /v1/embeddings.
 *
 * Production used to POST raw text for every model. That is nomic's *best*
 * document-document geometry on the fire-together task (fair-run 2026-09-06).
 * It is also jina's *broken* geometry (true-pair cosine 0.05–0.87 until
 * Document:/Query: roles restore mean 0.74 / H1=1.00). Selecting Qwen or
 * jina in the panel without this switch silently used the wrong invocation.
 *
 * LM Studio's OpenAI-compatible endpoint typically ignores prompt_name, so
 * we prefix the input string. The family is keyed off the panel's
 * `config.embedder` (the user's explicit selection) then EMBED_MODEL.
 *
 *   nomic  — raw text both sides. Official search_query:/search_document:
 *            *hurts* Related: AUROC; asymmetric query/doc is the worst
 *            cofire in the fair run (1.17×). Do not "fix" this.
 *   qwen   — documents raw (Qwen's recipe); queries get the default
 *            Instruct-query wrapper. Query prompting did not lift cofire
 *            on this corpus; it is here so a Qwen selection is honest.
 *   jina   — "Query: " / "Document: " (sentence-transformers prompt_name
 *            query/document). Required; plain jina is unusable.
 *
 * EmbeddingGemma and unknowns stay raw (nomic default). Eval's cached
 * embedder never goes through here — prefixes are a production-path
 * concern, and the golden is nomic unprefixed.
 */

const QWEN_QUERY_INSTRUCT =
  "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ";

function detectEmbedderFamily(modelId, configEmbedder) {
  const s = String(configEmbedder || modelId || "").toLowerCase();
  if (s.includes("jina")) return "jina";
  if (s.includes("qwen")) return "qwen";
  return "nomic";
}

function formatEmbedInput(text, role, family) {
  const t = String(text == null ? "" : text);
  const r = role === "query" ? "query" : "document";
  const f = family || "nomic";
  if (f === "jina") return (r === "query" ? "Query: " : "Document: ") + t;
  if (f === "qwen" && r === "query") return QWEN_QUERY_INSTRUCT + t;
  return t;
}

function formatEmbedInputs(texts, role, family) {
  return (texts || []).map((t) => formatEmbedInput(t, role, family));
}

module.exports = {
  detectEmbedderFamily,
  formatEmbedInput,
  formatEmbedInputs,
  QWEN_QUERY_INSTRUCT,
};
