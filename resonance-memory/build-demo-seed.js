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
 * build-demo-seed.js - generates demo-seed.jsonl: a small, 100% SYNTHETIC memory set
 * (fictional person "Alex Rivera") pre-embedded with the nomic embedder, so the demo
 * graph lights up on first launch with NO endpoint and NO real data. The clusters
 * (game dev / running / jazz / dog) are wired with deliberate non-obvious cross-links
 * so the association graph shows bridges, not just piles.
 *
 * Run once with LM Studio + the embedding model up:  node build-demo-seed.js
 * Never contains real memories. Safe to ship in a public repo.
 */
const fs = require("fs");
const path = require("path");
const { normalize, writeFileDurable } = require("./record.js");

const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";
const OUT = path.join(__dirname, "demo-seed.jsonl");

const MEMORIES = [
  // --- Nightfall (the game) ---
  "I'm building an indie game called Nightfall, a moody detective RPG set in a rain-soaked city.",
  "Nightfall's combat system keeps crashing whenever the third act loads.",
  "I decided to rewrite Nightfall's save system in Rust because the old one corrupts files.",
  "Nightfall's art style is hand-painted watercolor backgrounds — slow to make but it sells the mood.",
  "I'm making Nightfall completely solo, so I wear every hat: code, art, writing, and sound.",
  "The Nightfall playable demo goes up on itch.io next month for public playtesting.",
  "I named Nightfall's detective 'Coltrane' after the jazz musician I listen to while writing him.",
  "I read Chandler and Hammett detective novels to get Nightfall's dialogue pacing right.",
  // --- running / knee / health ---
  "I go for a 5am run along the river most mornings to clear my head before work.",
  "My left knee flares up if I run more than 10k, so I'm keeping my distances short this month.",
  "I do my best debugging on a run — I actually figured out the Nightfall third-act crash mid-jog.",
  "I signed up for a half-marathon in the fall to force myself to train consistently.",
  "Cold mornings make my knee ache, so I stretch for ten minutes before any run now.",
  "I got a standing desk after a year of solo coding wrecked my lower back.",
  // --- jazz / music ---
  "I collect jazz vinyl; Coltrane's Blue Train is my most-played record by far.",
  "I always code to jazz. Something about it keeps me in flow for hours.",
  "I taught myself basic piano so I could write Nightfall's soundtrack myself.",
  "Miles Davis's Kind of Blue is what I put on when I need to think through a hard bug.",
  // --- Biscuit (the dog) ---
  "My dog Biscuit, a scruffy little terrier, sleeps under my desk while I work.",
  "Biscuit needs a long walk at lunch or he chews through my controller cables.",
  "The vet says Biscuit needs to lose a pound, so our lunchtime walks got longer.",
  "I recorded Biscuit's bark and hid it in Nightfall as a little easter egg.",
  // --- food / sleep / deadlines ---
  "I switched to decaf after 2pm — otherwise my sleep falls apart the week before a deadline.",
  "I meal-prep on Sundays so deadline weeks don't collapse into pizza every night.",
];

async function embed(texts) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error("embed HTTP " + res.status + " - is the embedding model loaded?");
  const body = await res.json();
  if (!body.data || !body.data.length) throw new Error("no vectors returned");
  return body.data.map((d) => d.embedding);
}

(async () => {
  console.log("Embedding " + MEMORIES.length + " synthetic demo memories via " + EMBED_MODEL + " ...");
  const vecs = await embed(MEMORIES);
  const now = new Date().toISOString();
  // Emit through normalize() so the seed always carries the CURRENT record shape
  // (temporal fields, provenance, ...) without this script having to track it.
  const lines = MEMORIES.map((text, i) => JSON.stringify(normalize({
    id: 1000 + i, created: now, modified: now, text,
    embedding: vecs[i], valid_from: now, last_confirmed: now, source: "user_stated",
  })));
  writeFileDurable(OUT, lines.join("\n") + "\n");
  console.log("Wrote " + MEMORIES.length + " demo memories -> " + OUT +
    "  (" + (vecs[0] ? vecs[0].length : 0) + "-dim vectors)");
})().catch((e) => { console.error("FAILED: " + e.message); process.exit(1); });
