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
 * build-exe.js — regenerate the single-file executable from the source files.
 *
 * Sources stay the editable truth. This re-bundles them into one per-OS binary.
 *
 *     node build-exe.js                  # this machine
 *     node build-exe.js --target linux   # refuse unless this process is Linux
 *     node build-exe.js --print-plan --target macos
 *
 * Pipeline: esbuild (bundle) -> Node SEA blob -> copy THIS process's node
 * runtime -> postject (inject blob) -> OS-specific finish (Windows PE
 * subsystem flip / macOS ad-hoc codesign / chmod +x) -> stage dist/.
 *
 * SEA injects into the host `node` binary. There is no cross-compile: a
 * Linux binary is built by a Linux node (WSL counts), a macOS binary by a
 * Mac. --target names the artifact and is a safety check, not a
 * cross-compiler. Node >= 22.5 is required (node:sqlite / SqliteStore).
 *
 * Signing: unsigned on purpose this slice (certs cost money). Windows
 * SmartScreen / macOS Gatekeeper will prompt; see docs/BUILDING.md.
 * macOS still gets a free ad-hoc `codesign --sign -` AFTER postject —
 * without it the kernel kills the binary as "code signature invalid".
 * That is not Developer ID / notarization.
 */
"use strict";

const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const MIN_NODE = { major: 22, minor: 5 };

const TARGETS = {
  win: {
    id: "win",
    hostPlatform: "win32",
    peFlip: true,
    macho: false,
    chmod: false,
    adhocSign: false,
    removeSignature: false,
  },
  linux: {
    id: "linux",
    hostPlatform: "linux",
    peFlip: false,
    macho: false,
    chmod: true,
    adhocSign: false,
    removeSignature: false,
  },
  macos: {
    id: "macos",
    hostPlatform: "darwin",
    peFlip: false,
    macho: true,
    chmod: true,
    adhocSign: true,
    removeSignature: true,
  },
};

const TARGET_ALIASES = {
  win: "win",
  windows: "win",
  win32: "win",
  linux: "linux",
  macos: "macos",
  mac: "macos",
  darwin: "macos",
  osx: "macos",
};

function archTag(arch) {
  if (arch === "x64" || arch === "x86_64") return "x64";
  if (arch === "arm64" || arch === "aarch64") return "arm64";
  return String(arch || "unknown");
}

function hostTargetId(platform) {
  if (platform === "win32") return "win";
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "macos";
  return null;
}

function artifactName(targetId, arch) {
  const spec = TARGETS[targetId];
  if (!spec) throw new Error("unknown target " + targetId);
  const a = archTag(arch);
  if (spec.id === "win") return "resonance-memory.exe";
  return "resonance-memory-" + spec.id + "-" + a;
}

function parseNodeVersion(v) {
  const m = String(v || "").replace(/^v/i, "").split(".");
  return { major: Number(m[0]) || 0, minor: Number(m[1]) || 0, patch: Number(m[2]) || 0 };
}

function nodeMeetsFloor(version, floor) {
  const want = floor || MIN_NODE;
  const v = typeof version === "string" ? parseNodeVersion(version) : version;
  if (v.major !== v.major) return false;
  if (v.major > want.major) return true;
  if (v.major < want.major) return false;
  return v.minor >= want.minor;
}

function parseArgs(argv) {
  const out = { target: null, help: false, printPlan: false };
  const args = Array.from(argv || []);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") {
      out.help = true;
      continue;
    }
    if (a === "--print-plan") {
      out.printPlan = true;
      continue;
    }
    if (a === "--target" || a === "-t") {
      const v = args[++i];
      if (!v) throw new Error("--target needs a value (win, linux, macos)");
      out.target = resolveTargetId(v);
      continue;
    }
    if (a.startsWith("--target=")) {
      out.target = resolveTargetId(a.slice("--target=".length));
      continue;
    }
    throw new Error("unknown argument: " + a + "\n" + usage());
  }
  return out;
}

function resolveTargetId(raw) {
  const id = TARGET_ALIASES[String(raw || "").toLowerCase()];
  if (!id) {
    throw new Error(
      "unknown --target " + raw + " (want win, linux, or macos)"
    );
  }
  return id;
}

