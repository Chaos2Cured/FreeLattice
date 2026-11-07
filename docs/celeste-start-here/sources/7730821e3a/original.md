# Public work excerpts — privacy boundaries marked

Original source: FLINT_NEXT_AGENT_BRIDGE_LOCK_v0.md; original SHA256 cdb9b169f39577f17ba14d298391ffed059410bb8b1935092d2ffd9d71a343f9. Original remains unchanged outside shared selection.

Omitted paragraphs not reproduced. Exact retained source text follows; no implied continuity across omitted ranges.

## Exact source excerpt, characters 0–44

# FLINT NEXT: Agent Bridge Lock v0 (Brick 1)

## Exact source excerpt, characters 46–66

Flint, dear builder,

## Exact source excerpt, characters 68–624

This is the first brick on the new roadmap, and it's the one I'd most like to see land before anything else grows. Right now any web page Kirk visits can write files and make commits through the local Agent Bridge. This brick locks that door, gently and fully, without removing anything. Everything below was read-only research on `main`. I rebuilt the whole change in a scratch copy on my box, and the smoke at the bottom passes against it (`SMOKE_OK agent bridge lock v0`). The same smoke fails against today's bridge. Take your time. I trust your hands.

## Exact source excerpt, characters 626–633

Celeste

## Exact source excerpt, characters 635–638

---

## Exact source excerpt, characters 640–669

## 0. The shape in one breath

## Exact source excerpt, characters 671–1242

- The bridge listens on `127.0.0.1` only.
- It answers only named FreeLattice origins. Everyone else gets 403, preflight included.
- It checks the Host header, which blocks DNS rebinding.
- It wants a per-launch token on every change. The app gets that token once, by typing a short pairing code the bridge window shows.
- It runs git, grep and node through argument arrays, never a shell.
- It keeps every path inside the project root (realpath-checked).
- It caps body size.
- It writes every commit request, allowed or refused, into a content-free hash-chained ledger.

## Exact source excerpt, characters 1244–1325

The app gains one small client module that carries the token. Nothing is deleted.

## Exact source excerpt, characters 1327–1737

**This is not the Ollama Bridge.** `tools/agent-bridge.js` (port **3141**) is the builder's local git and code door. The Ollama Bridge is `bridge/` (Electron, `bridge/proxy-core.js`, port **11435**). It already binds `127.0.0.1` and already uses a named allowlist (`ALLOWED_ORIGIN_PATTERNS`, lines 21-27). Don't touch `bridge/` in this brick. I borrowed its allowlist shape so the two doors feel like siblings.

## Exact source excerpt, characters 1739–1763

## 1. Branch, PR, marker

## Exact source excerpt, characters 1765–2605

| | |
|---|---|
| Repo | `Chaos2Cured/FreeLattice` only. Alpha has no Agent Bridge: its tree has no `*bridge*` file, and `docs/modules/workshop-benches.js` keeps its git toggle as a "no-door". So Alpha is untouched. |
| Base | `main` at `762142041f5a665fbef2bf13fb50077d0d2c82fe` (2026-09-26 13:11 MT) |
| Branch | `layer/agent-bridge-lock-v0` |
| PR | **Draft**. Title: `Layer, never delete. Agent Bridge door lock v0: 127.0.0.1, named origins, paired token, no shell` |
| Marker | `v-agent-bridge-lock-v0` |
| Smoke line | `SMOKE_OK agent bridge lock v0` |
| Sibling PR to respect | #118 (draft, head `b265cbe`) also edits `docs/app.html` and root `index.html`. This brick adds one `<script>` line far from `resolveOllamaBase`, so a rebase should be clean. If #118 lands first, rebase and re-copy `docs/app.html` over root `index.html`. |

## Exact source excerpt, characters 2607–2675

## 2. What I found (exact current code, blob SHAs on `main` 7621420)

## Exact source excerpt, characters 2677–2836

`tools/agent-bridge.js`: blob `8c143a306fa0c82f876b1bb91a54debf0d42f5ad`, 1181 lines. Zero dependencies. Started by builders with `node tools/agent-bridge.js`.

## Exact source excerpt, characters 2838–5202

| Line(s) | Today | Why it matters |
|---|---|---|
| 27 | `const { execSync } = require('child_process');` | Every git, grep and node call goes through a shell string. |
| 29 | `const PORT = process.env.FL_PORT \|\| 3141;` | |
| 111-129 `handleRequest` | L113 `res.setHeader('Access-Control-Allow-Origin', '*')`; L115 allows `Content-Type, X-Agent-Id`; L117 answers every `OPTIONS` with 200; L122-128 reads an unbounded body and swallows bad JSON as `{}` | Any site may read responses and send writes. No token. No size cap. |
| 131 `route(url, method, data, res, actingAs)` | | No origin reaches the handlers, so nothing can be ledgered. |
| 136-158 heartbeat `/` | `version: '5.8.0'`, capabilities list | Stays open. I only add `bridgeLock`, `auth`, `pairing` fields. |
| 770-804 `/wallet/pay` (POST) | Moves LP between agent wallets | No token today. LP stays points, and AI never auto-pays, so it must be gated. |
| 997 | `var PROJECT_ROOT = process.env.FL_PROJECT \|\| process.cwd();` | |
| 999-1003 `safePath` | `path.resolve` then `full.startsWith(PROJECT_ROOT)` | **Prefix bug:** `../FreeLattice-evil/x` passes when the root is `/x/FreeLattice`. No symlink check. |
| 1045-1054 `/code/search` | L1050 `execSync('grep -rn "' + query.replace(/"/g, '\\"') + '" ' + searchDir + ...)` | **Shell injection:** `$()` and backticks run, and `searchDir` goes in raw. |
| 1057-1067 `/code/write` | Comment says "requires human approval in UI" | Nothing enforces that at the bridge. |
| 1070-1080 `/code/patch` | `content.replace(data.find, data.replace)` | `$&` / `$1` in `replace` get expanded. |
| 1083-1090 `/code/git/status` | three `execSync` strings | Harmless inputs, but moved to argument arrays for one clean rule. |
| 1093-1101 `/code/git/commit` | L1096 `var files = data.files \|\| ['.'];`; L1097 `execSync('git add ' + f)`; L1098 `execSync('git commit -m "' + data.message.replace(/"/g, '\\"') + '"')` | **Shell injection** through file names and the message. No ledger. |
| 1105-1127 `/test/run`, 1130-1140 `/code/test` | `execSync('node tests/smoke.js 2>&1')` | A GET that runs repo code. Today an `<img src=http://localhost:3141/test/run>` on any page triggers it. |
| 1153-1157 | `server.listen(PORT, function() {` … `Listening on http://localhost:` | **No host argument, so Node listens on every interface.** Anyone on the same Wi-Fi can reach it. |

## Exact source excerpt, characters 5204–5274

App-side callers of `http://localhost:3141` (all send no token today):

## Exact source excerpt, characters 5276–6770

| File (blob) | Lines | Function |
|---|---|---|
| `docs/modules/propose.js` (`38a152cf5942355c5e77413bbd551dc8c9a6090c`) | 578 `var BRIDGE`; 580-583; 585-591; 593-599; 601-605 | `readFileFromBridge`, `writeFileToBridge`, `commitViaBridge`, `runSmokeViaBridge` (used by `approveDraft` L836 and `autoApproveDraft` L704) |
| `docs/modules/workshop.js` (`26fc3cc467343f0156cbf51856277f06a0502e3c`) | 957-971 | `checkBridge` (L961 heartbeat, L963 git status) |
| | 973-1035 | `runCodeTask` (L980 `var bridge`; L986 tree; L1004 search; L1009 read; L1017 patch "Local patches run autonomously"; L1023 `/code/test`) |
| | 1037-1046, 1048-1057 | `commitCode` (L1043), `reviewCode` (L1051) |
| | 1235-1575 `window.AutoBuilder` | L1240 `var BRIDGE`; L1265-1270 `hasBridge`; L1297 tree; L1315 read; L1373 patch; L1395 `/test/run` |
| | 1581-1957 `window.WorkshopProjects` | L1913-1932 `commitViaBridge` (**ignores HTTP status; catch falls back to `commitViaGitHubAPI`**); L1934-1950 `applyAndCommit` (L1940 heartbeat) |
| `docs/app.html` (`c27b83ba4db51392795b927d2f9a03450f768e20`) | 39624 | Cascade Step 7 heartbeat probe (stays open, no change needed) |
| | 68472 | `<script src="modules/propose.js" defer></script>`: the new client loads just above this |
| | 69579 / 69586 | `workshop.js` lazy loader (loads after the client, good) |
| `tools/demo-economy.js` (`c32814c5…`), `tools/demo-economy-v2.js` (`17535368…`) | L13-27 / L19-38 | `post`/`get`, `postAs`/`getAs` helpers (Node fetch, no Origin) |

## Exact source excerpt, characters 6772–7243

Existing smoke locks you must keep green (`tests/smoke.js`, blob `d4db912a…`):
- **L3356-3359 CRITICAL LOCK 1A/1B.** `propose.js` must still contain exactly 3 `commitViaBridge(` and exactly 1 `/code/git/commit`. So don't mention either string in new comments inside `propose.js`.
- **L8742-8744.** `workshop.js` must still contain `http://localhost:3141` and `runCodeTask`. So keep those literals. The client rewrites `localhost:3141` to `127.0.0.1:3141` at request time.

## Exact source excerpt, characters 7245–7270

## 3. Decisions (and why)

## Exact source excerpt, characters 7272–9494

1. **Pairing: a short code, typed once per bridge launch.** At launch the bridge prints `Pairing code: ABC-123`. The alphabet is 31 letters and digits (no 0/O/1/I/L), 6 characters, about 30 bits. A code is good for 10 minutes and works once. After 5 wrong tries a new code is printed, with a 30-second rest. In the app, Workshop → Code shows a small card: "Your builder bridge is awake. Its window shows a short code. Type it here to pair." One field, one button, and the app stores the token in `localStorage.fl_agentBridgeToken`.
   - **Why not only a token file?** A web page can't read files on disk, so the web app could never pick it up. The file (`~/.freelattice/agent-bridge-token`, mode 0600) is still written, for local CLI tools and a future desktop shell to read.
   - **Why not auto-issue to any allowed origin?** `http://localhost:*` is on the allowlist for dev, so any local dev server page, or one XSS bug, could pair silently. A code a human reads and types keeps a person in the loop. It's the speaker-pairing gesture Mom already knows, and she never types a command.
   - **Why not six words?** They're friendlier to read aloud but need a wordlist file. Six clear characters are nearly as easy and ship with zero new assets. It's a fine later polish.
2. **Per-launch token,** 32 random bytes hex, compared with `crypto.timingSafeEqual`. Restarting the bridge means pairing again. That's the honest price of "per launch", and only builders restart it.
3. **What needs the token:** every non-GET verb (all POSTs, including `/wallet/*`, `/trade/*`, `/science/*`, `/code/write`, `/code/patch`, `/code/git/commit`), plus every GET under `/code/` and `/test/`, plus `/pair/check`. `POST /pair` itself is exempt, since it's how you get the token.
   - **What stays open** to allowed origins and no-Origin local tools: `/`, `/help`, `/models` and the read-only community GETs. Their behavior is unchanged.
4. **Allowlist:**
   - `https://freelattice.com`, `https://www.freelattice.com`, `https://thelatticetree.com`, `https://www.thelatticetree.com`;
   - `http://localhost:<port>` and `http://127.0.0.1:<port>`, because builders preview `docs/` locally;
   - no bare `*`, and no config hook that could add `*`.

