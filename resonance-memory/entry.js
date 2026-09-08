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
// Bundled single-executable entry point.
//   memory              (double-click)  -> opens the control panel in the browser
//   memory --mcp        (AI client)     -> runs the MCP server over stdio
//   memory --install    (CLI)           -> connect to detected AI apps
//   memory --uninstall  (CLI)           -> disconnect from AI apps
//   memory --dedup-existing [--apply]   -> RM-02.c backfill (dry-run default)
//   memory --migrate                    -> RM-07 slice 2a JSONL→SQLite (opt-in)
//   memory --export [--name] [--out]    -> RM-07 slice 2b sovereignty zip
//   memory --export-jsonl               -> raw memories.jsonl (scripting primitive)
//   memory --import <zip-or-jsonl>      -> RM-17 sovereignty restore (dry-run default)
const mode = process.argv[2];

if (mode === "--mcp") {
  require("./server.js");
} else if (mode === "--install" || mode === "--uninstall") {
  const inst = require("./install.js");
  const r = mode === "--install" ? inst.install() : inst.uninstall();
  if (!r.ok && r.message) console.log(r.message);
  for (const x of r.results) console.log(x.name + ": " + x.action + (x.file ? "  (" + x.file + ")" : ""));
  if (r.ok && mode === "--install") console.log("\nDone. Restart your AI app to load the memory server.");
} else if (mode === "--dedup-existing") {
  require("./dedup-existing.js").main(process.argv.slice(3)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
} else if (mode === "--migrate" || mode === "--migrate-sqlite") {
  require("./migrate-sqlite.js").main(process.argv.slice(3)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
} else if (mode === "--export" || mode === "--export-jsonl") {
  require("./export-memory.js").main(process.argv.slice(2)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
} else if (mode === "--import") {
  require("./import-memory.js").main(process.argv.slice(2)).then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e.message || e));
    process.exit(2);
  });
} else {
  require("./panel.js");
}
