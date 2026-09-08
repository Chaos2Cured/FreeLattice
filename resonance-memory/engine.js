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
 * engine.js - one-click setup for the "meaning engine" (the embedding model).
 *
 * Resonance Memory matches by meaning using an embedding model served at an
 * OpenAI-compatible /v1/embeddings endpoint (LM Studio by default). Rather than
 * make a non-technical user hunt through Hugging Face, the Developer tab, and
 * manual model loading, we drive LM Studio's bundled `lms` CLI to do the whole
 * thing non-interactively: start the local server, download the embedder if it
 * isn't already there, and load it.
 *
 * None of this is required for the MCP server itself - it's pure convenience
 * wiring for the control panel. If `lms` can't be found, LM Studio isn't
 * installed, and we say exactly that instead of pretending to fix it.
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFile } = require("child_process");

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
const EMBED_URL = process.env.EMBED_ENDPOINT || "http://localhost:1234/v1/embeddings";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-nomic-embed-text-v1.5";
// The search term `lms get` resolves to the Nomic embedder; `-y` auto-picks the
// hardware-appropriate GGUF variant with no prompts.
const GET_TERM = process.env.EMBED_GET_TERM || "nomic-embed-text-v1.5";

// `lms` ships with LM Studio at a fixed location; prefer that over PATH.
function lmsPath() {
  const bin = process.platform === "win32" ? "lms.exe" : "lms";
  const candidate = path.join(HOME, ".lmstudio", "bin", bin);
  try { if (fs.existsSync(candidate)) return candidate; } catch { }
  return null;
}

function runLms(args, timeoutMs) {
  return new Promise((resolve) => {
    const exe = lmsPath() || (process.platform === "win32" ? "lms.exe" : "lms");
    execFile(exe, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({ ok: !err, code: err ? (err.code == null ? 1 : err.code) : 0, out: ((stdout || "") + (stderr || "")).trim() });
      });
  });
}

// The endpoint answering is the ONLY thing the server actually depends on, so
// test that directly rather than trusting a model list. A live request also
// nudges LM Studio to JIT-load the embedder if it's downloaded but not loaded.
async function endpointReady() {
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: ["ping"] }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const j = await res.json();
    return Array.isArray(j.data) && Array.isArray(j.data[0] && j.data[0].embedding);
  } catch { return false; }
}

// State the panel renders as a pill:
//   ready        - endpoint answered; nothing to do
//   needs-setup  - lms present (LM Studio installed) but endpoint not answering
//   no-lmstudio  - lms not found; user must install LM Studio first
async function status() {
  if (await endpointReady()) return { state: "ready" };
  if (lmsPath()) return { state: "needs-setup" };
  // Last chance: maybe `lms` is on PATH even if not at the default location.
  const probe = await runLms(["version"], 8000);
  return { state: probe.ok ? "needs-setup" : "no-lmstudio" };
}

// One-click setup: server on -> embedder downloaded -> loaded -> verified.
async function setup() {
  const log = [];
  const step = (name, r) => { log.push({ name, ok: r.ok, out: (r.out || "").slice(-600) }); return r; };

  // 1) Start the local server (also launches LM Studio if it's closed). Idempotent.
  step("start server", await runLms(["server", "start"], 30000));

  // 2) Download the embedder only if it isn't already on disk (an 84 MB fetch otherwise).
  const ls = await runLms(["ls"], 20000);
  if (/nomic-embed-text/i.test(ls.out)) {
    log.push({ name: "download embedder", ok: true, out: "already downloaded" });
  } else {
    const got = step("download embedder", await runLms(["get", "-y", "--gguf", GET_TERM], 6 * 60 * 1000));
    if (!got.ok) return { ok: false, state: "needs-setup", log, message: "Couldn't download the embedding model - check your connection and that LM Studio is installed." };
  }

  // 3) Load it. Harmless if it's already loaded; the endpoint check below is the real gate.
  step("load embedder", await runLms(["load", EMBED_MODEL], 90000));

  // 4) Truth check: is the endpoint answering now? Give LM Studio a few seconds to come up.
  for (let i = 0; i < 6; i++) {
    if (await endpointReady()) return { ok: true, state: "ready", log };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: false, state: "needs-setup", log, message: "Setup ran, but the endpoint isn't answering yet. Give LM Studio a moment and try again, or open it and confirm a model is loaded." };
}

module.exports = { status, setup, endpointReady, lmsPath, EMBED_MODEL };