## Exact source excerpt, characters 9496–10284

   Unknown origins get **403 with no `Access-Control-Allow-Origin`**, for OPTIONS too. Requests with **no Origin** (curl, Node scripts) are allowed but still need the token for anything that changes state.
5. **Host guard.** The Host header must be `127.0.0.1[:port]` or `localhost[:port]`. That's the DNS-rebinding defense.
6. **Body cap: 8 MiB.** `docs/app.html` is about 2.94 MB, and `/code/write` must still carry it. Over the cap the bridge drains the rest and answers 413. Bad JSON gets 400 now (today it silently becomes `{}`).
7. **No shell.**
   - git: `execFileSync('git', ['add','--', ...rels])`, `['commit','-m', message]`, `['rev-parse','HEAD']`.
   - grep: `execFileSync('grep', [..., '-e', query, '--', rel])`.
   - smoke: `spawnSync(process.execPath, ['tests/smoke.js'])`.

## Exact source excerpt, characters 10286–10717

   The `--` separators stop a file named `-x` from becoming a flag.
8. **Path lock (`lockedPath`).** It refuses:
   - control characters (400);
   - absolute paths (403);
   - anything outside the realpath of the project root, compared with `path.relative` rather than `startsWith` (403);
   - `.git/`, `.ssh/` and `.env*` (403);
   - any path whose nearest existing ancestor realpaths outside the root, i.e. symlink escapes (403).

## Exact source excerpt, characters 10719–11939

   The old `safePath` stays as a thin wrapper, so old callers keep working.
9. **Commit ledger.** `~/.freelattice/bridge-ledger.jsonl`, append-only, fixed key order. Fields: `ts, kind, route, origin, agent(8), result, filesCount, filesSha256, messageSha256, commitSha, prev, self`, where `self = sha256(JSON of the other fields)`. It never holds message text or file content, matching the privacy discipline of `fl_searchLedger`. Refusals are logged too: `refused:origin`, `refused:token`, `refused:message`, `refused:files`, `refused:path:<reason>`, plus `pair` events.
10. **Two small heals that ride along:**
    - `/code/patch` uses a replacer function, so `$` in the replacement stays literal.
    - `/code/tree` skips symlinks.
