/*
 * Resonance Memory
 * Copyright (C) 2026 Samuel Jackson Grim
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See <https://www.gnu.org/licenses/>.
 */
/*
 * eval/embed-cache.js - the deterministic embedder for the RM-00 harness.
 *
 * Real embeddings, computed ONCE against a live LM Studio and committed to
 * embeddings.cache.json. In normal mode the harness NEVER hits the network, so a
 * run is identical on this laptop, on CI, and on a plane. Adding a new corpus case
 * is a two-step ritual - run once with EVAL_REFRESH=1 (needs a live embedder),
 * then commit the grown cache - and that ritual is a feature: the fixtures stay
 * honest and reviewable in a diff.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_PATH = path.join(__dirname, "embeddings.cache.json");
// Same endpoint/model defaults as server.js, overridable for a different embedder.
const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";

function hash(t) { return crypto.createHash("sha256").update(String(t)).digest("hex").slice(0, 16); }

let cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch { return {}; } })();

async function realEmbed(texts) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error("embed HTTP " + res.status);
  const body = await res.json();
  return body.data.map((d) => d.embedding);
}

async function embed(texts) {
  const missing = [...new Set(texts.filter((t) => !(hash(t) in cache)))];
  if (missing.length) {
    if (process.env.EVAL_REFRESH !== "1") {
      throw new Error(
        missing.length + " uncached string(s). Populate the cache once with a live embedder:\n" +
        "  PowerShell:  $env:EVAL_REFRESH=1; npm run eval; Remove-Item Env:EVAL_REFRESH\n" +
        "  (needs LM Studio serving /v1/embeddings on :1234)"
      );
    }
    const fresh = await realEmbed(missing);
    missing.forEach((t, i) => { cache[hash(t)] = fresh[i]; });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  }
  return texts.map((t) => cache[hash(t)]);
}

module.exports = { embed, hash, CACHE_PATH };