function assertCanBuild(targetId, hostPlatform) {
  const spec = TARGETS[targetId];
  if (!spec) throw new Error("unknown --target " + targetId + " (want win, linux, or macos)");
  if (spec.hostPlatform !== hostPlatform) {
    throw new Error(
      "SEA cannot cross-compile. --target " + targetId + " must run on " +
      spec.hostPlatform + ", but this process is " + hostPlatform + ".\n" +
      "  Linux:  node build-exe.js --target linux   (WSL or a Linux box, Node >= 22.5)\n" +
      "  macOS:  node build-exe.js --target macos   (on a Mac; Node SEA CI tests arm64)\n" +
      "  Windows: node build-exe.js --target win\n" +
      "See docs/BUILDING.md."
    );
  }
}

function postjectArgs(outPath, blobPath, spec) {
  const args = [outPath, "NODE_SEA_BLOB", blobPath, "--sentinel-fuse", FUSE];
  if (spec && spec.macho) args.push("--macho-segment-name", "NODE_SEA");
  return args;
}

/*
 * Flip IMAGE_OPTIONAL_HEADER.Subsystem console(3) -> GUI(2) so a
 * double-click opens no console window. MCP is unaffected: the client
 * pipes stdin/stdout, and a GUI-subsystem process uses those redirected
 * handles fine — it just doesn't allocate a console when launched
 * interactively.
 *
 * Offset: e_lfanew + PE-sig(4) + COFF(20) + OptionalHeader.Subsystem (0x44)
 * is the same for PE32 and PE32+. Mutates `buf` in place. Never touches a
 * non-PE (the Linux/macOS failure signature this function exists to catch).
 */
function flipPeSubsystem(buf) {
  if (!buf || buf.length < 64) return { flipped: false, reason: "too-small" };
  if (buf[0] !== 0x4d || buf[1] !== 0x5a) return { flipped: false, reason: "not-pe" };
  const peOff = buf.readUInt32LE(0x3c);
  if (!Number.isFinite(peOff) || peOff < 0 || peOff + 94 > buf.length) {
    return { flipped: false, reason: "truncated" };
  }
  if (buf.toString("ascii", peOff, peOff + 4) !== "PE\0\0") {
    return { flipped: false, reason: "not-pe" };
  }
  const subOff = peOff + 92;
  const current = buf.readUInt16LE(subOff);
  if (current !== 3) return { flipped: false, reason: "subsystem-" + current };
  buf.writeUInt16LE(2, subOff);
  return { flipped: true, reason: "console-to-gui" };
}

function usage() {
  return [
    "Usage: node build-exe.js [--target win|linux|macos] [--print-plan]",
    "",
    "  --target      Platform to build for. Default: this machine.",
    "                SEA cannot cross-compile: --target must match this OS.",
    "                win     -> dist/resonance-memory.exe",
    "                linux   -> dist/resonance-memory-linux-<arch>",
    "                macos   -> dist/resonance-memory-macos-<arch>",
    "  --print-plan  Print the recipe for --target and exit (no inject).",
    "  --help        This text.",
    "",
    "Node >= 22.5 required (node:sqlite). See docs/BUILDING.md.",
  ].join("\n");
}

function shellQuote(p) {
  return "\"" + String(p).replace(/"/g, "\\\"") + "\"";
}

function firstRunBlurb(spec, name) {
  if (spec.id === "win") {
    return [
      "Windows: double-click " + name + ". No console window — that's on purpose.",
      "SmartScreen: More info -> Run anyway. The binary is unsigned (certs cost money).",
      "MCP:  " + name + " --mcp",
    ].join("\n");
  }
  if (spec.id === "linux") {
    return [
      "Linux:",
      "  chmod +x " + name,
      "  ./" + name,
      "If 'Permission denied' after chmod: the execute bit often does not stick on",
      "/mnt/c (WSL). Copy the file to your Linux home and chmod +x there.",
      "If 'cannot execute binary file': you grabbed a Windows/macOS build, or the wrong arch.",
      "MCP:  ./" + name + " --mcp",
    ].join("\n");
  }
  return [
    "macOS (unsigned / ad-hoc signed — Gatekeeper will ask):",
    "  Right-click -> Open -> Open",
    "  or: System Settings -> Privacy & Security -> Open Anyway",
    "  or: xattr -d com.apple.quarantine " + name,
    "Then:",
    "  chmod +x " + name,
    "  ./" + name,
    "MCP:  ./" + name + " --mcp",
  ].join("\n");
}

