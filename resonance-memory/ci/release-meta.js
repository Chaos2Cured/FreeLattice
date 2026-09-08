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
 * ci/release-meta.js — tag/package.json gate, runner asserts, checksums,
 * release notes for the RM-11 GitHub Actions matrix.
 *
 *     node ci/release-meta.js check-tag v0.2.0
 *     node ci/release-meta.js assert-runner --arch x64
 *     node ci/release-meta.js sha256sums --dir dist --out dist/SHA256SUMS \
 *         --expect resonance-memory.exe,resonance-memory-linux-x64,resonance-memory-macos-arm64
 *     node ci/release-meta.js notes --tag v0.2.0 --out NOTES.md
 *
 * Tag policy (so an rc tag is safe to push without bumping package.json):
 *   package.json 0.2.0 + tag v0.2.0       → full release
 *   package.json 0.2.0 + tag v0.2.0-rc1   → prerelease (core matches)
 *   package.json 0.2.0 + tag v0.3.0       → FAIL (dirty version)
 *   package.json 0.2.0-rc1 + tag v0.2.0-rc1 → prerelease (exact match)
 *
 * stdout of check-tag is GITHUB_OUTPUT lines (version=, prerelease=).
 * Human detail goes to stderr so `>> $GITHUB_OUTPUT` stays clean.
 *
 * Zero runtime deps. Not on the recall path.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { nodeMeetsFloor, artifactName } = require("../build-exe.js");

const RELEASE_ASSETS = [
  artifactName("win", "x64"),
  artifactName("linux", "x64"),
  artifactName("macos", "arm64"),
];

const REPO_BLOB = "https://github.com/SamuelJacksonGrim/resonance-memory/blob";
const REPO_HOME = "https://github.com/SamuelJacksonGrim/resonance-memory";

function usage() {
  return [
    "Usage: node ci/release-meta.js <command> [args]",
    "",
    "  check-tag <tag>              package.json vs tag; stdout is GITHUB_OUTPUT",
    "  assert-runner --arch <arch>  Node >= 22.5 and process.arch matches",
    "  sha256sums --dir D --out F --expect a,b,c",
    "  notes --tag <tag> --out F    GitHub Release body",
    "  --help",
  ].join("\n");
}

function parseSemver(raw) {
  const s = String(raw || "").trim();
  const m = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(s);
  if (!m) return null;
  return { core: m[1], prerelease: m[2] || null, raw: s };
}

function parseReleaseTag(tag) {
  const s = String(tag || "").trim();
  if (!s) throw new Error("empty tag");
  if (!/^v/.test(s)) {
    throw new Error("tag " + JSON.stringify(s) + " must start with v (want v0.2.0 or v0.2.0-rc1)");
  }
  const body = s.slice(1);
  const parsed = parseSemver(body);
  if (!parsed) {
    throw new Error(
      "tag " + JSON.stringify(s) + " is not v<semver> (want v0.2.0 or v0.2.0-rc1)"
    );
  }
  return { tag: s, version: parsed.core, prerelease: parsed.prerelease, body: parsed.raw };
}

function assertTagMatchesPackage(tag, pkgVersion) {
  const parsed = parseReleaseTag(tag);
  const pkg = parseSemver(pkgVersion);
  if (!pkg) {
    throw new Error("package.json version " + JSON.stringify(pkgVersion) + " is not semver");
  }
  if (pkg.core !== parsed.version) {
    throw new Error(
      "tag " + parsed.tag + " is version " + parsed.version +
      " but package.json is " + pkgVersion + ". Bump package.json (the release-tag source) first."
    );
  }
  if (pkg.prerelease && parsed.body !== pkg.raw) {
    throw new Error(
      "package.json is " + pkgVersion + " (a prerelease); tag must match exactly, got " + parsed.tag
    );
  }
  return {
    tag: parsed.tag,
    version: pkg.raw,
    core: parsed.version,
    prerelease: !!(parsed.prerelease || pkg.prerelease),
    prereleaseId: parsed.prerelease || pkg.prerelease || null,
  };
}

function checkTagToGithubOutput(tag, pkgVersion) {
  const r = assertTagMatchesPackage(tag, pkgVersion);
  const lines = [
    "version=" + r.version,
    "prerelease=" + (r.prerelease ? "true" : "false"),
  ];
  const human = r.prerelease
    ? "tag " + r.tag + " matches package.json " + r.version + " (prerelease" +
      (r.prereleaseId ? " " + r.prereleaseId : "") + ")"
    : "tag " + r.tag + " matches package.json " + r.version;
  return { stdout: lines.join("\n") + "\n", stderr: human + "\n", result: r };
}