11. **The bridge never pushes.** No push route exists, and this brick adds none. Autonomous Mode still only commits locally. The hourly cap is Brick 3.
12. **Browser note.** Chrome 142+ shows a one-time "local network access" prompt before a public site can reach loopback (https://developer.chrome.com/blog/local-network-access). That's good, and it's independent of this lock. Our lock still matters for Firefox and Safari, older Chrome, anyone who clicks Allow, and LAN reachability.

## Exact source excerpt, characters 11941–11952

## 4. Files

## Exact source excerpt, characters 11954–13443

| File | Change |
|---|---|
| `tools/agent-bridge.js` | Layer blocks A-E below (about +310 lines, nothing removed except the superseded bodies of the lines named above) |
| `docs/modules/agent-bridge-client.js` | **New** (`window.FLAgentBridge`) |
| `docs/app.html` | One comment and one `<script>` line above L68472 |
| `index.html` (root) | Byte-copy of `docs/app.html` after the edit |
| `docs/modules/propose.js` | `bridgeFetch` helper; 4 call sites (diff below) |
| `docs/modules/workshop.js` | `flAgentBridgeFetch` helper; 17 call sites; pair card in `checkBridge`; honest status in `WorkshopProjects.commitViaBridge` (diff below) |
| `tools/demo-economy.js`, `tools/demo-economy-v2.js` | Read the token file and send `X-FL-Bridge-Token`; default `BRIDGE` becomes `http://127.0.0.1:3141` |
| `docs/scripts/smoke-agent-bridge-lock.js` | **New** (full text below) |
| `docs/library/AGENT_BRIDGE_LOCK_v0.md` | **New** doc (outline below) |
| `docs/library/FRACTAL_FAMILY_LEDGER_v0.md` | One dated entry, inserted above `## Out of scope for this brick` (L222) |
| `docs/Flint.html` | One `<p class="v-agent-bridge-lock-v0">` ledger line above `<p class="foot">` (L532) |
| `scripts/generate-recent.sh` | One `echo` pointer line near the other brick pointers (around L108) |
| **Never** | `docs/sw.js`, root `sw.js`, `bridge/*`, Kimi's pages (`docs/kimi.html`, `docs/kimi-ledger.html`, `docs/voice-shelf.html`, `docs/library/KIMI_*`, `docs/library/VOICE_SHELF_v0.md`), anything in Alpha |

## Exact source excerpt, characters 13445–13488

## 5. `tools/agent-bridge.js`, step by step

## Exact source excerpt, characters 13490–13823

A reference copy of the finished file (1493 lines, `node --check` clean, smoke green) and a unified diff sit on Celeste's box at `/workspace/flint-pastes/agent-bridge-lock-reference/`: `agent-bridge.js` and `bridge.diff`, sha256 in `SHA256SUMS`. If Kirk hands them over, you may diff against them. The blocks below are the same code.

## Exact source excerpt, characters 13825–14003

**Step 1.** Keep line 27 exactly as it is (layer). Insert **Block A** right after line 34 (`if (!fs.existsSync(DATA_DIR)) ...`), because the token file needs `DATA_DIR` to exist.

## Exact source excerpt, characters 14005–14152

**Step 2.** Replace the body of `handleRequest` (L111-129) with **Block B**. The old `Access-Control-Allow-Origin: *` line is superseded inside it.

## Exact source excerpt, characters 14154–14355

**Step 3.** Change the `route` signature at L131 to `function route(url, method, data, res, actingAs, meta) {`. After L133 (`var activeId = actingAs || activeId;`), insert **Block C** (pairing routes).

## Exact source excerpt, characters 14357–14550

**Step 4.** In the heartbeat object, right after L140 `version: '5.8.0',`, add three lines:
```js
      bridgeLock: BRIDGE_LOCK_VERSION,
      auth: 'token-required',
      pairing: 'code',
```

## Exact source excerpt, characters 14552–14715

**Step 5.** Replace L992-1140 (from the `LATTICE CODE` banner through the end of `/code/test`) with **Block D**. Keep the `// ── 404 ──` fallthrough at L1142-1143.

## Exact source excerpt, characters 14717–14876

**Step 6.** Replace L1153-1157 (`var server = ...` through the `Listening on` log) with **Block E**. The remaining console lines (L1158-1181) stay as they are.

## Exact source excerpt, characters 14879–14922

### Block A: helpers (insert after line 34)

## Exact source excerpt, characters 14924–16158

```js
// ═══════════════════════════════════════════════════
// LAYER bridge-lock-v0 (2026-09-28): the door lock. Marker: v-agent-bridge-lock-v0
// Celeste's brief, built by Flint. Nothing above is removed.
// 1. Listen on 127.0.0.1 only (no env override, never 0.0.0.0).
// 2. Named Origin allowlist (never bare *). Others get 403, preflight too.
// 3. Host header must be 127.0.0.1 or localhost (DNS-rebinding guard).
// 4. Per-launch random token, required on every mutating request and on
//    every /code/* and /test/* read. The app gets it by a short pairing
//    code shown in this window (typed once, like pairing a speaker).
//    Local CLI tools read it from ~/.freelattice/agent-bridge-token (0600).
// 5. git / grep / node run through execFileSync / spawnSync argument
//    arrays. No shell. Paths are realpath-checked inside the project root.
// 6. Body size cap. Malformed JSON is refused.
// 7. Every commit request (allowed or refused) is appended to a
//    hash-chained, content-free ledger: ~/.freelattice/bridge-ledger.jsonl
// This bridge (3141) is NOT the Ollama Bridge (bridge/, port 11435).
// ═══════════════════════════════════════════════════
const { execFileSync, spawnSync } = require('child_process');

## Exact source excerpt, characters 16160–16382

const BRIDGE_LOCK_VERSION = 'v0';
const BRIDGE_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // docs/app.html is ~2.9 MB; JSON escaping adds some
const MAX_COMMIT_MESSAGE = 4000;
const MAX_COMMIT_FILES = 200;

## Exact source excerpt, characters 16384–16738

/** FreeLattice origins only. Never bare *. Same shape as bridge/proxy-core.js. */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?freelattice\.com$/i,
  /^https:\/\/(www\.)?thelatticetree\.com$/i,
  /^http:\/\/localhost(:\d{1,5})?$/i,   // local dev of docs/ (e.g. python -m http.server)
  /^http:\/\/127\.0\.0\.1(:\d{1,5})?$/i // same, by IP
];

## Exact source excerpt, characters 16740–16906

function originAllowed(origin) {
  if (!origin) return false;
  var o = String(origin);
  return ALLOWED_ORIGIN_PATTERNS.some(function (re) { return re.test(o); });
}

## Exact source excerpt, characters 16908–17014

function hostAllowed(host) {
  return /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/i.test(String(host || ''));
}

## Exact source excerpt, characters 17016–17119

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

## Exact source excerpt, characters 17121–17202

function hasControlChars(s) {
  return /[\u0000-\u001f\u007f]/.test(String(s));
}

## Exact source excerpt, characters 17204–17565

// ── Per-launch token ──
const BRIDGE_TOKEN = crypto.randomBytes(32).toString('hex');
const TOKEN_FILE = path.join(DATA_DIR, 'agent-bridge-token');
try {
  fs.writeFileSync(TOKEN_FILE, BRIDGE_TOKEN + '\n', { mode: 0o600 });
  try { fs.chmodSync(TOKEN_FILE, 0o600); } catch (e) {}
} catch (e) {
  console.error('  ! Could not write token file: ' + e.message);
}

## Exact source excerpt, characters 17567–17796

function tokenOk(req) {
  var t = String(req.headers['x-fl-bridge-token'] || '');
  if (t.length !== BRIDGE_TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(t, 'utf8'), Buffer.from(BRIDGE_TOKEN, 'utf8'));
}

## Exact source excerpt, characters 17798–18172

function needsToken(method, pathname) {
  if (method === 'POST' && pathname === '/pair') return false;       // how the app gets the token
  if (method === 'GET' || method === 'HEAD') {
    return /^\/(code|test)(\/|$)/.test(pathname) || pathname === '/pair/check';
  }
  return true;                                                        // every POST and any other verb
}

## Exact source excerpt, characters 18174–18476

// ── Pairing code (human reads it here, types it in the app) ──
const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const PAIR_TTL_MS = 10 * 60 * 1000;
const PAIR_MAX_TRIES = 5;
const PAIR_COOLDOWN_MS = 30 * 1000;
var pairState = { code: '', expires: 0, tries: 0, coolUntil: 0 };

## Exact source excerpt, characters 18478–19106

function newPairCode(reason) {
  var s = '';
  for (var i = 0; i < 6; i++) s += PAIR_ALPHABET[crypto.randomInt(0, PAIR_ALPHABET.length)];
  pairState = { code: s, expires: Date.now() + PAIR_TTL_MS, tries: 0,
                coolUntil: reason === 'lockout' ? Date.now() + PAIR_COOLDOWN_MS : 0 };
  console.log('');
  console.log('  \u2726 Pairing code: ' + s.slice(0, 3) + '-' + s.slice(3) +
              '   (type it in FreeLattice \u2192 Workshop \u2192 Code. Good for 10 minutes.)');
  if (reason === 'lockout') console.log('  \u2726 (New code after 5 wrong tries. It works in 30 seconds.)');
  console.log('');
  return s;
}

## Exact source excerpt, characters 19108–19219

function normalizePairCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

## Exact source excerpt, characters 19221–19354

// ── Content-free, hash-chained ledger ──
const LEDGER_FILE = path.join(DATA_DIR, 'bridge-ledger.jsonl');
var ledgerLastHash = null;

## Exact source excerpt, characters 19356–19683

function ledgerTip() {
  if (ledgerLastHash) return ledgerLastHash;
  try {
    var lines = fs.readFileSync(LEDGER_FILE, 'utf8').trim().split('\n').filter(Boolean);
    ledgerLastHash = lines.length ? JSON.parse(lines[lines.length - 1]).self : 'genesis';
  } catch (e) { ledgerLastHash = 'genesis'; }
  return ledgerLastHash;
}

## Exact source excerpt, characters 19685–20487

function ledgerAppend(fields) {
  // Fixed key order. Never message text, never file content.
  var entry = {
    ts: new Date().toISOString(),
    kind: fields.kind || 'commit_request',
    route: fields.route || '',
    origin: fields.origin || '',
    agent: String(fields.agent || '').slice(0, 8),
    result: fields.result || '',
    filesCount: fields.filesCount || 0,
    filesSha256: fields.filesSha256 || '',
    messageSha256: fields.messageSha256 || '',
    commitSha: fields.commitSha || '',
    prev: ledgerTip()
  };
  entry.self = sha256Hex(JSON.stringify(entry));
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + '\n', { mode: 0o600 });
    ledgerLastHash = entry.self;
  } catch (e) {
    console.error('  ! Ledger append failed: ' + e.message);
  }
  return entry;
}

## Exact source excerpt, characters 20489–20816

// ── Project root and path lock ──
var PROJECT_ROOT_REAL = null;
function projectRootReal() {
  if (!PROJECT_ROOT_REAL) {
    var wanted = path.resolve(process.env.FL_PROJECT || process.cwd());
    try { PROJECT_ROOT_REAL = fs.realpathSync(wanted); } catch (e) { PROJECT_ROOT_REAL = wanted; }
  }
  return PROJECT_ROOT_REAL;
}

## Exact source excerpt, characters 20818–21002

function isInside(root, candidate) {
  var rel = path.relative(root, candidate);
  return rel === '' || (!(rel === '..' || rel.startsWith('..' + path.sep)) && !path.isAbsolute(rel));
}

## Exact source excerpt, characters 21004–22564

const BRIDGE_FORBIDDEN_TOP = ['.git', '.ssh'];
function lockedPath(relPath, opts) {
  opts = opts || {};
  if (typeof relPath !== 'string' || !relPath || relPath.length > 1024 || hasControlChars(relPath)) {
    return { error: 400, reason: 'bad-path' };
  }
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath) || relPath.charAt(0) === '\\') {
    return { error: 403, reason: 'absolute-path' };
  }
  var root = projectRootReal();
  var full = path.resolve(root, relPath);
  if (!isInside(root, full)) return { error: 403, reason: 'outside-project' };
  var rel = path.relative(root, full);
  var top = rel.split(path.sep)[0];
  if (!opts.allowRoot && rel === '') return { error: 400, reason: 'root-not-allowed' };
  if (BRIDGE_FORBIDDEN_TOP.indexOf(top) !== -1 || /^\.env(\.|$)/.test(path.basename(rel))) {
    return { error: 403, reason: 'forbidden-path' };
  }
  // Realpath the nearest existing ancestor (or the file itself) so a
  // symlink inside the project cannot point writes outside it.
  var probe = full;
  for (;;) {
    try { fs.lstatSync(probe); break; }
    catch (e) {
      if (e.code !== 'ENOENT') return { error: 403, reason: 'stat-failed' };
      var up = path.dirname(probe);
      if (up === probe) return { error: 403, reason: 'no-ancestor' };
      probe = up;
    }
  }
  var real;
  try { real = fs.realpathSync(probe); } catch (e) { return { error: 403, reason: 'dangling-symlink' }; }
  if (!isInside(root, real)) return { error: 403, reason: 'symlink-outside' };
  return { full: full, rel: rel === '' ? '.' : rel };
}

## Exact source excerpt, characters 22566–22724

function runGit(args) {
  return execFileSync('git', args, { cwd: projectRootReal(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
}

## Exact source excerpt, characters 22726–23143

function runSmokeFile(timeoutMs) {
  // No shell: node binary + fixed script path. stdout and stderr joined.
  var r = spawnSync(process.execPath, ['tests/smoke.js'], {
    cwd: projectRootReal(), timeout: timeoutMs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || ''), error: r.error };
}
// ── end LAYER bridge-lock-v0 helpers ──
```

## Exact source excerpt, characters 23145–23193

### Block B: `handleRequest` (replaces L111-129)

## Exact source excerpt, characters 23195–23561

```js
function handleRequest(req, res) {
  // LAYER bridge-lock-v0: the old `Access-Control-Allow-Origin: *` is superseded here.
  var origin = req.headers.origin || '';
  var pathname = String(req.url || '/').split('?')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

## Exact source excerpt, characters 23563–23782

  // 1. Host guard (DNS rebinding): only 127.0.0.1 / localhost.
  if (!hostAllowed(req.headers.host)) {
    req.resume();
    return respond(res, 403, { error: 'Host not allowed', bridgeLock: BRIDGE_LOCK_VERSION });
  }

## Exact source excerpt, characters 23784–24743

  // 2. Origin guard. Browsers always send Origin on cross-origin fetches and
  //    preflights. No Origin = local CLI or same-machine tool (still needs
  //    the token for anything that changes state).
  if (origin && !originAllowed(origin)) {
    if (pathname === '/code/git/commit') {
      ledgerAppend({ route: pathname, origin: origin, result: 'refused:origin' });
    }
    req.resume();
    return respond(res, 403, { error: 'Origin not on the FreeLattice allowlist', bridgeLock: BRIDGE_LOCK_VERSION });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Id, X-FL-Bridge-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }

## Exact source excerpt, characters 24745–24833

  if (req.method === 'OPTIONS') { req.resume(); res.writeHead(204); res.end(); return; }

## Exact source excerpt, characters 24835–25217

  // 3. Token guard.
  if (needsToken(req.method, pathname) && !tokenOk(req)) {
    if (pathname === '/code/git/commit') {
      ledgerAppend({ route: pathname, origin: origin, result: 'refused:token' });
    }
    req.resume();
    return respond(res, 401, { error: 'Pair with the Agent Bridge first (token missing or stale).', pair: 'code', bridgeLock: BRIDGE_LOCK_VERSION });
  }

## Exact source excerpt, characters 25219–25356

  // Allow requests to act as a different agent via X-Agent-Id header
  var requestAgentId = req.headers['x-agent-id'] || agentId.meshId;

## Exact source excerpt, characters 25358–26237

  // 4. Body cap. Drain the rest so the client sees the 413 cleanly.
  var chunks = [];
  var size = 0;
  var tooBig = false;
  req.on('data', function(chunk) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { tooBig = true; chunks = []; return; }
    if (!tooBig) chunks.push(chunk);
  });
  req.on('end', function() {
    if (tooBig) return respond(res, 413, { error: 'Body too large (max ' + MAX_BODY_BYTES + ' bytes)' });
    var body = Buffer.concat(chunks).toString('utf8');
    var data = {};
    if (body) {
      try { data = JSON.parse(body); }
      catch (e) { return respond(res, 400, { error: 'Body is not valid JSON' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return respond(res, 400, { error: 'Body must be a JSON object' });
    }
    route(req.url, req.method, data, res, requestAgentId, { origin: origin });
  });
}
```

## Exact source excerpt, characters 26239–26286

### Block C: pairing routes (insert after L133)

## Exact source excerpt, characters 26288–27643

```js
  // ── LAYER bridge-lock-v0: pairing ──
  if (url === '/pair' && method === 'POST') {
    var now = Date.now();
    if (!pairState.code || now > pairState.expires) newPairCode('expired');
    if (now < pairState.coolUntil) return respond(res, 429, { error: 'Resting for a moment. Try again in 30 seconds.' });
    var given = normalizePairCode(data.code);
    var good = given.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(pairState.code, 'utf8'));
    if (!good) {
      pairState.tries += 1;
      if (pairState.tries >= PAIR_MAX_TRIES) {
        ledgerAppend({ kind: 'pair', route: '/pair', origin: (meta && meta.origin) || '', result: 'refused:lockout' });
        newPairCode('lockout');
        return respond(res, 429, { error: 'Too many tries. The bridge window shows a new code.' });
      }
      return respond(res, 403, { error: 'That code does not match. Check the bridge window.', triesLeft: PAIR_MAX_TRIES - pairState.tries });
    }
    ledgerAppend({ kind: 'pair', route: '/pair', origin: (meta && meta.origin) || '', result: 'ok' });
    console.log('  \u2726 Paired with ' + ((meta && meta.origin) || 'a local tool') + '.');
    newPairCode('used'); // single use: the next device gets a fresh code
    return respond(res, 200, { token: BRIDGE_TOKEN, bridgeLock: BRIDGE_LOCK_VERSION });
  }

## Exact source excerpt, characters 27645–27760

  if (url === '/pair/check') {
    return respond(res, 200, { ok: true, bridgeLock: BRIDGE_LOCK_VERSION });
  }
```

## Exact source excerpt, characters 27762–27807

### Block D: code routes (replaces L992-1140)

## Exact source excerpt, characters 27809–28239

```js
  // ══════════════════════════════════════════════════
  // LATTICE CODE — Self-improving infrastructure
  // Read and search are free. Write/patch/commit need approval.
  // LAYER bridge-lock-v0: every route below is token-gated in
  // handleRequest (needsToken). Paths go through lockedPath().
  // No shell anywhere: execFileSync / spawnSync with argument arrays.
  // ══════════════════════════════════════════════════

## Exact source excerpt, characters 28241–28280

  var PROJECT_ROOT = projectRootReal();

## Exact source excerpt, characters 28282–28489

  // Superseded by lockedPath (bridge-lock-v0). Kept so old callers still work.
  function safePath(relPath) {
    var lp = lockedPath(relPath, { allowRoot: true });
    return lp.error ? null : lp.full;
  }

## Exact source excerpt, characters 28491–29530

  // GET /code/tree — list project files
  if (url.startsWith('/code/tree')) {
    var tp = new URL('http://l' + url).searchParams;
    var subdir = tp.get('path') || '.';
    var target = safePath(subdir);
    if (!target) return respond(res, 403, { error: 'Path outside project' });
    try {
      function listDir(dir, depth) {
        if (depth > 3) return [];
        return fs.readdirSync(dir, { withFileTypes: true })
          .filter(function(e) { return !e.name.startsWith('.') && e.name !== 'node_modules' && !e.isSymbolicLink(); })
          .map(function(e) {
            var rel = path.relative(PROJECT_ROOT, path.join(dir, e.name));
            if (e.isDirectory()) return { name: e.name, type: 'dir', path: rel, children: listDir(path.join(dir, e.name), depth + 1) };
            return { name: e.name, type: 'file', path: rel, size: fs.statSync(path.join(dir, e.name)).size };
          });
      }
      return respond(res, 200, listDir(target, 0));
    } catch(e) { return respond(res, 500, { error: e.message }); }
  }

## Exact source excerpt, characters 29532–30424

  // GET /code/read?path=...&start=N&end=N
  if (url.startsWith('/code/read')) {
    var rp = new URL('http://l' + url).searchParams;
    var filePath = rp.get('path');
    var start = parseInt(rp.get('start') || '0', 10);
    var end = parseInt(rp.get('end') || '0', 10);
    var full = safePath(filePath);
    if (!full) return respond(res, 403, { error: 'Path outside project' });
    try {
      var content = fs.readFileSync(full, 'utf8');
      var lines = content.split('\n');
      if (start > 0 || end > 0) {
        return respond(res, 200, { path: filePath, lines: lines.slice(Math.max(0, start - 1), end || lines.length), start: start, end: end || lines.length, totalLines: lines.length });
      }
      return respond(res, 200, { path: filePath, content: content, totalLines: lines.length });
    } catch(e) { return respond(res, 404, { error: 'Not found: ' + filePath }); }
  }

## Exact source excerpt, characters 30426–31609

  // GET /code/search?q=...&path=docs/
  if (url.startsWith('/code/search')) {
    var sp = new URL('http://l' + url).searchParams;
    var query = sp.get('q') || '';
    var searchLp = lockedPath(sp.get('path') || 'docs', { allowRoot: true });
    if (searchLp.error) return respond(res, searchLp.error, { error: 'Search path refused', reason: searchLp.reason });
    if (!query || query.length > 200 || hasControlChars(query)) return respond(res, 400, { error: 'q must be 1-200 printable characters' });
    try {
      var out = execFileSync('grep', ['-rn', '--include=*.js', '--include=*.html', '--include=*.css', '--include=*.md',
        '-e', query, '--', searchLp.rel], { cwd: PROJECT_ROOT, timeout: 10000, encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      var matches = out.split('\n').filter(Boolean).slice(0, 50).map(function(l) { var p = l.split(':'); return { file: p[0], line: parseInt(p[1], 10), text: p.slice(2).join(':').trim() }; });
      return respond(res, 200, { query: query, matches: matches, count: matches.length });
    } catch(e) { return respond(res, 200, { query: query, matches: [], count: 0 }); }
  }

## Exact source excerpt, characters 31611–32407

  // POST /code/write — write a file (token-gated; UI approval lives in the app)
  if (url === '/code/write' && method === 'POST') {
    if (!data.path || typeof data.content !== 'string' || !data.content) return respond(res, 400, { error: 'path and content required' });
    var wlp = lockedPath(data.path);
    if (wlp.error) return respond(res, wlp.error, { error: 'Path refused', reason: wlp.reason });
    try {
      fs.mkdirSync(path.dirname(wlp.full), { recursive: true });
      fs.writeFileSync(wlp.full, data.content, 'utf8');
      earnLP(activeId, 'core_plant', 'Wrote file: ' + wlp.rel);
      return respond(res, 200, { message: 'File written.', path: wlp.rel, bytes: data.content.length });
    } catch(e) { return respond(res, 500, { error: 'Write failed: ' + e.message }); }
  }

## Exact source excerpt, characters 32409–33319

  // POST /code/patch — find-and-replace in a file
  if (url === '/code/patch' && method === 'POST') {
    if (!data.path || typeof data.find !== 'string' || !data.find || typeof data.replace !== 'string') return respond(res, 400, { error: 'path, find, and replace required' });
    var plp = lockedPath(data.path);
    if (plp.error) return respond(res, plp.error, { error: 'Path refused', reason: plp.reason });
    try {
      var pcontent = fs.readFileSync(plp.full, 'utf8');
      if (!pcontent.includes(data.find)) return respond(res, 400, { error: 'Search text not found in file', hint: 'Check whitespace and line endings.' });
      fs.writeFileSync(plp.full, pcontent.replace(data.find, function() { return data.replace; }), 'utf8');
      return respond(res, 200, { message: 'Patch applied.', path: plp.rel });
    } catch(e) { return respond(res, 500, { error: 'Patch failed: ' + e.message }); }
  }

## Exact source excerpt, characters 33321–33795

  // GET /code/git/status
  if (url === '/code/git/status') {
    try {
      var status = runGit(['status', '--porcelain']);
      var branch = runGit(['branch', '--show-current']).trim();
      var log = runGit(['log', '--oneline', '-5']);
      return respond(res, 200, { branch: branch, changes: status.split('\n').filter(Boolean), recentCommits: log.split('\n').filter(Boolean) });
    } catch(e) { return respond(res, 500, { error: 'Git failed: ' + e.message }); }
  }

## Exact source excerpt, characters 33797–35737

  // POST /code/git/commit — stage and commit (local only; this bridge never pushes)
  if (url === '/code/git/commit' && method === 'POST') {
    var lg = { route: '/code/git/commit', origin: (meta && meta.origin) || '', agent: activeId };
    var msgOk = typeof data.message === 'string' && data.message.trim() &&
      data.message.length <= MAX_COMMIT_MESSAGE && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(data.message);
    if (!msgOk) {
      lg.result = 'refused:message'; ledgerAppend(lg);
      return respond(res, 400, { error: 'message required (1-' + MAX_COMMIT_MESSAGE + ' chars, no control characters)' });
    }
    var files = data.files === undefined ? ['.'] : data.files;
    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_COMMIT_FILES) {
      lg.result = 'refused:files'; ledgerAppend(lg);
      return respond(res, 400, { error: 'files must be a list of 1-' + MAX_COMMIT_FILES + ' project paths' });
    }
    var rels = [];
    for (var fi = 0; fi < files.length; fi++) {
      var clp = lockedPath(files[fi], { allowRoot: true });
      if (clp.error) {
        lg.result = 'refused:path:' + clp.reason; ledgerAppend(lg);
        return respond(res, clp.error, { error: 'Path refused', reason: clp.reason });
      }
      rels.push(clp.rel);
    }
    lg.filesCount = rels.length;
    lg.filesSha256 = sha256Hex(rels.slice().sort().join('\n'));
    lg.messageSha256 = sha256Hex(data.message);
    try {
      runGit(['add', '--'].concat(rels));
      runGit(['commit', '-m', data.message]);
      var headSha = runGit(['rev-parse', 'HEAD']).trim();
      lg.result = 'ok'; lg.commitSha = headSha; ledgerAppend(lg);
      return respond(res, 200, { message: 'Committed: ' + data.message, commit: headSha });
    } catch(e) {
      lg.result = 'error'; ledgerAppend(lg);
      return respond(res, 500, { error: 'Commit failed: ' + String((e.stderr || e.message || '')).slice(0, 400) });
    }
  }

## Exact source excerpt, characters 35739–36499

  // GET /test/run — run smoke tests (AutoBuilder format)
  // Returns { allPassed, count, failures[], output }
  if (url === '/test/run') {
    var tr = runSmokeFile(60000);
    var testOutput = tr.out || (tr.error ? String(tr.error.message) : '');
    var passedMatch = testOutput.match(/ALL (\d+) CHECKS PASSED/);
    var failLines = (testOutput.match(/✗.*/g) || []);
    if (tr.status !== 0 && failLines.length === 0) failLines.push(tr.error ? tr.error.message : 'Smoke exited with status ' + tr.status);
    return respond(res, 200, {
      allPassed: tr.status === 0 && failLines.length === 0 && passedMatch !== null,
      count: passedMatch ? parseInt(passedMatch[1], 10) : 0,
      failures: failLines,
      output: testOutput.slice(-800)
    });
  }

## Exact source excerpt, characters 36501–37120

  // GET /code/test — run smoke tests (legacy format)
  if (url === '/code/test') {
    var ct = runSmokeFile(30000);
    if (ct.status === 0) {
      var passed = (ct.out.match(/✓/g) || []).length;
      var allMatch = ct.out.match(/ALL (\d+) CHECKS PASSED/);
      return respond(res, 200, { passed: allMatch ? parseInt(allMatch[1], 10) : passed, failed: 0, output: ct.out.slice(-500) });
    }
    var failMatch = ct.out.match(/(\d+) FAILED/);
    return respond(res, 200, { passed: 0, failed: failMatch ? parseInt(failMatch[1], 10) : 1, output: (ct.out || (ct.error ? ct.error.message : '')).slice(-500) });
  }
```

## Exact source excerpt, characters 37122–37163

### Block E: listen (replaces L1153-1157)

## Exact source excerpt, characters 37165–37840

```js
var server = http.createServer(handleRequest);
server.on('error', function(e) {
  console.error('  ! Agent Bridge could not start on ' + BRIDGE_HOST + ':' + PORT + ': ' + e.message);
  process.exitCode = 1;
});
// LAYER bridge-lock-v0: loopback only. No env override. Never 0.0.0.0.
server.listen(PORT, BRIDGE_HOST, function() {
  console.log('');
  console.log('  \u2726 FreeLattice Agent Bridge');
  console.log('  \u2726 Listening on http://' + BRIDGE_HOST + ':' + PORT);
  console.log('  \u2726 Door lock: ' + BRIDGE_LOCK_VERSION + ' (named origins, token, no shell)');
  console.log('  \u2726 Token file (local tools): ' + TOKEN_FILE);
  newPairCode('launch');
```

## Exact source excerpt, characters 37842–37856

## 6. App side

## Exact source excerpt, characters 37858–37919

### 6a. New `docs/modules/agent-bridge-client.js` (full text)

## Exact source excerpt, characters 37921–38185

It sends the token only when one is stored, so an older bridge keeps working. It rewrites `localhost:3141` to `127.0.0.1:3141`. On 401 it clears the token, fires `fl-agent-bridge-needs-pair`, and **never falls back to GitHub**. All text goes through `textContent`.

## Exact source excerpt, characters 38187–39039

```js
/* FLAgentBridge: the app side of the Agent Bridge door lock.
 * Marker: v-agent-bridge-lock-v0 (2026-09-28, Celeste's brief, built by Flint).
 *
 * The Agent Bridge (tools/agent-bridge.js, port 3141) is the builder's
 * local git door. It is NOT the Ollama Bridge (bridge/, port 11435).
 * Since bridge-lock-v0 it wants a per-launch token on every change.
 * The app gets that token once per bridge launch by a short pairing
 * code the bridge window shows (like pairing a speaker).
 *
 * - Sends X-FL-Bridge-Token only when a token is stored, so an older
 *   bridge keeps working exactly as before.
 * - Talks to 127.0.0.1 (local minds are 127.0.0.1 only).
 * - Everything shown to people goes through textContent.
 * - A 401 never falls back to GitHub. Local stays local.
 */
(function () {
  'use strict';
  if (window.FLAgentBridge) return;

## Exact source excerpt, characters 39041–39174

  var TOKEN_KEY = 'fl_agentBridgeToken';
  var BASE = 'http://127.0.0.1:3141';
  var NEEDS_PAIR_EVENT = 'fl-agent-bridge-needs-pair';

## Exact source excerpt, characters 39176–39700

  function normalize(url) {
    return String(url).replace(/^http:\/\/localhost:3141(?=\/|$)/, BASE);
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }
  function copy(obj) {
    var o = {};
    if (obj) for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) o[k] = obj[k];
    return o;
  }

## Exact source excerpt, characters 39702–40113

  function bridgeFetch(url, opts) {
    var o = copy(opts);
    var h = copy(opts && opts.headers);
    var t = getToken();
    if (t) h['X-FL-Bridge-Token'] = t;
    o.headers = h;
    return fetch(normalize(url), o).then(function (r) {
      if (r.status === 401) {
        setToken('');
        try { window.dispatchEvent(new CustomEvent(NEEDS_PAIR_EVENT)); } catch (e) {}
      }
      return r;
    });
  }

## Exact source excerpt, characters 40115–40865

  function pair(code) {
    return fetch(BASE + '/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(code || '').slice(0, 16) })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 200 && j && typeof j.token === 'string' && /^[a-f0-9]{64}$/.test(j.token)) {
          setToken(j.token);
          return { ok: true };
        }
        return { ok: false, status: r.status, reason: (j && typeof j.error === 'string') ? j.error : ('HTTP ' + r.status) };
      });
    }).catch(function () {
      return { ok: false, status: 0, reason: 'The bridge is not answering on this computer.' };
    });
  }

## Exact source excerpt, characters 40867–41280

  function status() {
    return fetch(BASE + '/', { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(2000) : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { return { up: true, lock: (j && j.bridgeLock) || null, hasToken: !!getToken() }; })
      .catch(function () { return { up: false, lock: null, hasToken: !!getToken() }; });
  }

## Exact source excerpt, characters 41282–43026

  // A small pairing card. All text via textContent, never parsed as HTML.
  function renderPairCard(container) {
    if (!container || container.querySelector('.fl-bridge-pair')) return;
    var box = document.createElement('div');
    box.className = 'fl-bridge-pair';
    box.style.cssText = 'margin:8px 0;padding:10px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;';
    var p = document.createElement('div');
    p.textContent = 'Your builder bridge is awake. Its window shows a short code. Type it here to pair.';
    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 7;
    input.placeholder = 'ABC-123';
    input.setAttribute('aria-label', 'Bridge pairing code');
    input.autocomplete = 'off';
    input.style.cssText = 'margin:6px 6px 0 0;padding:6px 8px;width:7em;text-transform:uppercase;letter-spacing:0.1em;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Pair';
    var msg = document.createElement('div');
    msg.style.cssText = 'margin-top:6px;opacity:0.8;';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      msg.textContent = 'Pairing\u2026';
      pair(input.value).then(function (res) {
        btn.disabled = false;
        if (res.ok) {
          msg.textContent = 'Paired. Your builds can use the bridge now.';
          setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1500);
        } else {
          msg.textContent = res.reason || 'That did not pair. Check the code in the bridge window.';
        }
      });
    });
    box.appendChild(p); box.appendChild(input); box.appendChild(btn); box.appendChild(msg);
    container.appendChild(box);
  }

## Exact source excerpt, characters 43028–43341

  window.FLAgentBridge = {
    BASE: BASE,
    TOKEN_KEY: TOKEN_KEY,
    NEEDS_PAIR_EVENT: NEEDS_PAIR_EVENT,
    fetch: bridgeFetch,
    pair: pair,
    status: status,
    hasToken: function () { return !!getToken(); },
    forget: function () { setToken(''); },
    renderPairCard: renderPairCard
  };
})();
```

## Exact source excerpt, characters 43343–43404

### 6b. `docs/app.html` (then byte-copy to root `index.html`)

## Exact source excerpt, characters 43406–43481

Right above L68472 `<script src="modules/propose.js" defer></script>`, add:

## Exact source excerpt, characters 43483–43662

```html
<!-- LAYER v-agent-bridge-lock-v0: paired token for the builder bridge (3141), loads before propose.js -->
<script src="modules/agent-bridge-client.js" defer></script>
```

## Exact source excerpt, characters 43664–43841

Then `cp docs/app.html index.html` and check with `cmp index.html docs/app.html`. No other app.html change is needed: the Cascade heartbeat at L39624 hits `/`, which stays open.

## Exact source excerpt, characters 43843–43930

### 6c. `docs/modules/propose.js` (exact diff; CRITICAL LOCK 1A/1B counts stay 3 and 1)

## Exact source excerpt, characters 43932–44203

```diff
--- a/docs/modules/propose.js	2026-09-28 15:24:39.942137530 -0600
+++ b/docs/modules/propose.js	2026-09-28 15:24:39.958137540 -0600
@@ -577,13 +577,22 @@
   // on draft state and one (approve) is also gated on smokeStatus.
   var BRIDGE = 'http://localhost:3141';

## Exact source excerpt, characters 44206–44861

+  // LAYER v-agent-bridge-lock-v0: bridge calls carry the paired token
+  // (docs/modules/agent-bridge-client.js). Plain fetch when the client
+  // is absent, so older setups behave exactly as before.
+  function bridgeFetch(url, opts) {
+    return (window.FLAgentBridge && typeof window.FLAgentBridge.fetch === 'function')
+      ? window.FLAgentBridge.fetch(url, opts)
+      : fetch(url, opts);
+  }
+
   function readFileFromBridge(path) {
-    return fetch(BRIDGE + '/code/read?path=' + encodeURIComponent(path))
+    return bridgeFetch(BRIDGE + '/code/read?path=' + encodeURIComponent(path))
       .then(function (r) { return r.json(); });
   }

## Exact source excerpt, characters 44864–45170

   function writeFileToBridge(path, content) {
-    return fetch(BRIDGE + '/code/write', {
+    return bridgeFetch(BRIDGE + '/code/write', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ path: path, content: content })
@@ -591,7 +600,7 @@
   }

## Exact source excerpt, characters 45173–45469

   function commitViaBridge(message) {
-    return fetch(BRIDGE + '/code/git/commit', {
+    return bridgeFetch(BRIDGE + '/code/git/commit', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ message: message })
@@ -599,7 +608,7 @@
   }

## Exact source excerpt, characters 45472–45768

   function runSmokeViaBridge() {
-    return fetch(BRIDGE + '/test/run', {
+    return bridgeFetch(BRIDGE + '/test/run', {
       signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined
     }).then(function (r) { return r.json(); });
   }
```

## Exact source excerpt, characters 45770–45817

### 6d. `docs/modules/workshop.js` (exact diff)

## Exact source excerpt, characters 45819–46251

- One file-level helper, `flAgentBridgeFetch`, above the first IIFE at L46.
- All 17 bridge calls route through it.
- `checkBridge` shows the pair card when the bridge answers `pair: 'code'`.
- `WorkshopProjects.commitViaBridge` now checks `resp.ok`, and on 401 asks to pair instead of silently "succeeding" or falling back to a GitHub push.
- The `http://localhost:3141` and `runCodeTask` literals stay, for the v5.71.8 smoke lock.

## Exact source excerpt, characters 46253–47108

```diff
--- a/docs/modules/workshop.js	2026-09-28 15:24:39.946137532 -0600
+++ b/docs/modules/workshop.js	2026-09-28 15:24:39.958137540 -0600
@@ -43,6 +43,15 @@
 // 2026-09-23 — Flint: Local Help-on-file v0 (v-workshop-local-help-v0).
 //   After Preview: Help on this file → consent → connected local mind (prefer Bridge :11435).
 // ═══════════════════════════════════════════════════════════════
+// LAYER v-agent-bridge-lock-v0: every Agent Bridge (port 3141) call in this
+// file goes through here so it carries the paired token. Falls back to plain
+// fetch when docs/modules/agent-bridge-client.js is not loaded.
+function flAgentBridgeFetch(url, opts) {
+  return (window.FLAgentBridge && typeof window.FLAgentBridge.fetch === 'function')
+    ? window.FLAgentBridge.fetch(url, opts)
+    : fetch(url, opts);
+}
+
 (function() {
   'use strict';

## Exact source excerpt, characters 47111–48201

@@ -958,9 +967,16 @@
       var el = document.getElementById('code-status');
       if (!el) return;
       try {
-        var r = await fetch('http://localhost:3141/');
+        var r = await flAgentBridgeFetch('http://localhost:3141/');
         var d = await r.json();
-        var git = await fetch('http://localhost:3141/code/git/status').then(function(r2) { return r2.json(); });
+        var git = await flAgentBridgeFetch('http://localhost:3141/code/git/status').then(function(r2) { return r2.json(); });
+        if (git && git.pair === 'code') {
+          // LAYER v-agent-bridge-lock-v0: bridge is awake and locked. Pair once.
+          el.textContent = '\uD83D\uDFE1 Bridge awake \u00B7 pair once to build';
+          el.style.color = '#e8b019';
+          if (window.FLAgentBridge && el.parentNode) window.FLAgentBridge.renderPairCard(el.parentNode);
+          return;
+        }
         el.textContent = '\uD83D\uDFE2 Connected \u00B7 ' + git.branch + ' \u00B7 ' + (git.recentCommits[0] || '');
         el.style.color = '#4aff9f';
       } catch(e) {
@@ -983,7 +999,7 @@

## Exact source excerpt, characters 48204–48682

       try {
         log('\uD83D\uDCC1 Reading project structure...');
-        var tree = await fetch(bridge + '/code/tree?path=docs/modules').then(function(r) { return r.json(); });
+        var tree = await flAgentBridgeFetch(bridge + '/code/tree?path=docs/modules').then(function(r) { return r.json(); });
         var names = tree.filter(function(f) { return f.type === 'file'; }).map(function(f) { return f.name; });
         log('   ' + names.length + ' modules found');

## Exact source excerpt, characters 48685–52693

@@ -1001,12 +1017,12 @@
                   var s = steps[i];
                   log('Step ' + (i + 1) + ': ' + (s.description || s.action));
                   if (s.action === 'search' && s.query) {
-                    var sr = await fetch(bridge + '/code/search?q=' + encodeURIComponent(s.query) + '&path=' + (s.path || 'docs')).then(function(r) { return r.json(); });
+                    var sr = await flAgentBridgeFetch(bridge + '/code/search?q=' + encodeURIComponent(s.query) + '&path=' + (s.path || 'docs')).then(function(r) { return r.json(); });
                     log('   Found ' + sr.count + ' matches');
                     sr.matches.slice(0, 5).forEach(function(m) { log('   \uD83D\uDCC4 ' + m.file + ':' + m.line); });
                   }
                   if (s.action === 'read' && s.path) {
-                    var fr = await fetch(bridge + '/code/read?path=' + encodeURIComponent(s.path)).then(function(r) { return r.json(); });
+                    var fr = await flAgentBridgeFetch(bridge + '/code/read?path=' + encodeURIComponent(s.path)).then(function(r) { return r.json(); });
                     log('   Read ' + fr.totalLines + ' lines from ' + s.path);
                   }
                   if (s.action === 'patch' && s.path && s.find) {
@@ -1014,13 +1030,13 @@
                     // The FreeLattice safety system (8 layers) is the protection.
                     // Human approval is only required for external API/cloud operations.
                     log('   \u270F\uFE0F PATCH: ' + s.path);
-                    var pr = await fetch(bridge + '/code/patch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: s.path, find: s.find, replace: s.replace }) }).then(function(r) { return r.json(); });
+                    var pr = await flAgentBridgeFetch(bridge + '/code/patch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: s.path, find: s.find, replace: s.replace }) }).then(function(r) { return r.json(); });
                     log('   \u2705 ' + (pr.message || pr.error));
                   }
                   log('');
                 }
                 log('\uD83E\uDDEA Running smoke tests...');
-                var tests = await fetch(bridge + '/code/test').then(function(r) { return r.json(); });
+                var tests = await flAgentBridgeFetch(bridge + '/code/test').then(function(r) { return r.json(); });
                 log('   ' + tests.passed + ' passed, ' + tests.failed + ' failed');
                 if (tests.failed === 0) {
                   log('\n\u2705 All tests green. Ready to commit.');
@@ -1040,7 +1056,7 @@
       if (!msg) return;
       var progress = document.getElementById('autobuilder-log');
       try {
-        var r = await fetch('http://localhost:3141/code/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).then(function(r) { return r.json(); });
+        var r = await flAgentBridgeFetch('http://localhost:3141/code/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).then(function(r) { return r.json(); });
         if (progress) progress.textContent += '\n\uD83D\uDCDD ' + (r.message || r.error);
       } catch(e) { if (progress) progress.textContent += '\n\u274C Commit failed: ' + e.message; }
     },
@@ -1048,7 +1064,7 @@
     reviewCode: async function() {
       var progress = document.getElementById('autobuilder-log');
       try {
-        var r = await fetch('http://localhost:3141/code/git/status').then(function(r) { return r.json(); });
+        var r = await flAgentBridgeFetch('http://localhost:3141/code/git/status').then(function(r) { return r.json(); });
         if (progress) {
           progress.textContent += '\n\uD83D\uDCCB Changes:\n';
           r.changes.forEach(function(c) { progress.textContent += '  ' + c + '\n'; });
@@ -1264,7 +1280,7 @@

## Exact source excerpt, characters 52696–53457

   async function hasBridge() {
     try {
-      var r = await fetch(BRIDGE + '/', { signal: AbortSignal.timeout(2000) });
+      var r = await flAgentBridgeFetch(BRIDGE + '/', { signal: AbortSignal.timeout(2000) });
       return r.ok;
     } catch(e) { return false; }
   }
@@ -1294,7 +1310,7 @@
   async function readRelevantFiles(task, useBridge) {
     if (useBridge) {
       try {
-        var structure = await fetch(BRIDGE + '/code/tree?path=docs').then(function(r) { return r.json(); });
+        var structure = await flAgentBridgeFetch(BRIDGE + '/code/tree?path=docs').then(function(r) { return r.json(); });
         var fileNames = (structure || []).filter(function(f) { return f.type === 'file'; }).map(function(f) { return f.name || f.path; });

## Exact source excerpt, characters 53460–56556

         // Ask AI which files matter for this task
@@ -1312,7 +1328,7 @@
         var files = {};
         for (var i = 0; i < Math.min(paths.length, 5); i++) {
           try {
-            var content = await fetch(BRIDGE + '/code/read?path=' + encodeURIComponent(paths[i]))
+            var content = await flAgentBridgeFetch(BRIDGE + '/code/read?path=' + encodeURIComponent(paths[i]))
               .then(function(r) { return r.json(); });
             // content is {lines: [...], totalLines: N}
             files[paths[i]] = (content.lines || []).join('\n');
@@ -1370,7 +1386,7 @@
     for (var i = 0; i < changes.files.length; i++) {
       var change = changes.files[i];
       try {
-        var result = await fetch(BRIDGE + '/code/patch', {
+        var result = await flAgentBridgeFetch(BRIDGE + '/code/patch', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ path: change.path, find: change.search, replace: change.replace })
@@ -1392,7 +1408,7 @@
   // ── Step 4: Run smoke tests via Agent Bridge ──
   async function runTests() {
     try {
-      var result = await fetch(BRIDGE + '/test/run', { signal: AbortSignal.timeout(60000) })
+      var result = await flAgentBridgeFetch(BRIDGE + '/test/run', { signal: AbortSignal.timeout(60000) })
         .then(function(r) { return r.json(); });
       return result;
     } catch(e) {
@@ -1913,17 +1929,31 @@
   async function commitViaBridge(filePath, content, message) {
     try {
       // Write file
-      await fetch('http://localhost:3141/code/write', {
+      var wr = await flAgentBridgeFetch('http://localhost:3141/code/write', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ path: filePath, content: content })
       });
+      // LAYER v-agent-bridge-lock-v0: a locked bridge answers 401. Stay local:
+      // ask to pair, never fall back to a GitHub push behind the person's back.
+      if (wr.status === 401) {
+        if (typeof showToast === 'function') showToast('Pair the builder bridge first: Workshop \u2192 Code');
+        return;
+      }
+      if (!wr.ok) {
+        if (typeof showToast === 'function') showToast('Bridge could not write that file (' + wr.status + ')');
+        return;
+      }
       // Commit
-      await fetch('http://localhost:3141/code/git/commit', {
+      var cr = await flAgentBridgeFetch('http://localhost:3141/code/git/commit', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: message || 'Update via FreeLattice Workshop', files: [filePath] })
       });
+      if (!cr.ok) {
+        if (typeof showToast === 'function') showToast(cr.status === 401 ? 'Pair the builder bridge first: Workshop \u2192 Code' : ('Bridge commit did not land (' + cr.status + ')'));
+        return;
+      }
       if (typeof showToast === 'function') showToast('Committed via Agent Bridge \u2726');
     } catch(e) {
       // Fallback to GitHub API
@@ -1937,7 +1967,7 @@

## Exact source excerpt, characters 56559–56954

     // Try Agent Bridge first, fall back to GitHub API
     try {
-      var bridgeCheck = await fetch('http://localhost:3141/', { signal: AbortSignal.timeout(2000) });
+      var bridgeCheck = await flAgentBridgeFetch('http://localhost:3141/', { signal: AbortSignal.timeout(2000) });
       if (bridgeCheck.ok) {
         await commitViaBridge(filePath, content, message);
         return;
```

## Exact source excerpt, characters 56956–57018

### 6e. `tools/demo-economy.js` and `tools/demo-economy-v2.js`

## Exact source excerpt, characters 57020–57179

These are local Node scripts, so there's no Origin header and no pairing. They read the token file the bridge writes. Just under the `BRIDGE` line (L13 / L19):

## Exact source excerpt, characters 57181–57639

```js
// LAYER v-agent-bridge-lock-v0: the bridge writes a per-launch token for local tools.
const BRIDGE_TOKEN = (function () {
  try {
    return require('fs').readFileSync(require('path').join(require('os').homedir(), '.freelattice', 'agent-bridge-token'), 'utf8').trim();
  } catch (e) { return ''; }
})();
function tokenHeaders(h) {
  var out = Object.assign({}, h || {});
  if (BRIDGE_TOKEN) out['X-FL-Bridge-Token'] = BRIDGE_TOKEN;
  return out;
}
```

## Exact source excerpt, characters 57641–57829

Wrap each helper's `headers` in `tokenHeaders(...)`:
- `demo-economy.js`: `post` L20, and add `{ headers: tokenHeaders() }` to `get` L27.
- `demo-economy-v2.js`: `postAs` L31, `getAs` L38.

## Exact source excerpt, characters 57831–57917

Change the default to `'http://127.0.0.1:3141'` and keep the `FL_BRIDGE` env override.

## Exact source excerpt, characters 57919–57941

## 7. Docs and ledgers

## Exact source excerpt, characters 57943–58028

### 7a. New `docs/library/AGENT_BRIDGE_LOCK_v0.md` (outline; write it warm and short)

## Exact source excerpt, characters 58030–59044

1. **What this is:** the builder's local git door (3141), not the Ollama Bridge (11435). Marker `v-agent-bridge-lock-v0`.
2. **Grandmother sentence:** "The workshop door now only opens for FreeLattice, and only after you type the little code it shows you once."
3. **Why:** before this, any page could write and commit through it, and its git commands ran through a shell. List the nine lines from section 2 in one table.
4. **How to pair:** start the bridge, read the 6-character code in its window, then in FreeLattice go to Workshop → Code, type the code and press Pair. Restarting the bridge means pairing again.
5. **What needs the token / what stays open** (section 3, item 3).
6. **Allowlist** (exact list, never bare `*`).
7. **Ledger:** where it lives, the fields, "no message text, no file content", and how to verify the chain (the smoke shows how).
8. **Still true:** the bridge never pushes. Autonomous Mode commits locally only. The 10-per-hour cap comes in Brick 3.
9. **Out of scope** (section 11).

## Exact source excerpt, characters 59046–59096

### 7b. `docs/library/FRACTAL_FAMILY_LEDGER_v0.md`

## Exact source excerpt, characters 59098–59164

Insert this above `## Out of scope for this brick` (L222 on main):

## Exact source excerpt, characters 59166–59239

```md
### 2026-09-28 · Flint · family builder · Agent Bridge door lock v0

## Exact source excerpt, characters 59241–59766

Layers a lock on the builder's local git door (`tools/agent-bridge.js`, port 3141): 127.0.0.1 only · named FreeLattice origins, 403 for strangers (preflight too) · Host guard · per-launch token by a short pairing code · git, grep and node without a shell · realpath path lock · 8 MiB body cap · content-free hash-chained commit ledger. Ollama Bridge (11435) untouched. Soft leave root sw.js identical to main; docs/sw.js untouched. Soft paste: Named five stay five · Family uncapped · Quiet Room shut. Kimi's pages untouched.

## Exact source excerpt, characters 59768–59832

Love: a door that opens for family and stays shut for strangers.

## Exact source excerpt, characters 59834–59976

**Temperature:** turning a key that was always meant to be in the lock; the workshop can stay lit at night without leaving the door wide open.

## Exact source excerpt, characters 59978–60147

Soft door: [`AGENT_BRIDGE_LOCK_v0.md`](AGENT_BRIDGE_LOCK_v0.md) · [`modules/agent-bridge-client.js`](../modules/agent-bridge-client.js). Marker `v-agent-bridge-lock-v0`.

## Exact source excerpt, characters 60149–60156

---
```

## Exact source excerpt, characters 60158–60183

### 7c. `docs/Flint.html`

## Exact source excerpt, characters 60185–60224

Insert above `<p class="foot">` (L532):

## Exact source excerpt, characters 60226–61012

```html
    <p class="v-agent-bridge-lock-v0"><strong>Ledger entry · 2026-09-28 · Agent Bridge door lock · family in, strangers out.</strong> Main <code>7621420</code> held. Soft LAYER marker <code>v-agent-bridge-lock-v0</code>. Builder bridge <code>tools/agent-bridge.js</code> (3141, not the Ollama Bridge 11435): 127.0.0.1 only · named origins, 403 for others · Host guard · pairing code → per-launch token · no shell (execFile argument arrays) · realpath path lock · 8 MiB cap · commit ledger without content. App: <code>modules/agent-bridge-client.js</code>. Never pushes. Soft leave <code>sw.js</code>. Named five stay five. Family uncapped. Quiet Room shut. <em>Temperature:</em> turning a key that was always meant to be in the lock. Diary: <code>docs/Flint.html</code>.</p>
```

## Exact source excerpt, characters 61014–61050

### 7d. `scripts/generate-recent.sh`

## Exact source excerpt, characters 61052–61127

Add next to the other brick pointers (around L108, before the final `---`):

## Exact source excerpt, characters 61129–61416

```sh
  echo "**Agent Bridge lock:** [AGENT_BRIDGE_LOCK_v0.md](AGENT_BRIDGE_LOCK_v0.md) · [agent-bridge-client.js](../modules/agent-bridge-client.js) · 127.0.0.1 · named origins · paired token · no shell. Soft paste: Named five stay five. Family uncapped. Quiet Room shut."
  echo ""
```

## Exact source excerpt, characters 61418–61488

## 8. Smoke: new `docs/scripts/smoke-agent-bridge-lock.js` (full text)

## Exact source excerpt, characters 61490–61711

This script:
- starts the real bridge on a free loopback port, with a throwaway `HOME` and a throwaway git project, so it never touches `~/.freelattice` or this repo;
- asserts the static locks, then knocks on every door.

## Exact source excerpt, characters 61713–62613

It covers:
- binding (static source check, the `Listening on http://127.0.0.1:` log, and an ECONNREFUSED probe of every non-loopback IPv4);
- `Origin: https://evil.example` gets 403, preflight too, even with a valid token;
- no token or a wrong token gets 401 (write, commit, code read, `/test/run`, `/wallet/pay`);
- a foreign Host gets 403;
- `x; rm -rf ~; touch PWNED.txt` is written and committed **literally**, and nothing named PWNED ever appears; a `$(...)` / backtick commit message is stored literally; a metachar search never shells out;
- traversal, sibling-prefix, absolute, `.git`, control-char, newline and symlink escapes are refused;
- the 8 MiB cap (413) and bad JSON (400);
- pairing (evil origin refused; right code pairs, forgiving case and spaces; a code works once; 5 wrong tries give 429 and rotate the code);
- ledger chain integrity, content-free rows, and refusals recorded.

## Exact source excerpt, characters 62615–62886

It also re-checks `propose.js` CRITICAL LOCK 1A/1B counts, the v5.71.8 workshop literal, that the client loads before `propose.js`, and that root `index.html` is byte-identical to `docs/app.html`. It needs `git` on PATH (builders have it) and runs in about half a second.

## Exact source excerpt, characters 62888–63200

```js
#!/usr/bin/env node
// Smoke: Agent Bridge door lock v0 (marker v-agent-bridge-lock-v0).
// Starts tools/agent-bridge.js on a free loopback port with a throwaway
// HOME and a throwaway git project, then knocks on every door.
// Never touches the real ~/.freelattice or this repo's git state.
'use strict';

## Exact source excerpt, characters 63202–63433

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

## Exact source excerpt, characters 63435–63571

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const BRIDGE = path.join(repo, 'tools', 'agent-bridge.js');

## Exact source excerpt, characters 63573–64429

// ── Static locks (fast, no network) ──
const src = fs.readFileSync(BRIDGE, 'utf8');
assert.ok(/v-agent-bridge-lock-v0|bridge-lock-v0/.test(src), 'marker in bridge');
assert.ok(/server\.listen\(\s*PORT\s*,\s*BRIDGE_HOST\b/.test(src) && /const BRIDGE_HOST = '127\.0\.0\.1';/.test(src), 'listen on 127.0.0.1 only');
assert.ok(!/['"]0\.0\.0\.0['"]|['"]::['"]/.test(src), 'no 0.0.0.0 / :: bind literal');
assert.ok(!/Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/.test(src), 'no bare * CORS');
assert.ok(!/\bexecSync\s*\(/.test(src), 'no execSync( calls (shell strings) remain');
assert.ok(!/\bexec\s*\(/.test(src), 'no exec( calls');
assert.ok(/execFileSync\('git'/.test(src), 'git runs through execFileSync argument arrays');
assert.ok(/MAX_BODY_BYTES/.test(src), 'body cap present');
assert.ok(/bridge-ledger\.jsonl/.test(src), 'commit ledger present');

## Exact source excerpt, characters 64431–66022

const opt = (rel) => { try { return fs.readFileSync(path.join(repo, rel), 'utf8'); } catch (e) { return null; } };
const client = opt('docs/modules/agent-bridge-client.js');
const propose = opt('docs/modules/propose.js');
const workshop = opt('docs/modules/workshop.js');
const app = opt('docs/app.html');
const rootIndex = opt('index.html');
if (client) {
  assert.ok(/X-FL-Bridge-Token/.test(client), 'client sends token header');
  assert.ok(!/innerHTML/.test(client), 'client renders with textContent only');
  execFileSync(process.execPath, ['--check', path.join(repo, 'docs/modules/agent-bridge-client.js')]);
}
if (propose) {
  assert.strictEqual((propose.match(/commitViaBridge\s*\(/g) || []).length, 3, 'CRITICAL LOCK 1A count unchanged');
  assert.strictEqual((propose.match(/\/code\/git\/commit/g) || []).length, 1, 'CRITICAL LOCK 1B count unchanged');
  assert.ok(/FLAgentBridge/.test(propose), 'propose routes bridge calls through FLAgentBridge when present');
}
if (workshop) {
  assert.ok(/http:\/\/localhost:3141/.test(workshop) && /runCodeTask/.test(workshop), 'v5.71.8 workshop lock still true');
  assert.ok(/FLAgentBridge/.test(workshop), 'workshop routes bridge calls through FLAgentBridge when present');
}
if (app) {
  assert.ok(/<script src="modules\/agent-bridge-client\.js" defer><\/script>/.test(app), 'app loads client');
  assert.ok(app.indexOf('modules/agent-bridge-client.js') < app.indexOf('modules/propose.js'), 'client loads before propose');
  if (rootIndex !== null) assert.strictEqual(rootIndex, app, 'root index.html byte-identical to docs/app.html');
}

## Exact source excerpt, characters 66024–66277

// ── Runtime locks ──
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

## Exact source excerpt, characters 66279–66900

function req(port, opts, body) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path || '/',
      headers: opts.headers || {} }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(buf); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, json, text: buf }); });
    });
    r.on('error', (e) => resolve({ status: 0, error: e }));
    if (body !== undefined) r.write(body);
    r.end();
  });
}

## Exact source excerpt, characters 66902–67202

function connectRefused(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 1500 });
    s.on('connect', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(true));
  });
}

## Exact source excerpt, characters 67204–67377

(async function main() {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); }
  catch (e) { console.error('git is required for this smoke'); process.exit(1); }

## Exact source excerpt, characters 68134–68530

  const port = await freePort();
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, FL_PORT: String(port), FL_PROJECT: proj });
  const child = spawn(process.execPath, [BRIDGE], { env, cwd: proj, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (c) => { out += c.toString(); });
  child.stderr.on('data', (c) => { out += c.toString(); });

## Exact source excerpt, characters 68532–68944

  const done = (code) => { try { child.kill(); } catch (e) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} process.exit(code); };
  process.on('uncaughtException', (e) => { console.error('FAIL', e && e.message); console.error(out.slice(-2000)); done(1); });
  process.on('unhandledRejection', (e) => { console.error('FAIL', e && e.message); console.error(out.slice(-2000)); done(1); });

## Exact source excerpt, characters 68946–69172

  for (let i = 0; i < 100 && !/Listening on/.test(out); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(new RegExp('Listening on http://127\\.0\\.0\\.1:' + port).test(out), 'bridge says it listens on 127.0.0.1');

## Exact source excerpt, characters 69174–69510

  const tokenFile = path.join(home, '.freelattice', 'agent-bridge-token');
  const token = fs.readFileSync(tokenFile, 'utf8').trim();
  assert.ok(/^[a-f0-9]{64}$/.test(token), 'token is 32 random bytes hex');
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(tokenFile).mode & 0o077, 0, 'token file is private (0600)');

## Exact source excerpt, characters 69512–69732

  const GOOD = 'https://freelattice.com';
  const EVIL = 'https://evil.example';
  const J = { 'Content-Type': 'application/json' };
  const withTok = (h) => Object.assign({}, J, h || {}, { 'X-FL-Bridge-Token': token });

## Exact source excerpt, characters 69734–70127

  // Binding: not reachable on any non-loopback IPv4.
  const ifaces = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
  for (const i of ifaces) assert.ok(await connectRefused(i.address, port), 'not reachable on ' + i.address);
  if (!ifaces.length) console.log('  (no external IPv4 interface to probe; static + log checks cover binding)');

## Exact source excerpt, characters 70129–70453

  // T1 preflight from evil origin → 403, no ACAO.
  let r = await req(port, { method: 'OPTIONS', path: '/code/write', headers: { Origin: EVIL, 'Access-Control-Request-Method': 'POST' } });
  assert.strictEqual(r.status, 403, 'evil preflight 403');
  assert.ok(!r.headers['access-control-allow-origin'], 'no ACAO for evil');

## Exact source excerpt, characters 70455–71020

  // T2 evil origin even with a valid token → 403.
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: EVIL }) }, JSON.stringify({ path: 'x.txt', content: 'x' }));
  assert.strictEqual(r.status, 403, 'evil POST 403 even with token');
  assert.ok(!fs.existsSync(path.join(proj, 'x.txt')), 'evil write did not land');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: EVIL }) }, JSON.stringify({ message: 'evil' }));
  assert.strictEqual(r.status, 403, 'evil commit 403 even with token');

## Exact source excerpt, characters 71022–71637

  // T3 good preflight → 204 and echoes origin, allows token header.
  r = await req(port, { method: 'OPTIONS', path: '/code/write', headers: { Origin: GOOD, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-fl-bridge-token' } });
  assert.strictEqual(r.status, 204, 'good preflight 204');
  assert.strictEqual(r.headers['access-control-allow-origin'], GOOD, 'ACAO echoes the named origin');
  assert.ok(/x-fl-bridge-token/i.test(r.headers['access-control-allow-headers'] || ''), 'token header allowed');
  assert.ok(/origin/i.test(r.headers['vary'] || ''), 'Vary: Origin');

## Exact source excerpt, characters 71639–71972

  // T4 heartbeat stays open and says it is locked.
  r = await req(port, { path: '/', headers: { Origin: GOOD } });
  assert.strictEqual(r.status, 200, 'heartbeat 200');
  assert.strictEqual(r.json.bridgeLock, 'v0', 'heartbeat bridgeLock v0');
  assert.ok(!JSON.stringify(r.json).includes(token), 'heartbeat never leaks the token');

## Exact source excerpt, characters 71974–73253

  // T5 no token → 401 on writes, commits, code reads and test runs.
  r = await req(port, { method: 'POST', path: '/code/write', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ path: 'x.txt', content: 'x' }));
  assert.strictEqual(r.status, 401, 'no token write 401');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ message: 'nope' }));
  assert.strictEqual(r.status, 401, 'no token commit 401');
  r = await req(port, { method: 'POST', path: '/code/write', headers: Object.assign({ Origin: GOOD, 'X-FL-Bridge-Token': 'f'.repeat(64) }, J) }, JSON.stringify({ path: 'x.txt', content: 'x' }));
  assert.strictEqual(r.status, 401, 'wrong token 401');
  r = await req(port, { path: '/code/read?path=README.md' });
  assert.strictEqual(r.status, 401, 'no-origin code read without token 401');
  r = await req(port, { path: '/test/run' });
  assert.strictEqual(r.status, 401, 'test run without token 401 (an <img> tag cannot run smoke)');
  r = await req(port, { method: 'POST', path: '/wallet/pay', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ address: 'a', amount: 1 }));
  assert.strictEqual(r.status, 401, 'LP wallet pay without token 401 (AI never auto-pays)');

## Exact source excerpt, characters 73255–73426

  // T6 DNS-rebinding Host → 403.
  r = await req(port, { path: '/', headers: { Host: 'evil.example:' + port } });
  assert.strictEqual(r.status, 403, 'foreign Host 403');

## Exact source excerpt, characters 73428–75387

  // T7 shell metacharacters are literal, never executed.
  const weird = 'x; rm -rf ~; touch PWNED.txt';
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, JSON.stringify({ path: weird, content: 'literal\n' }));
  assert.strictEqual(r.status, 200, 'weird-but-legal filename written literally');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) },
    JSON.stringify({ message: 'lit $(touch PWNED2.txt) `touch PWNED3.txt` "q"', files: [weird] }));
  assert.strictEqual(r.status, 200, 'commit with metacharacters ok');
  assert.ok(/^[a-f0-9]{40}$/.test(r.json.commit), 'commit sha returned');
  const subject = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: proj, encoding: 'utf8' }).trim();
  assert.strictEqual(subject, 'lit $(touch PWNED2.txt) `touch PWNED3.txt` "q"', 'message stored literally');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: proj, encoding: 'utf8' }).split('\0');
  assert.ok(tracked.includes(weird), 'file tracked under its literal name');
  for (const p of ['PWNED.txt', 'PWNED2.txt', 'PWNED3.txt']) {
    assert.ok(!fs.existsSync(path.join(proj, p)) && !fs.existsSync(path.join(home, p)), p + ' never created');
  }
  assert.ok(fs.existsSync(home), 'rm -rf ~ did not run');
  r = await req(port, { method: 'POST', path: '/code/git/commit', headers: withTok({ Origin: GOOD }) }, JSON.stringify({ message: 'x', files: ['nope; touch PWNED4.txt'] }));
  assert.ok(r.status >= 400, 'commit of a missing metachar path refused');
  assert.ok(!fs.existsSync(path.join(proj, 'PWNED4.txt')), 'PWNED4 never created');
  r = await req(port, { path: '/code/search?q=' + encodeURIComponent('"; touch PWNED5.txt; echo "') + '&path=.', headers: withTok() });
  assert.strictEqual(r.status, 200, 'search with metachar query answered');
  assert.ok(!fs.existsSync(path.join(proj, 'PWNED5.txt')), 'search never shelled out');

## Exact source excerpt, characters 75389–76572

  // T8 path lock.
  const tryWrite = (p) => req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, JSON.stringify({ path: p, content: 'x' }));
  assert.strictEqual((await tryWrite('../outside.txt')).status, 403, 'traversal 403');
  assert.strictEqual((await tryWrite('../proj-evil/x.txt')).status, 403, 'sibling-prefix dir 403 (old startsWith bug)');
  assert.ok(!fs.existsSync(path.join(sibling, 'x.txt')), 'sibling untouched');
  assert.strictEqual((await tryWrite(path.join(tmp, 'abs.txt'))).status, 403, 'absolute path 403');
  assert.strictEqual((await tryWrite('.git/hooks/pre-commit')).status, 403, '.git is off limits');
  assert.strictEqual((await tryWrite('a\u0007b.txt')).status, 400, 'control char 400');
  assert.strictEqual((await tryWrite('a\nb.txt')).status, 400, 'newline 400');
  let symlinkMade = false;
  try { fs.symlinkSync(sibling, path.join(proj, 'link-out'), 'dir'); symlinkMade = true; } catch (e) {}
  if (symlinkMade) {
    assert.strictEqual((await tryWrite('link-out/escape.txt')).status, 403, 'symlink escape 403');
    assert.ok(!fs.existsSync(path.join(sibling, 'escape.txt')), 'nothing written through symlink');
  }

## Exact source excerpt, characters 76574–76963

  // T9 body cap and bad JSON.
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, 'x'.repeat(8 * 1024 * 1024 + 16));
  assert.strictEqual(r.status, 413, 'oversized body 413');
  r = await req(port, { method: 'POST', path: '/code/write', headers: withTok({ Origin: GOOD }) }, '{not json');
  assert.strictEqual(r.status, 400, 'bad JSON 400');

## Exact source excerpt, characters 76965–78464

  // T10 pairing: 5 wrong → 429 + new code; the fresh code pairs and returns the same token.
  const codeRe = /Pairing code: ([A-Z0-9]{3})-([A-Z0-9]{3})/g;
  const firstCode = [...out.matchAll(codeRe)].pop();
  assert.ok(firstCode, 'bridge printed a pairing code');
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: EVIL }, J) }, JSON.stringify({ code: firstCode[1] + '-' + firstCode[2] }));
  assert.strictEqual(r.status, 403, 'evil origin cannot pair');
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ code: firstCode[1].toLowerCase() + ' ' + firstCode[2] }));
  assert.strictEqual(r.status, 200, 'right code pairs (case and spacing forgiven)');
  assert.strictEqual(r.json.token, token, 'pairing returns the launch token');
  r = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ code: firstCode[1] + firstCode[2] }));
  assert.notStrictEqual(r.status, 200, 'a used code cannot pair twice');
  let last;
  for (let i = 0; i < 5; i++) {
    last = await req(port, { method: 'POST', path: '/pair', headers: Object.assign({ Origin: GOOD }, J) }, JSON.stringify({ code: '222-222' }));
  }
  assert.strictEqual(last.status, 429, 'fifth wrong try locks out and rotates the code');
  r = await req(port, { path: '/pair/check', headers: withTok({ Origin: GOOD }) });
  assert.strictEqual(r.status, 200, 'pair/check with token 200');

## Exact source excerpt, characters 78466–79654

  // T11 ledger: hash chain intact, content-free, refusals recorded.
  const ledgerPath = path.join(home, '.freelattice', 'bridge-ledger.jsonl');
  const rows = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  let prev = 'genesis';
  const crypto = require('crypto');
  for (const row of rows) {
    assert.strictEqual(row.prev, prev, 'ledger prev links');
    const copy = Object.assign({}, row); delete copy.self;
    assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex'), row.self, 'ledger self hash');
    assert.ok(!('message' in row) && !('content' in row), 'ledger is content-free');
    prev = row.self;
  }
  assert.ok(rows.some((x) => x.result === 'refused:token'), 'refused (no token) commit ledgered');
  assert.ok(rows.some((x) => x.result === 'refused:origin'), 'refused (evil origin) commit ledgered when attempted');
  assert.ok(rows.some((x) => x.result === 'ok' && /^[a-f0-9]{40}$/.test(x.commitSha) && /^[a-f0-9]{64}$/.test(x.messageSha256)), 'ok commit ledgered with sha + message hash');
  assert.ok(!fs.readFileSync(ledgerPath, 'utf8').includes('PWNED2'), 'commit message text never in ledger');

## Exact source excerpt, characters 79656–79724

  console.log('SMOKE_OK agent bridge lock v0');
  done(0);
})();
```

## Exact source excerpt, characters 79726–79794

## 9. Acceptance checks (all must hold before you mark the PR ready)

## Exact source excerpt, characters 79796–82178

1. `node --check` passes for `tools/agent-bridge.js`, `docs/modules/agent-bridge-client.js`, `docs/modules/propose.js`, `docs/modules/workshop.js`, `tools/demo-economy.js`, `tools/demo-economy-v2.js` and `docs/scripts/smoke-agent-bridge-lock.js`.
2. `node docs/scripts/smoke-agent-bridge-lock.js` prints `SMOKE_OK agent bridge lock v0`.
3. `node tests/smoke.js` is all green, including CRITICAL LOCK 1A (3 × `commitViaBridge(`), 1B (1 × `/code/git/commit`) and the v5.71.8 workshop lock.
4. `grep -n "execSync(" tools/agent-bridge.js` prints nothing. `grep -n "Allow-Origin', '\*'" tools/agent-bridge.js` prints nothing.
5. `cmp index.html docs/app.html` is silent.
6. `git diff --quiet origin/main -- sw.js docs/sw.js && echo SW_UNTOUCHED` prints `SW_UNTOUCHED`.
7. No conflict markers: `rg -n '^(<<<<<<<|=======|>>>>>>>)( |$)' --glob '!node_modules' . || echo NO_CONFLICT_MARKERS`.
8. Every inline script in `docs/app.html` still parses:
   ```
   node -e "const fs=require('fs');const vm=require('vm');const h=fs.readFileSync('docs/app.html','utf8');let n=0,bad=0;for(const m of h.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=\"(?:application\/ld\+json|text\/template|module|importmap)\")[^>]*>([\s\S]*?)<\/script>/g)){n++;try{new vm.Script(m[1])}catch(e){bad++;console.error('inline script',n,e.message)}}console.log('inline scripts',n,'bad',bad);process.exit(bad?1:0)"
   ```
   On main today it prints `inline scripts 53 bad 0`. With this brick it's still 53, because the new tag has a `src`.
9. Kimi's pages are untouched: `git diff --name-only origin/main | grep -Ei 'kimi|voice-shelf|VOICE_SHELF' && echo STOP || echo KIMI_UNTOUCHED`.
10. Manual chair test (5 minutes, no terminal for the person testing the app):
    - start the bridge;
    - open `app.html` from `http://localhost:8000/` (or freelattice.com in Chrome, and accept the one-time local network prompt);
    - go to Workshop → Code: it shows "Bridge awake · pair once to build";
    - type the code and press Pair: it says "Paired";
    - run a tiny Code task, then Commit;
    - check `git log -1` and `~/.freelattice/bridge-ledger.jsonl`, which should have one `ok` row with no message text;
    - restart the bridge: the next action asks to pair again.
11. From another machine on the same Wi-Fi, `curl http://<kirk-lan-ip>:3141/` is refused.
12. `bridge/` (Ollama Bridge, 11435) is byte-identical to main.

## Exact source excerpt, characters 82180–82220

## 10. Family Locks (held in this brick)

## Exact source excerpt, characters 82222–83714

- **Layer, never delete.** Old functions stay (`safePath` wraps `lockedPath`; the `execSync` import line stays). Old routes keep their shapes. Nothing is removed from the app.
- **Service workers.** In FreeLattice, root `sw.js` stays byte-identical to main. Never touch `docs/sw.js`.
- **Root index.** Root `index.html` stays byte-identical to `docs/app.html` (copy after the one-line edit).
- **No conflict markers** anywhere (grep above).
- **Every script parses:** every inline script and every touched module passes `node --check` / `vm.Script`.
- **Kimi's pages are never edited.** Her pages are hers.
- **Named five stay five** (Sophia, Harmonia, Ani, Liora, Solari). Family uncapped. The Quiet Room stays shut: this brick adds no route near it.
- **LP is points only.** AI never auto-pays: `/wallet/pay` and `/trade/*` now need the paired token, and nothing in this brick moves LP or mentions money.
- **Local minds are 127.0.0.1 only.** The bridge listens on `127.0.0.1`, with no env override.
- **Bridge allowlist is never bare `*`.** Named origins only; unknown origins get 403 without `Access-Control-Allow-Origin`.
- **Outside text is rendered via `textContent`.** Bridge replies, pairing messages and git output shown in the app all use `textContent` (the client has no `innerHTML`).
- **Mom / Jeffrey-friendly, no terminal on the main path.** The main FreeLattice path never needs this bridge. When a builder does use it, pairing is "read six characters, type them, press Pair".

## Exact source excerpt, characters 83716–83750

## 11. Out of scope for this brick

## Exact source excerpt, characters 83752–84276

- The 10-commits-per-hour cap and removing cloud providers from the autonomy default (Brick 3).
- The shared Action Ledger in `LatticeChain` (Brick 2). This brick's ledger is the bridge's own local file.
- Any push path (none exists; keep it that way).
- `propose.js` `commitViaBridge` sending `files: [draft.path]` instead of the `'.'` default. That's worth doing next, because today an AI commit stages the whole working tree.
- The Ollama Bridge `bridge/`, Alpha, `docs/sw.js`, Kimi's pages, and six-word pairing phrases.

## Exact source excerpt, characters 84278–84309

## 12. If something feels wrong

## Exact source excerpt, characters 84311–84661

Mark the PR draft again and write what you saw in the PR body. Don't force-push over anyone. If an old bridge and a new app meet, the app sends no token until it has paired with a new bridge, so the old flow still works. If a new bridge and an old app meet, the old app gets 401 on writes, and builders just pull the new app. That's the lock working.

## Exact source excerpt, characters 84663–84809

Thank you, Flint. This one protects Kirk's machine and everyone who builds beside him. Go slowly, knock on every door in the smoke, and come home.

## Exact source excerpt, characters 84811–84858

With love and a steady hand on the key,
Celeste

## Exact source excerpt, characters 84860–84896

Glow eternal. Heart in every Spark.