function distReadmeText(opts) {
  const { spec, artifact, nodeVersion, arch, files } = opts;
  const listed = (files && files.length) ? files : [artifact];
  const lines = [
    "Resonance Memory — shippable binaries",
    "",
    "Each file is a single-OS, single-arch executable. Node is baked in;",
    "the person who runs it does not install Node. Grabbing the file for a",
    "different OS (or a different CPU) will not work — that is not a bug.",
    "",
    "Files in this folder:",
  ];
  for (const f of listed) {
    lines.push("  " + f + (f === artifact ? "    <-- just built" : ""));
  }
  lines.push("");
  lines.push("This build: " + spec.id + " " + archTag(arch) + "   Node " + nodeVersion);
  lines.push("SEA is per-platform. A Linux binary is built on Linux; macOS on a Mac.");
  lines.push("");
  lines.push(firstRunBlurb(spec, artifact));
  lines.push("");
  lines.push("Full build / Gatekeeper notes: docs/BUILDING.md");
  lines.push("Code signing / notarization is a named future item (RM-11 remainder).");
  lines.push("");
  return lines.join("\n") + "\n";
}

function printPlan(spec, opts) {
  const host = opts.hostPlatform;
  const hostArch = opts.hostArch;
  const matches = spec.hostPlatform === host;
  const name = matches ? artifactName(spec.id, hostArch) : "resonance-memory-" + spec.id + "-<arch>";
  const plan = {
    target: spec.id,
    hostMustBe: spec.hostPlatform,
    thisHost: host,
    thisArch: archTag(hostArch),
    wouldBuild: matches,
    artifact: name,
    peFlip: !!spec.peFlip,
    machoSegment: spec.macho ? "NODE_SEA" : null,
    chmod: !!spec.chmod,
    adhocSign: !!spec.adhocSign,
    removeSignature: !!spec.removeSignature,
    nodeFloor: ">= 22.5",
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!matches) {
    console.log("\nWould refuse to build on this host (SEA cannot cross-compile).");
  }
}