function assertRunner(opts) {
  opts = opts || {};
  const ver = opts.nodeVersion || process.version;
  const arch = opts.arch || process.arch;
  const platform = opts.platform || process.platform;
  if (!nodeMeetsFloor(ver)) {
    throw new Error(
      "Node >= 22.5 required (node:sqlite / the default SqliteStore). This process is " +
      ver + ". setup-node must pin 24.x (what we test on Windows), never a floating 20/18."
    );
  }
  if (opts.expectArch && arch !== opts.expectArch) {
    throw new Error(
      "runner arch is " + arch + ", expected " + opts.expectArch +
      " (platform " + platform + "). A macos-latest flip away from arm64 would silently " +
      "ship resonance-memory-macos-x64 under the arm64 name we advertise. Failing loud."
    );
  }
  return { nodeVersion: ver, arch: arch, platform: platform };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeSha256Sums(opts) {
  const dir = opts.dir;
  const outPath = opts.out;
  const expect = Array.isArray(opts.expect) ? opts.expect.slice() : RELEASE_ASSETS.slice();
  if (!dir) throw new Error("sha256sums: --dir is required");
  if (!outPath) throw new Error("sha256sums: --out is required");
  const missing = [];
  const lines = [];
  for (const name of expect) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      missing.push(name);
      continue;
    }
    lines.push(sha256File(p) + "  " + name);
  }
  if (missing.length) {
    const present = fs.existsSync(dir) ? fs.readdirSync(dir).join(", ") : "(no dir)";
    throw new Error(
      "release is missing " + missing.join(", ") + " in " + dir +
      " (present: " + present + "). Refusing a partial Release."
    );
  }
  lines.sort((a, b) => a.split("  ")[1].localeCompare(b.split("  ")[1]));
  const text = lines.join("\n") + "\n";
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, text);
  return text;
}

function releaseNotes(opts) {
  const tag = opts.tag;
  const meta = opts.meta || assertTagMatchesPackage(tag, opts.pkgVersion);
  const blob = REPO_BLOB + "/" + encodeURIComponent(tag);
  const building = blob + "/docs/BUILDING.md";
  const lines = [];
  lines.push("# Resonance Memory " + meta.version);
  lines.push("");
  if (meta.prerelease) {
    lines.push(
      "This is a **pre-release** (`" + meta.tag + "`). It exists to prove the CI " +
      "release matrix — three native binaries, smoked on their own runners — before " +
      "a stable tag. Treat it as a CI exercise unless you were asked to try it."
    );
    lines.push("");
  }
  lines.push(
    "**A lasting, private memory for your local AI.** It remembers *you* across " +
    "conversations, learns how your memories connect, and never leaves your machine — " +
    "free, local-only, no account, AGPL-3.0."
  );
  lines.push("");
  lines.push(
    "New here? This page is just the download. Start with the **[full walkthrough — " +
    "what it is, what it does, and 60-second setup](" + REPO_HOME + "#readme)**."
  );
  lines.push("");
  lines.push(
    "Single-file executables — one file per OS. Node is baked in; you do **not** need " +
    "to install Node prior to download. Grab the file for *your* OS and CPU — a Linux " +
    "binary will not run on Windows, and that is not a bug."
  );
  lines.push("");
  lines.push("## Downloads");
  lines.push("");
  lines.push("| File | Runs on |");
  lines.push("|---|---|");
  lines.push("| `resonance-memory.exe` | Windows x64 |");
  lines.push("| `resonance-memory-linux-x64` | Linux x64 (glibc; **not Alpine / musl**) |");
  lines.push("| `resonance-memory-macos-arm64` | macOS Apple Silicon (arm64) |");
  lines.push("");
  lines.push("Checksums: `SHA256SUMS` (GNU `sha256sum -c SHA256SUMS`).");
  lines.push("");
  lines.push("No Intel Mac build. Node's own SEA CI tests macOS arm64 and skips x64;");
  lines.push("we are not going to ship the under-tested one until there is demand *and*");
  lines.push("Node says it works.");
  lines.push("");
  lines.push("## First launch (unsigned)");
  lines.push("");
  lines.push(
    "These binaries are **unsigned**. Code signing / notarization is a named future " +
    "item (the rest of RM-11); certs cost money. CI cannot silence Gatekeeper or " +
    "SmartScreen. The OS will warn. That is honest, not a hack we are hiding."
  );
  lines.push("");
  lines.push("- **Windows SmartScreen** (\"Windows protected your PC\"): **More info → Run anyway**.");
  lines.push("- **macOS Gatekeeper:** Right-click → **Open** → **Open**, or System Settings → Privacy & Security → **Open Anyway**, or `xattr -d com.apple.quarantine resonance-memory-macos-arm64`. Then `chmod +x`.");
  lines.push("- **Linux:** `chmod +x resonance-memory-linux-x64 && ./resonance-memory-linux-x64`. If `Permission denied` after chmod, the execute bit may not stick on some mounts — copy the file somewhere executable (`~/bin`). Not Alpine.");
  lines.push("");
  lines.push("Full notes, including how to build from source: [`docs/BUILDING.md`](" + building + ").");
  lines.push("");
  lines.push("## What this is");
  lines.push("");
  lines.push(
    "Your local model forgets everything the moment you close the chat — your name, " +
    "your preferences, the decision you explained yesterday. Resonance gives it a " +
    "memory that survives across conversations, stored entirely on your computer. Your " +
    "AI only ever sees four verbs (`save` / `recall` / `edit` / `delete`); all the " +
    "sophistication — meaning-based recall, an associative field that learns which of " +
    "your memories belong together, entity/polarity discrimination — lives underneath, " +
    "so even a small model can't misuse it."
  );
  lines.push("");
  lines.push("- **Double-click** (or run the binary) → the control panel opens at `http://127.0.0.1:9090/`.");
  lines.push("- **`--mcp`** is what an AI client (LM Studio, Claude Desktop) launches to get the memory.");
  lines.push("- **`--export` / `--import`** carry your whole memory between machines — it's yours to keep.");
  lines.push("");
  lines.push(
    "**Full setup walkthrough, what it can do, and the design:** " +
    "[README](" + REPO_HOME + "#readme). Build from source: [`docs/BUILDING.md`](" + building + ")."
  );
  lines.push("");
  return lines.join("\n") + "\n";
}

