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
 * ci/smoke-exe.js — MCP smoke for a just-built SEA binary (RM-11 release CI).
 *
 *     node ci/smoke-exe.js dist/resonance-memory.exe
 *     node ci/smoke-exe.js dist/resonance-memory-linux-x64 --timeout-ms 20000
 *
 * Spawns `<binary> --mcp`, feeds initialize + tools/list over stdin, asserts
 * serverInfo.name === "resonance-memory" and that tools/list is exactly the
 * four verbs. Then KILLS the child.
 *
 * Why a helper instead of `printf | binary --mcp`:
 *   The MCP server does not exit on stdin EOF (it is a long-lived stdio
 *   loop). A pipe-and-wait smoke hangs forever. A failed smoke must fail
 *   the job — a red binary must never reach a Release — so the timeout
 *   and the kill are the load-bearing bits, not a courtesy.
 *
 * Isolated store (MEMORY_FILE_PATH in a tmpdir) so CI does not touch the
 * runner's real ~/.lmstudio tree. Windows GUI-subsystem binaries still
 * speak stdio when spawned with pipes (same as an MCP client).
 *
 * Not a fifth MCP verb. Not on the recall path. Zero runtime deps.
 */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_TIMEOUT_MS = 20000;
const EXPECTED_TOOLS = ["delete_memory", "edit_memory", "recall_memory", "save_memory"];
const INIT_ID = 1;
const LIST_ID = 2;

function usage() {
  return [
    "Usage: node ci/smoke-exe.js <binary> [--timeout-ms 20000]",
    "",
    "  Spawns <binary> --mcp, sends initialize + tools/list, asserts",
    "  serverInfo.name is resonance-memory and tools/list is exactly the",
    "  four verbs, then kills the child. A hang is a failure (timeout).",
    "",
    "  Exit 0 on a green smoke; 1 on any failure. Used by the RM-11",
    "  release workflow; a red smoke must not reach a GitHub Release.",
  ].join("\n");
}

function parseArgs(argv) {
  const out = { bin: null, timeoutMs: DEFAULT_TIMEOUT_MS, help: false };
  const args = Array.from(argv || []);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") {
      out.help = true;
      continue;
    }
    if (a === "--timeout-ms" || a === "--timeout") {
      const v = args[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error("--timeout-ms needs a positive number");
      out.timeoutMs = n;
      continue;
    }
    if (a.startsWith("--timeout-ms=")) {
      const n = Number(a.slice("--timeout-ms=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error("--timeout-ms needs a positive number");
      out.timeoutMs = n;
      continue;
    }
    if (a.startsWith("-")) throw new Error("unknown argument: " + a + "\n" + usage());
    if (out.bin) throw new Error("unexpected extra argument: " + a + "\n" + usage());
    out.bin = a;
  }
  return out;
}

function parseJsonRpcLines(buf) {
  const msgs = [];
  for (const line of String(buf || "").split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") msgs.push(obj);
    } catch {
      /* MCP stdout is line-delimited JSON-RPC; ignore a partial last line. */
    }
  }
  return msgs;
}

function summarizeMsgs(msgs) {
  return (msgs || []).map((m) => {
    if (m && m.error) return "id=" + m.id + " error=" + JSON.stringify(m.error);
    if (m && m.result && m.result.serverInfo) {
      return "id=" + m.id + " initialize name=" + m.result.serverInfo.name;
    }
    if (m && m.result && Array.isArray(m.result.tools)) {
      return "id=" + m.id + " tools=" + m.result.tools.map((t) => t && t.name).join(",");
    }
    return "id=" + (m && m.id) + " method=" + (m && m.method);
  }).join("; ");
}

function assertSmoke(msgs, opts) {
  opts = opts || {};
  const list = Array.isArray(msgs) ? msgs : [];
  const rpcErr = list.find((m) => m && m.error);
  if (rpcErr) {
    throw new Error("json-rpc error: " + JSON.stringify(rpcErr.error) + " (" + summarizeMsgs(list) + ")");
  }
  const init = list.find((m) => m && m.id === INIT_ID && m.result);
  if (!init) {
    throw new Error("no initialize result (id=" + INIT_ID + "); got: " + summarizeMsgs(list));
  }
  const info = (init.result && init.result.serverInfo) || {};
  if (info.name !== "resonance-memory") {
    throw new Error("serverInfo.name is " + JSON.stringify(info.name) + ", want \"resonance-memory\"");
  }
  if (opts.expectedVersion != null && info.version !== opts.expectedVersion) {
    throw new Error(
      "serverInfo.version is " + JSON.stringify(info.version) +
      ", want " + JSON.stringify(opts.expectedVersion)
    );
  }
  const listed = list.find((m) => m && m.id === LIST_ID && m.result);
  if (!listed) {
    throw new Error("no tools/list result (id=" + LIST_ID + "); got: " + summarizeMsgs(list));
  }
  const tools = (listed.result && listed.result.tools) || [];
  const names = tools.map((t) => t && t.name).filter(Boolean).slice().sort();
  const want = EXPECTED_TOOLS.slice().sort();
  if (names.join("\0") !== want.join("\0")) {
    throw new Error(
      "tools/list is [" + names.join(", ") + "], want exactly the four verbs [" + want.join(", ") + "]"
    );
  }
  return { serverInfo: info, tools: tools };
}