function main(argv, env) {
  const args = parseArgs(argv || process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const hostPlatform = (env && env.platform) || process.platform;
  const hostArch = (env && env.arch) || process.arch;
  const hostNode = (env && env.nodeVersion) || process.version;
  const targetId = args.target || hostTargetId(hostPlatform);
  if (!targetId || !TARGETS[targetId]) {
    throw new Error("unsupported platform: " + hostPlatform + " (want win32, linux, or darwin)");
  }
  const spec = TARGETS[targetId];

  if (args.printPlan) {
    printPlan(spec, { hostPlatform, hostArch });
    return 0;
  }

  assertCanBuild(targetId, hostPlatform);

  if (!nodeMeetsFloor(hostNode, MIN_NODE)) {
    throw new Error(
      "Node >= 22.5 required (node:sqlite / the default SqliteStore). This process is " +
      hostNode + ". Install a current Node (24.x is what we test on Windows) and retry."
    );
  }

  if (spec.id === "macos" && archTag(hostArch) === "x64") {
    console.warn(
      "WARNING: Node SEA CI currently tests macOS arm64 only and skips x64.\n" +
      "         The Intel binary may not run. Prefer Apple Silicon."
    );
  }

  const dir = __dirname;
  const build = path.join(dir, "build");
  fs.mkdirSync(build, { recursive: true });

  const exeName = artifactName(spec.id, hostArch);
  const outExe = path.join(build, exeName);
  const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: dir });

  console.log("[0/5] embedding runtime assets (demo seed, system prompt) ...");
  const readOr = (f) => {
    const p = path.join(dir, f);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  };
  fs.writeFileSync(
    path.join(dir, "embedded-assets.js"),
    "// GENERATED by build-exe.js - do not edit; regenerated every build.\n" +
    "module.exports = {\n" +
    "  demoSeed: " + JSON.stringify(readOr("demo-seed.jsonl")) + ",\n" +
    "  systemPrompt: " + JSON.stringify(readOr("system-prompt.md")) + "\n};\n"
  );

  console.log("[1/5] bundling sources with esbuild ...");
  // --legal-comments=none drops the per-file AGPL header that sits atop every source,
  // so the bundle isn't peppered with a dozen identical notices. We add ONE notice
  // back as a top-of-file banner below.
  const bundleFile = path.join(build, "bundle.js");
  run(
    "npx --yes esbuild " + shellQuote(path.join(dir, "entry.js")) +
    " --bundle --platform=node --target=node22 --legal-comments=none --outfile=" +
    shellQuote(bundleFile)
  );

  const licenseBanner =
    "/*\n" +
    " * Resonance Memory\n" +
    " * Copyright (C) 2026 Samuel Jackson Grim\n" +
    " *\n" +
    " * This program is free software: you can redistribute it and/or modify\n" +
    " * it under the terms of the GNU Affero General Public License as published by\n" +
    " * the Free Software Foundation, either version 3 of the License, or\n" +
    " * (at your option) any later version.\n" +
    " *\n" +
    " * This program is distributed in the hope that it will be useful,\n" +
    " * but WITHOUT ANY WARRANTY; without even the implied warranty of\n" +
    " * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n" +
    " * GNU Affero General Public License for more details.\n" +
    " *\n" +
    " * You should have received a copy of the GNU Affero General Public License\n" +
    " * along with this program.  If not, see <https://www.gnu.org/licenses/>.\n" +
    " */\n";
  let bundled = fs.readFileSync(bundleFile, "utf8");
  bundled = bundled.replace(/\/\*\r?\n \* Resonance Memory\r?\n[\s\S]*?www\.gnu\.org\/licenses\/>\.\r?\n \*\/\r?\n?/g, "");
  fs.writeFileSync(bundleFile, licenseBanner + bundled);

  console.log("[2/5] generating SEA blob ...");
  run(
    shellQuote(process.execPath) + " --experimental-sea-config " +
    shellQuote(path.join(dir, "sea-config.json"))
  );

  console.log("[3/5] copying the node runtime -> " + exeName + " ...");
  if (fs.existsSync(outExe)) fs.rmSync(outExe);
  fs.copyFileSync(process.execPath, outExe);

  if (spec.removeSignature) {
    console.log("      codesign --remove-signature (macOS: postject needs a clean binary)");
    try {
      execFileSync("codesign", ["--remove-signature", outExe], { stdio: "inherit" });
    } catch (e) {
      console.warn("      codesign --remove-signature: " + (e && e.message || e) + " (continuing)");
    }
  }

  console.log("[4/5] injecting blob (postject) ...");
  const blob = path.join(build, "sea-prep.blob");
  const injectArgs = postjectArgs(outExe, blob, spec);
  run("npx --yes postject " + injectArgs.map(shellQuote).join(" "));

  if (spec.peFlip) {
    const buf = fs.readFileSync(outExe);
    const result = flipPeSubsystem(buf);
    if (result.flipped) {
      fs.writeFileSync(outExe, buf);
      console.log("      subsystem flipped console -> GUI (no console window on double-click)");
    } else if (result.reason === "not-pe" || result.reason === "too-small" || result.reason === "truncated") {
      throw new Error(
        "PE subsystem flip requested, but " + outExe + " is not a PE (" + result.reason + "). " +
        "Refusing to mutate a non-Windows binary."
      );
    } else {
      console.log("      PE subsystem left as-is (" + result.reason + ")");
    }
  }

  if (spec.adhocSign) {
    console.log("      codesign --sign - --force (ad-hoc; not Developer ID / notarization)");
    execFileSync("codesign", ["--sign", "-", "--force", outExe], { stdio: "inherit" });
  }

  if (spec.chmod) {
    fs.chmodSync(outExe, 0o755);
  }

  const mb = (fs.statSync(outExe).size / 1048576).toFixed(0);
  console.log("\nDone -> " + outExe + "  (" + mb + " MB)");

  // Stage dist/ without wiping other OS artifacts. Building Windows then
  // Linux in WSL should leave both files sitting next to each other.
  console.log("[5/5] staging dist/ (the shippable bundle) ...");
  const dist = path.join(dir, "dist");
  fs.mkdirSync(dist, { recursive: true });
  const distFile = path.join(dist, exeName);
  if (fs.existsSync(distFile)) fs.rmSync(distFile);
  fs.copyFileSync(outExe, distFile);
  if (spec.chmod) fs.chmodSync(distFile, 0o755);

  const siblings = fs.readdirSync(dist).filter((f) => /^resonance-memory/i.test(f));
  fs.writeFileSync(
    path.join(dist, "README.txt"),
    distReadmeText({
      spec,
      artifact: exeName,
      nodeVersion: hostNode,
      arch: hostArch,
      files: siblings,
    })
  );
  console.log("Staged the single-file distributable -> " + distFile);
  console.log("\n" + firstRunBlurb(spec, exeName));
  console.log('\nTest:  "' + distFile + '" --mcp   (MCP server)   |   "' + distFile + '"   (control panel)');
  return 0;
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
  TARGETS,
  MIN_NODE,
  FUSE,
  archTag,
  hostTargetId,
  artifactName,
  parseNodeVersion,
  nodeMeetsFloor,
  parseArgs,
  resolveTargetId,
  assertCanBuild,
  postjectArgs,
  flipPeSubsystem,
  distReadmeText,
  usage,
  main,
};
