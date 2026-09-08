# Building and running Resonance Memory

Resonance Memory ships as a **single self-contained executable** per operating
system (~90 MB). The person who runs it does **not** install Node. Node is
baked in by a [Node SEA](https://nodejs.org/api/single-executable-applications.html)
build: we bundle the sources, inject them into a copy of the `node` binary
used to build, and hand that file out.

SEA is **per-platform and per-arch**. A Linux binary is built by a Linux
Node, a macOS binary by a Mac Node, a Windows `.exe` by a Windows Node.
There is no clean cross-compile. `--target` names the artifact and refuses
to run on the wrong OS; it is not a cross-compiler.

| File in `dist/` | Built on | Runs on |
|---|---|---|
| `resonance-memory.exe` | Windows | Windows (same arch, typically x64) |
| `resonance-memory-linux-x64` | Linux / WSL | Linux x64 |
| `resonance-memory-linux-arm64` | Linux aarch64 | Linux arm64 |
| `resonance-memory-macos-arm64` | a Mac (Apple Silicon) | macOS arm64 |
| `resonance-memory-macos-x64` | a Mac (Intel) | macOS x64 — see the Intel caveat below |

Grabbing the file for a different OS (or a different CPU) will not work.
That is not a bug. Windows will say it is not a valid Win32 application;
Linux will say `cannot execute binary file: Exec format error`.

The binaries are **unsigned**. Code signing / notarization is a named
future item (the rest of `RM-11`); certs cost money we are not spending
on this slice. Each OS will warn on first launch. The workarounds are
below, and they are honest, not a hack we are hiding.

---

## Build from source (any OS)

Need **Node ≥ 22.5** (24.x is what we test on Windows). The default store
is SQLite via built-in `node:sqlite`, which does not exist before 22.5.
`npx` must work — the build fetches `esbuild` and `postject` at build
time and never adds them to `package.json` (zero runtime dependencies).

```
node --version          # v22.5.0 or newer
node build-exe.js       # this machine; writes dist/<artifact>
```

`--target` is optional and defaults to this OS:

```
node build-exe.js --target win
node build-exe.js --target linux
node build-exe.js --target macos
node build-exe.js --print-plan --target macos   # recipe only, no inject
```

A mismatched `--target` exits with a clear error. That is the
cross-compile refusal.

`dist/` is **not** wiped on each run, so a Windows build followed by a
WSL Linux build leaves both artifacts sitting next to each other.
`dist/README.txt` describes whatever was just built.

The Windows PE-subsystem flip (console → GUI, so double-click opens no
console window) runs **only** when building Windows on Windows. It
refuses to touch a non-PE file.

---

## Linux (including WSL)

On this workshop box the Linux binary is built inside Ubuntu 24.04:

```
wsl.exe -d Ubuntu-24.04 bash -lc 'cd /path/to/resonance-memory && node build-exe.js --target linux'
```

On a native Linux box, the same `node build-exe.js --target linux` is
enough. Result: `dist/resonance-memory-linux-x64` (or `-arm64`).

Run it:

```
chmod +x dist/resonance-memory-linux-x64
./dist/resonance-memory-linux-x64
```

The control panel binds `127.0.0.1:9090`. `--mcp` speaks JSON-RPC on
stdio. `--export` / `--import` work the same as on Windows.

**`chmod +x` and WSL `/mnt/c`:** the execute bit often does not stick on
the Windows filesystem. If you get `Permission denied` after chmod, copy
the file into the Linux home (`cp dist/resonance-memory-linux-x64 ~/`)
and chmod +x there.

**`noexec` mounts / downloaded files:** some distros mount `~/Downloads`
`noexec`. Move the binary somewhere executable (`~/bin`) rather than
fighting the mount.

A Linux user does not need Node, `npx`, or this repo — only the binary
and `chmod +x`. Node is only needed to *build*.

---

## GitHub Actions release matrix (how a stranger gets a binary)

Pushing a `v*` tag (for example `v0.2.0`, or `v0.2.0-rc1` to prove the
pipeline) runs [`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **Gate** on `ubuntu-latest` (Node 24): `node test.js` and
   `node eval/run.js`. A red tree cannot cut a Release. The tag's core
   version must match `package.json` (the release-tag source);
   `v0.2.0-rc1` is a prerelease of `0.2.0` and does **not** require
   bumping the version string.
2. **Native build** on `windows-latest`, `ubuntu-latest`, and
   `macos-latest`. Each job runs `node build-exe.js --target …` on a
   real machine of that OS (SEA cannot cross-compile) and asserts
   `process.arch` so a runner-image flip cannot silently ship the
   wrong artifact.
3. **Smoke** each binary *on that runner*: `ci/smoke-exe.js` feeds
   `--mcp` an `initialize` + `tools/list` over stdin, asserts
   `serverInfo.name = "resonance-memory"` and exactly the four verbs,
   then kills the child. The MCP server does not exit on stdin EOF —
   a pipe-and-wait would hang — so the helper's timeout is
   load-bearing. A failed smoke fails the job; a red binary never
   reaches a Release.
4. **Release** (tag pushes only; `workflow_dispatch` builds and
   uploads artifacts but does not publish): attach
   `resonance-memory.exe`, `resonance-memory-linux-x64`,
   `resonance-memory-macos-arm64`, and `SHA256SUMS`. An rc tag
   (`v0.2.0-rc1`) is marked prerelease so it cannot become "Latest".

macOS is **arm64-only** in the matrix. Node's own SEA CI tests arm64
and skips x64; we are not going to ship the under-tested Intel build
until there is demand *and* Node says it works. `macos-latest` is
Apple Silicon; the job fails loud if `process.arch` is not `arm64`.

The binaries are **unsigned**. CI cannot fix Gatekeeper or SmartScreen;
it ships the honest unsigned binary plus this document. Signing /
notarization is the rest of `RM-11`.

Manual `workflow_dispatch` on a branch is the "build without tagging"
escape hatch — artifacts sit on the Actions run, no Release is created.

---

## PR-path CI (the always-on gate)

The release matrix above only runs on a tag. Between releases, a
regression on `main` would sit unnoticed until someone cut the next
`v*`. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) closes
that: every push to `main` and every pull request runs the same
`node test.js` + `node eval/run.js` gate on `ubuntu-latest` (Node 24).
The checks UI shows **`CI / gate`**. A red check is a stop.

It does **not** build binaries — that is `release.yml`'s job. The two
workflows share action SHA pins (`actions/checkout`,
`actions/setup-node`). The eval is offline (committed
`eval/embeddings.cache.json`); it will not reach an embedder in CI. A
new push to a PR cancels the stale run (`cancel-in-progress: true`);
the release workflow deliberately does the opposite, because a publish
must not be cancelled mid-upload.

---

## macOS — built by CI, not by hand

Node SEA cannot produce a Mach-O binary from Windows or WSL, and this
project has no Mac hardware. **The shippable macOS binary comes from
GitHub Actions** — a `macos-latest` runner (a real Mac, free for public
repos) runs exactly the recipe below and attaches the result to the
Release. Nobody needs to own a Mac.

The steps below are that same recipe, for any contributor who *does*
have a Mac and wants to build locally. Node's own SEA CI tests **macOS
arm64** and currently skips x64; prefer Apple Silicon.

1. Install Node 22.5 or newer (24.x is fine). Check:

   ```
   node --version
   ```

   Must print `v22.5.0` or higher. If missing: <https://nodejs.org>
   (LTS) or `brew install node`.

2. Get the source (clone, or pull the branch, or `main` once this
   slice is merged):

   ```
   git clone https://github.com/SamuelJacksonGrim/resonance-memory.git
   cd resonance-memory
   git pull
   ```

3. Build:

   ```
   node build-exe.js --target macos
   ```

   Expected: `dist/resonance-memory-macos-arm64` (~90 MB) on Apple
   Silicon, or `dist/resonance-memory-macos-x64` on Intel.

   The script will `codesign --remove-signature` (so postject can
   inject), postject with `--macho-segment-name NODE_SEA`, then
   `codesign --sign - --force` (ad-hoc). That last step is **free**
   and **required** — without it macOS kills the binary as an invalid
   signature. It is **not** Apple Developer ID and it will **not**
   silence Gatekeeper for a downloaded copy.

4. Smoke (from the repo root):

   ```
   chmod +x dist/resonance-memory-macos-arm64
   RESONANCE_MEMORY_NO_OPEN=1 dist/resonance-memory-macos-arm64
   ```

   Should print `Resonance Memory control panel running at http://127.0.0.1:9090/`.
   Ctrl-C to stop.

   ```
   printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
     | dist/resonance-memory-macos-arm64 --mcp
   ```

   Should print a JSON-RPC result with `"name":"resonance-memory"`.

5. First open of a **downloaded** copy (Gatekeeper / quarantine):

   - Right-click the file → **Open** → **Open**, or
   - System Settings → Privacy & Security → **Open Anyway**, or
   - Terminal: `xattr -d com.apple.quarantine resonance-memory-macos-arm64`

   Then `chmod +x` and run as above.

What a local Mac build cannot replace: the CI `macos-latest` job is
the ship path. Step 4 here is the same smoke `ci/smoke-exe.js` runs
on the runner (initialize + `tools/list`, four verbs). The Gatekeeper
click-path for a *downloaded* copy is documented above; it is not
something CI can click through for the downloader.

---

## Windows

```
node build-exe.js --target win
```

Result: `dist/resonance-memory.exe`. Double-click opens the panel with
**no console window** (the build flips the PE subsystem console → GUI).
MCP mode is unaffected because the client pipes stdin/stdout.

**SmartScreen** ("Windows protected your PC"): **More info → Run anyway**.
The binary is unsigned. Every line is open source.

`uninstall.bat` is the Windows uninstaller (disconnects the MCP client,
points at the data file, never deletes memories). On Linux/macOS use
`./<binary> --uninstall`.

---

## What a stranger actually runs

They do **not** need Node, git, or this repo. They need the binary for
their OS:

1. Give the meaning engine a chance: LM Studio + `nomic-embed-text-v1.5`
   (~80 MB). Without it, memory still works, but matches on words not
   meaning.
2. Launch the binary (Gatekeeper / SmartScreen / `chmod +x` as above).
   A page opens at `http://127.0.0.1:9090/`.
3. Click **Connect** next to LM Studio or Claude Desktop.
4. Restart that app once.

`--mcp` is what the AI client launches. `--export` / `--import` carry
the store between machines.

---

## Intel Mac / Alpine / other holes

- **macOS x64:** Node documents that SEA CI tests arm64 and skips x64.
  We still emit `resonance-memory-macos-x64` if you build on Intel, and
  we print a warning. The GitHub Actions matrix ships **arm64 only**
  (`macos-latest` + an arch assert). Prefer Apple Silicon until Node
  says otherwise *and* there is demand.
- **Alpine / musl:** Node SEA is tested on the Linux distros Node
  itself supports, **except Alpine**. A glibc binary will not run on
  musl. Build on the same libc the user has, or tell them.
- **32-bit / exotic arch:** the artifact name includes `process.arch`.
  If you are not on `x64` or `arm64`, the file is named honestly;
  whether SEA works there is Node's problem, not ours.

---

## Related

[`DEVELOPERS.md`](../DEVELOPERS.md) · [`README.md`](../README.md) · [`BACKLOG.md`](BACKLOG.md) (`RM-11`)