function initRequest() {
  return {
    jsonrpc: "2.0",
    id: INIT_ID,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rm-ci-smoke", version: "0" },
    },
  };
}

function listRequest() {
  return { jsonrpc: "2.0", id: LIST_ID, method: "tools/list", params: {} };
}

function killChild(child) {
  if (!child || child.killed) return;
  if (child.exitCode != null || child.signalCode) return;
  try { child.kill("SIGKILL"); } catch { /* already gone */ }
}

function waitExit(child, ms) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null || child.signalCode) return resolve();
    const t = setTimeout(resolve, ms);
    child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function rmTmp(dir) {
  if (!dir) return;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still be unlocking */ }
}

/*
 * Spawn `bin` with `args` (default ["--mcp"]), send the two JSON-RPC
 * lines, assert, kill. Always settles: the timeout is the hang-guard
 * that makes this safe to put on a CI job.
 */
function smoke(bin, opts) {
  opts = opts || {};
  const args = opts.args || ["--mcp"];
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const binPath = path.resolve(String(bin));
  if (!fs.existsSync(binPath)) {
    return Promise.reject(new Error("binary not found: " + binPath));
  }
  if (fs.statSync(binPath).isDirectory()) {
    return Promise.reject(new Error("binary path is a directory: " + binPath));
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rm-smoke-"));
  const storePath = path.join(tmpDir, "memories.jsonl");
  const configPath = path.join(tmpDir, "resonance-memory.config.json");

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let child;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killChild(child);
      waitExit(child, 1000).then(() => {
        rmTmp(tmpDir);
        if (err) reject(err);
        else resolve(result);
      });
    };

    const timer = setTimeout(() => {
      finish(new Error(
        "smoke timeout after " + timeoutMs + "ms waiting on --mcp JSON-RPC " +
        "(initialize + tools/list). A hang here used to ship a red binary.\n" +
        "stderr:\n" + stderr + "\nstdout:\n" + stdout
      ));
    }, timeoutMs);

    try {
      child = spawn(binPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: Object.assign({}, process.env, {
          MEMORY_FILE_PATH: storePath,
          RESONANCE_MEMORY_CONFIG: configPath,
        }),
        windowsHide: true,
      });
    } catch (e) {
      finish(new Error("spawn failed: " + (e && e.message || e)));
      return;
    }

    child.on("error", (e) => {
      finish(new Error("spawn error: " + (e && e.message || e)));
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      try {
        const result = assertSmoke(parseJsonRpcLines(stdout), opts);
        finish(null, result);
      } catch {
        /* incomplete so far */
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    child.on("exit", (code, sig) => {
      if (settled) return;
      try {
        const result = assertSmoke(parseJsonRpcLines(stdout), opts);
        finish(null, result);
      } catch (e) {
        finish(new Error(
          "process exited before a valid smoke (code=" + code + " signal=" + sig + "): " +
          e.message + "\nstderr:\n" + stderr + "\nstdout:\n" + stdout
        ));
      }
    });

    const payload = JSON.stringify(initRequest()) + "\n" + JSON.stringify(listRequest()) + "\n";
    try {
      child.stdin.write(payload);
      child.stdin.end();
    } catch (e) {
      finish(new Error("stdin write failed: " + (e && e.message || e) + "\nstderr:\n" + stderr));
    }
  });
}

async function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (!args.bin) {
    console.error(usage());
    return 2;
  }
  const pkg = require(path.join(__dirname, "..", "package.json"));
  const result = await smoke(args.bin, {
    timeoutMs: args.timeoutMs,
    expectedVersion: pkg.version,
  });
  const verbs = (result.tools || []).map((t) => t.name).sort().join(", ");
  console.log("smoke ok  name=" + result.serverInfo.name +
    " version=" + result.serverInfo.version +
    " tools=[" + verbs + "]");
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    if (code) process.exit(code);
  }).catch((e) => {
    console.error(String(e && e.message || e));
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  EXPECTED_TOOLS,
  INIT_ID,
  LIST_ID,
  parseArgs,
  parseJsonRpcLines,
  assertSmoke,
  initRequest,
  listRequest,
  smoke,
  usage,
  main,
};
