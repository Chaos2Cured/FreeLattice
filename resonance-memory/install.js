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
 * install.js - wire this memory server into an MCP client's config, with zero
 * terminal knowledge required. Used by both the panel's "Connect" button and the
 * `--install` CLI flag.
 *
 * It adds an `mcpServers["resonance-memory"]` entry that launches THIS executable in
 * --mcp mode, preserving any other servers already configured, and leaves a .bak.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function isSea() { try { return require("node:sea").isSea(); } catch { return false; } }

// How the client should launch us. From the bundled exe: the exe itself, `--mcp`.
// In dev (plain node): node running server.js.
function selfLaunch() {
  if (isSea()) return { command: process.execPath, args: ["--mcp"] };
  return { command: process.execPath, args: [path.join(__dirname, "server.js")] };
}

// Known MCP clients and where their config lives (overridable for tests via env).
function clientConfigs() {
  if (process.env.RESONANCE_MEMORY_CONFIGS_JSON) {
    try { return JSON.parse(process.env.RESONANCE_MEMORY_CONFIGS_JSON); } catch { /* fall through */ }
  }
  const home = os.homedir();
  const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const list = [{ id: "lmstudio", name: "LM Studio", file: path.join(home, ".lmstudio", "mcp.json") }];
  if (process.platform === "win32")
    list.push({ id: "claude", name: "Claude Desktop", file: path.join(appdata, "Claude", "claude_desktop_config.json") });
  else if (process.platform === "darwin")
    list.push({ id: "claude", name: "Claude Desktop", file: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json") });
  else
    list.push({ id: "claude", name: "Claude Desktop", file: path.join(home, ".config", "Claude", "claude_desktop_config.json") });
  return list;
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; } }

// A client is "present" if its config file or its parent dir exists (i.e. installed).
function detect() {
  return clientConfigs().map((c) => {
    const fileExists = fs.existsSync(c.file);
    const present = fileExists || fs.existsSync(path.dirname(c.file));
    let installed = false;
    if (fileExists) { try { installed = !!(readJson(c.file).mcpServers || {})["resonance-memory"]; } catch { } }
    return { id: c.id, name: c.name, file: c.file, present, installed };
  });
}

function installOne(c) {
  const cfg = readJson(c.file);
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  cfg.mcpServers["resonance-memory"] = selfLaunch();
  fs.mkdirSync(path.dirname(c.file), { recursive: true });
  if (fs.existsSync(c.file)) fs.copyFileSync(c.file, c.file + ".bak");
  fs.writeFileSync(c.file, JSON.stringify(cfg, null, 2), "utf8");
  return { id: c.id, name: c.name, file: c.file, action: "connected" };
}

function uninstallOne(c) {
  if (!fs.existsSync(c.file)) return { id: c.id, name: c.name, action: "not-present" };
  const cfg = readJson(c.file);
  if (cfg.mcpServers && cfg.mcpServers["resonance-memory"]) {
    fs.copyFileSync(c.file, c.file + ".bak");
    delete cfg.mcpServers["resonance-memory"];
    fs.writeFileSync(c.file, JSON.stringify(cfg, null, 2), "utf8");
    return { id: c.id, name: c.name, action: "disconnected" };
  }
  return { id: c.id, name: c.name, action: "not-connected" };
}

function install(targetId) {
  const targets = detect().filter((c) => c.present && (!targetId || c.id === targetId));
  if (!targets.length) return { ok: false, results: [], message: "No supported AI app found (looked for LM Studio and Claude Desktop)." };
  return { ok: true, results: targets.map((c) => installOne(c)) };
}

function uninstall(targetId) {
  const targets = clientConfigs().filter((c) => !targetId || c.id === targetId);
  return { ok: true, results: targets.map((c) => uninstallOne(c)) };
}

module.exports = { detect, install, uninstall, selfLaunch, clientConfigs };