function readPkgVersion() {
  return require(path.join(__dirname, "..", "package.json")).version;
}

function parseCli(argv) {
  const args = Array.from(argv || []);
  const out = { cmd: null, tag: null, arch: null, dir: null, out: null, expect: null, help: false };
  if (!args.length || args[0] === "-h" || args[0] === "--help") {
    out.help = true;
    return out;
  }
  out.cmd = args[0];
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") { out.help = true; continue; }
    if (a === "--arch") { out.arch = args[++i]; continue; }
    if (a.startsWith("--arch=")) { out.arch = a.slice("--arch=".length); continue; }
    if (a === "--dir") { out.dir = args[++i]; continue; }
    if (a.startsWith("--dir=")) { out.dir = a.slice("--dir=".length); continue; }
    if (a === "--out") { out.out = args[++i]; continue; }
    if (a.startsWith("--out=")) { out.out = a.slice("--out=".length); continue; }
    if (a === "--tag") { out.tag = args[++i]; continue; }
    if (a.startsWith("--tag=")) { out.tag = a.slice("--tag=".length); continue; }
    if (a === "--expect") { out.expect = args[++i]; continue; }
    if (a.startsWith("--expect=")) { out.expect = a.slice("--expect=".length); continue; }
    if (a.startsWith("-")) throw new Error("unknown argument: " + a + "\n" + usage());
    if (out.cmd === "check-tag" && !out.tag) { out.tag = a; continue; }
    throw new Error("unexpected extra argument: " + a + "\n" + usage());
  }
  return out;
}

function main(argv) {
  const args = parseCli(argv || process.argv.slice(2));
  if (args.help && !args.cmd) {
    console.log(usage());
    return 0;
  }
  const cmd = args.cmd;
  if (cmd === "check-tag") {
    if (!args.tag) throw new Error("check-tag needs a tag (v0.2.0)\n" + usage());
    const io = checkTagToGithubOutput(args.tag, readPkgVersion());
    process.stdout.write(io.stdout);
    process.stderr.write(io.stderr);
    return 0;
  }
  if (cmd === "assert-runner") {
    const r = assertRunner({ expectArch: args.arch || null });
    console.log("node " + r.nodeVersion + " arch " + r.arch + " platform " + r.platform);
    return 0;
  }
  if (cmd === "sha256sums") {
    const expect = args.expect
      ? String(args.expect).split(",").map((s) => s.trim()).filter(Boolean)
      : RELEASE_ASSETS;
    const text = writeSha256Sums({ dir: args.dir, out: args.out, expect: expect });
    process.stderr.write(text);
    return 0;
  }
  if (cmd === "notes") {
    if (!args.tag) throw new Error("notes needs --tag\n" + usage());
    if (!args.out) throw new Error("notes needs --out\n" + usage());
    const text = releaseNotes({ tag: args.tag, pkgVersion: readPkgVersion() });
    fs.writeFileSync(args.out, text);
    return 0;
  }
  throw new Error("unknown command: " + cmd + "\n" + usage());
}

if (require.main === module) {
  try {
    const code = main();
    if (code) process.exit(code);
  } catch (e) {
    console.error(String(e && e.message || e));
    process.exit(1);
  }
}

module.exports = {
  RELEASE_ASSETS,
  parseSemver,
  parseReleaseTag,
  assertTagMatchesPackage,
  checkTagToGithubOutput,
  assertRunner,
  sha256File,
  writeSha256Sums,
  releaseNotes,
  parseCli,
  usage,
  main,
};
