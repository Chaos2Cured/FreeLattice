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
 * eval/pipeline.js - the harness's adapter onto the shared engine.
 *
 * This USED to be a hand-copied "faithful mirror" of server.js's save/recall. That
 * duplication was the exact drift the RM-00 harness exists to catch, so the shared
 * behavior now lives in ../memory-core.js and BOTH server.js and this build on it.
 * What remains here is only the impedance match the harness needs: a boolean field
 * flag (not a live config read) and an injected Store (sqlite default; JSONL
 * pin) plus an edge persist that follows that Store (slice 5).
 *
 * Because save/recall are now literally the same code the server runs, the RM-00
 * golden is a regression guard on the server itself, not on a copy of it.
 *
 * The Store is injected. eval/run.js default (RM-07 slice 4) is SqliteStore;
 * `--store jsonl` keeps the JSONL path testable. Same createCore, different
 * backend — that is the drop-in contract the golden-parity gate proves. Do
 * not fork a sqlite recall path in here.
 */

const { openEdgeStore } = require("../edges.js");
const { createCore, cosine } = require("../memory-core.js");

function createMemory({
  store, embed, fieldEnabled = false, edgesPath, ledgerPath,
  extractEnabled = false, extractCapable, extract, extractTimeoutMs,
}) {
  // Lazy EdgeStore, exactly as server.js does it, so a field-off run never touches disk.
  // Persistence follows the injected Store (RM-07 slice 5): SqliteStore shares
  // the `.db`; JsonlStore still uses the sidecar path. ledgerPath is a leftover
  // alias: `.assoc.json` is rewritten to `.edges.json` so diagnose/probe callers
  // that haven't moved still land on the new filename, and EdgeStore migrates a
  // sibling `.assoc.json` one-way if one is sitting there.
  // extract* default off so eval/run.js (golden) never invokes Tier 2.
  const file = edgesPath || (ledgerPath
    ? String(ledgerPath).replace(/\.assoc\.json$/, ".edges.json")
    : undefined);
  let _edges = null;
  const getEdgeStore = () => {
    if (!_edges) _edges = openEdgeStore({ store, file, edgesPath: file });
    return _edges;
  };
  const core = createCore({
    store, embed, fieldEnabled: () => fieldEnabled, getEdgeStore,
    extractEnabled: () => !!extractEnabled,
    extractCapable, extract, extractTimeoutMs,
  });
  return { save: core.save, recall: core.recall };
}

module.exports = { createMemory, cosine };
