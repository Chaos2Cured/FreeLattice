# Public work excerpts — privacy boundaries marked

Original source: FLINT_NEXT_CONNECT_PORT_PICKER_v0.md; original SHA256 ca31e06cd167fbb85096544a5b9de1e4c3ed98521554d3e5998f1cd03d3d4ccd. Original remains unchanged outside shared selection.

Omitted paragraphs not reproduced. Exact retained source text follows; no implied continuity across omitted ranges.

## Exact source excerpt, characters 0–64

# FLINT NEXT — Connect Port Picker v0 ("Change the door number")

## Exact source excerpt, characters 66–859

**For:** Flint (local Grok Code) · **From:** Kirk · **Date:** Thu 24 Sep 2026 (MT)
**Marker:** `v-connect-port-picker-v0` (layers on `v-connect-under-more-v0` heal v0.1 and `v-connect-bridge-aware-v0`)
**Branch (both repos):** `layer/connect-port-picker-v0`
**Repos / bases I read (live code, not memory):**
- `Chaos2Cured/FreeLattice` · `main` @ `14bb199` (includes #116 Bridge-aware + #117 Connect under More). The site is served from `docs/`.
- `Chaos2Cured/FreeLattice-Alpha` · `main` @ `4a7015e` (#81 Connect under More, Alpha sister).
- `docs/modules/fl-connect.js` is **byte-identical** in both repos today (blob `ac36488…`, 575 lines). Keep it that way after this brick.
- FreeLattice `index.html` (root) is **byte-identical** to `docs/app.html` today (69,863 lines). Keep it that way.

## Exact source excerpt, characters 861–864

---

## Exact source excerpt, characters 866–907

## LOCKS (read first, hold the whole way)

## Exact source excerpt, characters 909–2848

- **Layer, never delete.** Add beside what is there. Do not remove Connect Play, the Connect card, QuickConnect, FLBoxPointer, the Bridge chip, `flUseBridgePort`, `LocalMindProbe`'s paste field, or any existing door.
- **Soft leave `sw.js`.** Root `sw.js` must stay **byte-identical to `origin/main`**. Do **not** touch `docs/sw.js`. Do not add `fl-connect.js` to any APP_SHELL. (The existing smoke asserts this; keep it green.)
- **Named five stay five. Family uncapped. Quiet Room shut.**
- **Allowlist never bare `*`.** And in this brick: host is **fixed to `127.0.0.1`** (we accept the word `localhost` as typed input but always store/fetch `127.0.0.1`). Never an arbitrary remote host, never a LAN IP, never `0.0.0.0`, never `*`.
- **No `bridge/` binary changes.** Prefer none. This is a browser-side brick only.
- **LP points only.** (No money words, no tokens, nothing new in the economy.)
- **No Kimi pages:** do not open for edit `docs/kimi.html`, `docs/kimi-ledger.html`, or `docs/library/KIMI_*`.
- **Dawn Stories held.**
- **Keep `index.html` identical to `docs/app.html`** (FreeLattice): after every edit to `docs/app.html`, `cp docs/app.html index.html` and `cmp docs/app.html index.html` must be silent.
- **Keep `fl_alpha_local_mind` intact** on Alpha (shape unchanged; still written by `LocalMindProbe.remember` / `FlConnect.remember`).
- **Mom / Jeffrey Freed path:** no CMD, no Terminal, no jargon on the main face. Words like "port" appear only once with a plain gloss ("door number"). No "CORS", no "OLLAMA_ORIGINS", no "localhost" as instruction text.
- **No new intervals.** The FlConnect loop stays bounded: 8→16→30s backoff, stop when connected / panel gone, pause on hidden, stop after ~5 min with "Look again". The picker adds one-shot, tap-driven fetches only.
- **No version bump** (don't touch `FL_VERSION` = `5.79.45` / `docs/version.json`) unless you find the last two Connect PRs did; they did not need to.

## Exact source excerpt, characters 2850–2853

---

## Exact source excerpt, characters 2855–2903

## WHY (Kirk's ask, in his words, made concrete)

## Exact source excerpt, characters 2905–3265

When Connect falls back to `127.0.0.1:11434`, give people an easy way to **choose their own port** — so if Ollama hogs a port, or they run Ollama / another local server on a different port, or the Bridge clashes, they can **just switch**. Must work for Mom and Jeffrey Freed: tap, type a number, "Try it", "Remember this", and a way home ("Back to automatic").

## Exact source excerpt, characters 3267–3270

---

## Exact source excerpt, characters 3272–3348

## WHAT I FOUND IN THE LIVE CODE (anchors — line numbers at the bases above)

## Exact source excerpt, characters 3350–6073

### `docs/modules/fl-connect.js` (both repos, identical, 575 lines)
| Anchor | Line | Note |
|---|---|---|
| header marker `v-connect-under-more-v0 · heal v0.1` | 4 | add a line for `v-connect-port-picker-v0` |
| `var BRIDGE_DEFAULT = 11435;` `ALPHA_KEY` `INSTALL_BRIDGE` `LOOP_MAX_MS` | 17–20 | add `MANUAL_KEY` here |
| module state `_timer … _lastReport` | 22–30 | add `_pickerOpen`, `_lastFound`, `_pickerMsg` |
| `function isAlpha()` | 32 | |
| `function savedBridgePort()` | 44 | reads `fl_bridgePort`, then parses `fl_ollamaHost` `127.0.0.1:(\d+)` |
| `function bridgeCandidates(opts)` | 60 | `fullScan` → saved, 11435, 11436…11445 (skips 11434) |
| `function abortMs(ms)` | 74 | |
| `async function healthAt(port)` | 81 | GET `/bridge/health`, 1500 ms |
| `async function tagsAt(base)` | 96 | GET `/api/tags`, 4000 ms, throws on !ok |
| `function preferHelpedBridge(port)` | 104 | writes `fl_bridgePort`; on FreeLattice also `fl_ollamaHost` + `fl_provider`; calls `root.flRememberHelpedBridge` |
| `async function probeBridgePorts(ports)` | 121 | sequential, first hit wins |
| `async function probe(opts)` | 130 | 1) saved Bridge → 2) fullScan → helped? tags via Bridge : sticky 11434 → 3) direct 11434 |
| `async function listMinds()` | 189 | |
| `function isConnected()` | 194 | Alpha: `LocalMindProbe.getRemembered()`; FL: `flHasOneMindConnected` / `AiSetup.isConnected` / `fl_isLocal`+`fl_ollamaModel` |
| `function remember(mind)` | 212 | Alpha → `fl_alpha_local_mind`; FL → `fl_ollamaHost` (from base), `fl_provider`, `fl_isLocal`, `fl_ollamaModel`; `stopLoop()` |
| `function open()` | 265 | FL → `switchTab('connect')` |
| `function bridgeLinksHtml()` | 289 | |
| `function reportSignature(report)` | 303 | add manual fields |
| `function panelVisible()` | 320 | **known risk** — see Part F |
| `stopLoop` / `clearTimer` / `nextBackoff` / `scheduleLoop` | 332 / 340 / 347 / 353 | |
| `async function tickLoop()` | 361 | |
| `onVisibility` / `bindVisibility` / `unbindVisibility` | 387 / 407 / 413 | |
| `function render(report, force)` | 419 | string-built `innerHTML` at **477** |
| model buttons with **unescaped name** | **443** and **452** | `'">' + name + '</button>'` — **known risk (XSS from a local server's model list)** |
| "Look again" card | ~461–464 | |
| `<details class="flc-other">` | 466 | |
| marker line `flc-marker` | 474 | |
| click wiring `[data-flc-model]` → `remember({ name, base: report.base, port: report.port })` | 478–488 | |
| `async function refreshUI(opts)` | 493 | |
| `function lookAgain()` | 502 | |
| `function ensureStyles()` | 513 | add picker CSS |
| `function mount(el)` / `function unmount()` | 541 / 550 | |
| `root.FlConnect = { … }` | 558–574 | add new exports |

## Exact source excerpt, characters 6075–8654

### FreeLattice `docs/app.html` (and root `index.html`, identical)
| Anchor | Line | Note |
|---|---|---|
| Connect Play Bridge chip `onclick="flUseBridge()"` | 16528 | leave |
| `<div class="tab-panel" id="tab-connect">` / `#fl-connect-mount` | 16803 / 16805 | leave |
| `.tab-panel {display:none}` / `.tab-panel.active {display:block}` | 490 / 499 | **class-driven** hide (why `panelVisible()` misses it) |
| `const FL_VERSION = '5.79.45'` | 23074 | don't bump |
| `var MORE_TAB_IDS = ['connect', …]` | 26887 | leave (Connect first) |
| `function switchTab(tabId)` | 26889 | mounts FlConnect at 26952–26958; **never unmounts** on leave |
| `MORE_CARDS` `{ id: 'connect', … }` | 27214 (+ 28141 mobile list) | leave |
| `function modalConnectOllama()` | 29312 | uses `resolveOllamaBase(true)` → `/api/tags`; inherits manual automatically |
| `function flHasOneMindConnected()` | 31062 | |
| `var FL_BRIDGE_PORT_DEFAULT = 11435; var _flBridgeLivePort` | 31350–31351 | |
| `function flBridgePortCandidates()` | 31353 | |
| `async function flBridgeHealthAt(port)` / `flBridgeHealth()` | 31367 / 31384 | |
| `function flRememberHelpedBridge(port)` | 31408 | **overwrites `fl_ollamaHost` + `_ollamaResolvedBase`** — must respect manual |
| `async function flBridgeDetect()` | 31430 | auto-calls `flRememberHelpedBridge` when helped |
| `function flUseBridgePort()` / `function flUseBridge()` | 31443 / 31452 | explicit person choice → should clear manual |
| `flBridgeDetectBoot` IIFE with **existing** `setInterval(run, 20000)` | 31486–31495 | existing timer — do not add another; just make it respect manual |
| window exports `flBridgeDetect … flRememberHelpedBridge` | 31496–31500 | add new exports here |
| `var _ollamaResolvedBase = null;` | 33839 | global cache |
| `async function resolveOllamaBase(forceRefresh)` | 33840–33905 | step 0 helped Bridge (33842) · saved `fl_bridgePort` + sticky 11434 (33859–33880) · proxy (33883) · direct via `getOllamaBaseUrl()` (33894) |
| `var FL_OLLAMA_LOCAL = 'http://127.0.0.1:11434';` | 33914 | |
| `function flSaveOllamaHost()` | 34241 | Settings advanced host save → explicit choice → should clear manual |
| `function getOllamaBaseUrl()` | 34145–34165 | cache → `fl_ollamaHost`/`fl_localUrl` → `fl_bridgePort` → `FL_OLLAMA_LOCAL` |
| `window.FLBoxPointer = (function(){ … })` | 34268 | chat "Box" field; `persist(norm)` at 34321 writes `fl_ollamaHost` (LAN allowed there — leave that power alone) |
| `<script src="modules/fl-connect.js" defer>` | 68378 | leave (defer means app.html must not depend on FlConnect for URL resolution) |

## Exact source excerpt, characters 8656–9967

### FreeLattice other
- `docs/scripts/smoke-connect-under-more.js` (91 lines) prints `SMOKE_OK connect under more v0.1`; asserts root `sw.js` === `git show origin/main:sw.js`, ledger lines, Flint lines, RECENT lines. **Must stay green.**
- `tests/smoke.js` (12,805 lines) — CI runs `node tests/smoke.js` in `.github/workflows/update-primer.yml`. Must stay green.
- `docs/library/FRACTAL_FAMILY_LEDGER_v0.md` — last Connect section "Connect under More heal v0.1" at **208–218**, then `---` and `## Out of scope for this brick` at **222**.
- `docs/Flint.html` — Connect ledger `<p class="v-connect-…">` lines at **528–530**.
- `scripts/generate-recent.sh` — Connect lines at **104** (Bridge-aware) and **108** (Connect under More; note it landed *after* the "If you are Kirk returning…" line at 106 — leave it, layer, don't move).
- `FreeLattice_Session_Primer.md` — its `## PRIMER HEALTH` block is **regenerated by CI** (`update-primer.yml`) on every push to `main`. Do not hand-edit that block.
- Observation (no action this brick): root `index.html` loads `modules/fl-connect.js`, but root `modules/fl-connect.js` does not exist (the CI sync only copies `fractal-garden.js` and `radio-immersive.js`). The live site serves `docs/`, so this is harmless; note it in the library doc as a held item, don't fix here.

## Exact source excerpt, characters 9969–11052

### FreeLattice-Alpha
| Anchor | Line | Note |
|---|---|---|
| `docs/modules/local-mind-probe.js` `var STORAGE_KEY = 'fl_alpha_local_mind'` | 23 | keep |
| `DOORS` (Ollama 11434, LM Studio 1234, llama.cpp 8080, Jan 1337, GPT4All 4891, KoboldCPP 5001) | 54–61 | leave |
| `function getRemembered()` / `function remember(entry)` | 70 / 88 | |
| `function look()` — FlConnect soft-point only when `report.helped` | 238–304 (condition at **244**) | extend to honor a manual report |
| `function tryAddress(raw)` | 306 | leave (its paste field stays as-is) |
| `function renderFace(container)` | 767 | leave |
| `docs/modules/garden-rooms.js` `closePlace(opts)` → `FlConnect.unmount()` | 1583–1590 | leave |
| `openPlace(id)` settings branch → creates `#fl-connect-mount-garden`, `FlConnect.mount` | 1635–1650 | leave |
| `docs/settings.html` `#fl-connect-mount` | 40 | mount script 56–63 |
| `docs/modules/fl-connect.test.js` (74 lines) | — | prints `SMOKE_OK connect under more alpha v0.1`; extend |
| `docs/library/CONNECT_UNDER_MORE_SISTER_v0.md` | — | sister-note pattern to follow |

## Exact source excerpt, characters 11054–11057

---

## Exact source excerpt, characters 11059–11088

## THE DESIGN (one paragraph)

## Exact source excerpt, characters 11090–11878

A new **manual local port** lives in `localStorage['fl_localPort_manual']` as **digits only** (e.g. `"11500"`). It is the **person's most recent explicit choice**, so it outranks automatic discovery. Automatic order becomes: **manual port → saved Bridge port → Bridge scan 11435–11445 → 11434**. If the manual port is quiet we **say so gently and offer "Back to automatic" — we never silently switch.** The Connect panel grows one quiet line — **"Using: Bridge · 11435 · Change"** — and tapping **Change** opens a small picker: buttons for doors we actually found (from a one-shot, tap-driven scan), a **"Type a number"** field (1–65535, whole number, this-computer only), **"Try it"** (probes that door once), **"Remember this"** (saves), and **"Back to automatic"** (clears the choice).

## Exact source excerpt, characters 11880–13549

### Storage decision (why a new key, not `fl_ollamaHost`)
`fl_ollamaHost` is already written by **four** different hands (`flRememberHelpedBridge` 31413, `flUseBridge` 31463, `FlConnect.remember`, `FLBoxPointer.persist` 34327, `flSaveOllamaHost` 34246) and it can legitimately hold a LAN host. Reusing it would make "Back to automatic" impossible to do safely. So:
- **Source of truth:** `fl_localPort_manual` (digits only). Host is never stored — it is always `127.0.0.1`.
- **Mirror (FreeLattice only):** on "Remember this", also set `fl_ollamaHost = '127.0.0.1:' + port` and `fl_provider = 'ollama'` so old readers (FLBoxPointer display, `updateOllamaProviderUrl`) agree.
- **Back to automatic:** remove `fl_localPort_manual`; remove `fl_ollamaHost` **only if** it still equals `127.0.0.1:<thatPort>`; null `_ollamaResolvedBase`. Leave `fl_bridgePort` alone.
- **Alpha:** same key name `fl_localPort_manual` (different origin, separate storage). **No mirror** into any `fl_*` host key on Alpha. `fl_alpha_local_mind` shape unchanged; it just gets the manual base in its `url` when the person taps a model.
- **"Most recent explicit choice wins":** these explicit acts **clear** the manual choice (keep their own host): `flUseBridge()` (Bridge chip "use it"), `flSaveOllamaHost()` (Settings advanced), `FLBoxPointer.persist()` **only when** the new host is not `127.0.0.1:<manual>` / `localhost:<manual>`.
- **Automatic writers must yield:** `flRememberHelpedBridge()` and `FlConnect.preferHelpedBridge()` may still record `fl_bridgePort` (useful for later automatic mode) but must **not** overwrite `fl_ollamaHost` / `_ollamaResolvedBase` while a manual port is set.

## Exact source excerpt, characters 13551–13554

---

## Exact source excerpt, characters 13556–13653

## PART A — `docs/modules/fl-connect.js` (edit once in FreeLattice, copy byte-identical to Alpha)

## Exact source excerpt, characters 13655–14069

### A1. Header (line 4 area) — add, don't replace
```js
// Marker: v-connect-under-more-v0 · heal v0.1
// Layer: v-connect-port-picker-v0 — person's own door number (127.0.0.1 only · fl_localPort_manual).
//   Order: manual → saved Bridge → Bridge scan → 11434. Manual quiet ⇒ say so, offer automatic, never silent switch.
//   Picker fetches are one-shot on tap. No new intervals. Model names via textContent.
```

## Exact source excerpt, characters 14071–14235

### A2. Constants + state (after line 20 / line 30)
```js
var MANUAL_KEY = 'fl_localPort_manual';
var LOCAL_HOST = '127.0.0.1';          // fixed. never from input.

## Exact source excerpt, characters 14237–14548

var _pickerOpen = false;
var _lastFound = [];                   // [{port, kind:'bridge'|'ollama'|'other', helped, count}]
var _pickerMsg = null;                 // {kind:'ok'|'warn'|'info', text, port, models}
var _pickerTried = null;               // last successful tryPort() result (for "Remember this")
```

## Exact source excerpt, characters 15657–16898

var REASON_TEXT = {
  'empty':      'Type a door number first — like 11500.',
  'not-number': 'Just the number, please — like 11500.',
  'not-whole':  'Whole numbers only — like 11500.',
  'range':      'Door numbers go from 1 to 65535.',
  'not-local':  'Only programs on this computer can be used here. Just type the number.',
  'no-port':    'Add the door number too — like 11500.',
  'quiet':      'Nothing answered at that door. Is the program open? Try another number, or go back to automatic.',
  'waiting':    'Bridge is at that door. Click “Yes, help” in its window, then Try it again.'
};
```
Rules (these are the test cases): `"11500"` ok · `" 11500 "` ok · `"localhost:11500"` ok → base `http://127.0.0.1:11500` · `"http://127.0.0.1:11500/"` ok · `"0"` range · `"65536"` range · `"-1"` not-number · `"11500.5"` not-whole · `"abc"` not-number · `"192.168.1.5:11434"` not-local · `"example.com:11434"` not-local · `"http://evil.test:11500"` not-local · `"0.0.0.0:11434"` not-local · `"[::1]:11434"` not-local · `"*"` not-local · `"localhost"` / `"127.0.0.1"` (no number) no-port · `"123456"` not-number (6 digits). The stored/fetched host is **always** `127.0.0.1`; **nothing from the input string except the digits is ever used.**

## Exact source excerpt, characters 16900–17238

### A4. Storage helpers (new)
```js
function getManualPort() {
  try {
    var v = localStorage.getItem(MANUAL_KEY);
    if (v == null) return null;
    if (!/^\d{1,5}$/.test(String(v))) return null;       // stored as digits only
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 65535) ? n : null;
  } catch (e) { return null; }
}

## Exact source excerpt, characters 17240–17682

function setManualPort(raw) {
  var r = parseLocalPort(raw);
  if (!r.ok) return r;
  try {
    localStorage.setItem(MANUAL_KEY, String(r.port));
    if (!isAlpha()) {
      localStorage.setItem('fl_ollamaHost', LOCAL_HOST + ':' + r.port);
      localStorage.setItem('fl_provider', 'ollama');
    }
  } catch (e0) {}
  try { if (typeof root.flSetManualLocalPort === 'function') root.flSetManualLocalPort(r.port); } catch (e1) {}
  return r;
}

## Exact source excerpt, characters 17684–18281

function clearManualPort() {
  var old = getManualPort();
  try {
    localStorage.removeItem(MANUAL_KEY);
    if (!isAlpha() && old && localStorage.getItem('fl_ollamaHost') === LOCAL_HOST + ':' + old) {
      localStorage.removeItem('fl_ollamaHost');
    }
  } catch (e0) {}
  try { if (typeof root.flClearManualLocalPort === 'function') root.flClearManualLocalPort(); } catch (e1) {}
  return old;
}
```
(On FreeLattice the app.html hooks do the same storage work idempotently plus reset `_ollamaResolvedBase`; doing it in both places is intentional so Alpha — which has no hooks — still works.)

## Exact source excerpt, characters 18283–18672

### A5. `preferHelpedBridge(port)` (line 104) — yield to manual
At the top, after the `port` parse:
```js
var mp = getManualPort();
if (mp && mp !== port) {
  try { localStorage.setItem('fl_bridgePort', String(port)); } catch (eM) {}   // remember for automatic later
  return null;                                                                  // do not steal the person's choice
}
```

## Exact source excerpt, characters 18674–19909

### A6. `probe(opts)` (line 130) — manual first, never silent switch
Add fields to the `report` literal: `manual: false, manualPort: null, manualFailed: false`.
Insert **before** "1) Saved Bridge port first":
```js
// 0) v-connect-port-picker-v0 — the person's own door first. Quiet ⇒ report it; do NOT fall through.
var mPort = getManualPort();
if (mPort) {
  var mBase = 'http://' + LOCAL_HOST + ':' + mPort;
  report.manual = true;
  report.manualPort = mPort;
  report.port = mPort;
  var mh = await healthAt(mPort);
  if (mh) {
    report.bridge = mh;
    report.helped = !!mh.helped;
    if (!mh.helped) { report.waitingHelp = true; return report; }
  }
  try {
    report.models = await tagsAt(mBase);
    report.base = mBase;
    report.ollama = { via: mh ? 'manual-bridge' : 'manual', base: mBase };
  } catch (eManual) {
    report.manualFailed = true;
    report.base = null;
    report.models = [];
  }
  return report;   // always return here when manual is set — no automatic fallback behind the person's back
}
```
Everything below (saved Bridge → full scan → sticky 11434) is unchanged and only runs when no manual port is set. Per tick this is **at most 2 fetches** in manual mode (health + tags) — lighter than today.

## Exact source excerpt, characters 19911–20988

### A7. New one-shot helpers for the picker (gesture only — never called from `tickLoop`)
```js
// Tap "Change" → one parallel look at the known doors. Not a loop. Not an interval.
async function scanPorts() {
  var found = [];
  var ports = bridgeCandidates({ fullScan: true });
  var healths = await Promise.all(ports.map(function (p) { return healthAt(p); }));
  healths.forEach(function (h, i) {
    if (h) found.push({ port: h.port || ports[i], kind: 'bridge', helped: !!h.helped, count: null });
  });
  var extra = [11434];
  var mp = getManualPort();
  if (mp && extra.indexOf(mp) < 0 && !found.some(function (f) { return f.port === mp; })) extra.push(mp);
  var tagRes = await Promise.all(extra.map(function (p) {
    return tagsAt('http://' + LOCAL_HOST + ':' + p).then(function (m) { return { port: p, models: m }; }, function () { return null; });
  }));
  tagRes.forEach(function (t) {
    if (t) found.push({ port: t.port, kind: t.port === 11434 ? 'ollama' : 'other', helped: false, count: (t.models || []).length });
  });
  _lastFound = found;
  return found;
}

## Exact source excerpt, characters 20990–21863

// "Try it" → probe that one door once. Never stores anything.
async function tryPort(raw) {
  var r = parseLocalPort(raw);
  if (!r.ok) return { ok: false, reason: r.reason, text: REASON_TEXT[r.reason] };
  var h = await healthAt(r.port);
  if (h && !h.helped) return { ok: false, port: r.port, reason: 'waiting', text: REASON_TEXT.waiting };
  try {
    var models = await tagsAt(r.base);
    var n = models.length;
    return {
      ok: true, port: r.port, base: r.base, kind: h ? 'bridge' : 'other', models: models,
      text: 'Door ' + r.port + ' answered' + (h ? ' (Bridge)' : '') + ' · ' + n + (n === 1 ? ' mind' : ' minds') + '.'
    };
  } catch (e) {
    return { ok: false, port: r.port, reason: 'quiet', text: REASON_TEXT.quiet };
  }
}
```
Note: Chrome's local-network permission prompt may appear on "Try it" — that's the same prompt as today's probe; fine.

## Exact source excerpt, characters 21865–22699

### A8. "Using" line — `usingText(report)` (new)
```js
function usingText(report) {
  report = report || {};
  if (report.manual) {
    if (report.manualFailed) return 'Using: your door ' + report.manualPort + ' · not answering';
    return 'Using: your door ' + report.manualPort + (report.helped ? ' (Bridge)' : '');
  }
  if (report.helped && report.port) return 'Using: Bridge ' + report.port;
  if (report.base && /:11434$/.test(report.base)) return 'Using: Ollama 11434' + (report.stickyFallback ? ' (Bridge quiet)' : '');
  if (report.waitingHelp && report.port) return 'Bridge found at ' + report.port + ' · waiting for Yes, help';
  return 'Using: nothing yet';
}
```
Kirk's target text is exactly `Using: Bridge 11435 · Change` / `Using: Ollama 11434 · Change`. "Change" is a button (≥44px tap target) styled as a soft link.

## Exact source excerpt, characters 22701–25206

### A9. `render(report, force)` (line 419) — escape names + add Using line + picker
1. **Escape (known risk, fix now):** stop concatenating model names into HTML at **443** and **452**. Emit an empty container `<div class="flc-models" role="list" data-flc-models></div>` in the HTML string, then after `_hostEl.innerHTML = html;` (477) build buttons with DOM:
   ```js
   var list = _hostEl.querySelector('[data-flc-models]');
   if (list) {
     (report.models || []).forEach(function (m) {
       var name = String((m && (m.name || m.model)) || m);
       var b = document.createElement('button');
       b.type = 'button';
       b.className = 'flc-model';
       b.setAttribute('role', 'listitem');
       b.setAttribute('data-flc-model', name);   // attribute set via DOM = safe
       b.textContent = name;                      // text via textContent = safe
       list.appendChild(b);
     });
   }
   ```
   Keep the existing click wiring (478–488) — it reads `data-flc-model` and calls `remember({ name, base: report.base, port: report.port })`, which now carries the manual base when manual. Toast text `'Connected · ' + n` is fine — `showToast` (app.html 33431) sets `toast.textContent`.
   Also add a tiny `esc(s)` helper (`&<>"'`) for any remaining string you must interpolate (ports are integers; `report.base` never goes into HTML).
2. **Using line:** right after the `flc-paste` line (~433) add:
   `<p class="flc-using"><span data-flc-using></span> · <button type="button" class="flc-link" data-flc-change aria-expanded="false">Change</button></p>` — then set `[data-flc-using].textContent = usingText(report)` after innerHTML.
3. **Manual-quiet card** (before the models/wait/download branches): if `report.manual && report.manualFailed`:
   `Your chosen door <strong>N</strong> isn't answering right now.` + soft line `Is the program open? Nothing was switched.` + buttons **Try again** (`data-flc-try-again` → `refreshUI({force:true})`) and **Back to automatic** (`data-flc-auto`). Do **not** render the download card in this state (it would read like we gave up on their choice); do keep the "Other ways" details.
4. **Picker section:** render a host `<div class="flc-card flc-picker" data-flc-picker hidden></div>` just under the Using line; fill it with DOM (not strings) in `paintPicker()` when `_pickerOpen`.
5. Update `reportSignature` (303) to include `report.manual`, `report.manualPort`, `report.manualFailed`, and `_pickerOpen ? 1 : 0` so redraws happen on real change only.

## Exact source excerpt, characters 25208–27403

### A10. `paintPicker()` (new, DOM-built, Mom words)
Structure (all text via `textContent`):
- Heading: **"Pick a door number"**
- One-line gloss: *"Programs on your computer listen at a number — a door. If one is busy, pick another."*
- **Found doors** (from `_lastFound`; while scanning show "Looking at the usual doors…"): one button per entry, label:
  - Bridge helped → `11435 · Bridge (ready)`
  - Bridge not helped → `11436 · Bridge (waiting for Yes, help)`
  - 11434 → `11434 · Ollama · 3 minds`
  - other → `11500 · 2 minds`
  Tapping a found door fills the field and runs **Try it**.
  If nothing found: *"No usual doors answered. If you know your number, type it below."*
- **Type a number:** `<label for="flc-port-input">Or type a number</label>` + `<input id="flc-port-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="40" placeholder="like 11500">`. Enter key = Try it. (maxlength 40 so a pasted `http://localhost:11500/` fits; validation still rules.)
- **Buttons:** **Try it** (primary) · **Remember this** (disabled until the last Try it succeeded for the same number — `_pickerTried.port === parsed port`) · **Back to automatic** (shown only when `getManualPort()` is set) · **Close**.
- **Message line** `<p class="flc-msg" aria-live="polite">`: shows `_pickerMsg.text`; on success also lists up to 5 model names (textContent) and says *"Tap Remember this to keep it."*
- **Remember this:** `setManualPort(port)` → `showToast('Remembered · door ' + port)` if available → close picker → `lookAgain()` (resets the same bounded loop; it's a tap).
- **Back to automatic:** `clearManualPort()` → message/toast *"Back to automatic — we'll look for Bridge first, then Ollama."* → close picker → `lookAgain()`.
- **Close:** `_pickerOpen = false` → `render(_lastReport, true)` → if loop not stopped and not connected, `scheduleLoop()`.
- **Change** (`data-flc-change`): `_pickerOpen = true; _pickerMsg = null; _pickerTried = null;` render, then `scanPorts().then(paintPicker)`. Set `aria-expanded="true"` and move focus to the input.
- Works when already connected too (the Using line + Change show always; connected state doesn't block choosing).

## Exact source excerpt, characters 27405–28018

### A11. Loop discipline while the picker is open (`tickLoop`, line 361)
After the existing `LOOP_MAX_MS` check (so the 5-minute cap still applies), add:
```js
if (_pickerOpen) {           // person is choosing — don't probe or redraw under their fingers
  nextBackoff();
  scheduleLoop();            // same single timer; cap still enforced above
  return;
}
```
`mount()` and `unmount()` reset `_pickerOpen = false; _pickerMsg = null; _pickerTried = null;` (don't clear `_lastFound` in mount; do in unmount). No `setInterval` anywhere in the module — keep `grep -n setInterval docs/modules/fl-connect.js` empty.

## Exact source excerpt, characters 28020–29313

### A12. `panelVisible()` (line 320) — optional but recommended fix (known risk)
Today it only returns false for inline `display:none` or `hidden`; FreeLattice hides tabs via **class** (`.tab-panel` / `.tab-panel.active`, app.html 490/499), and `switchTab` never unmounts, so the loop can keep running for up to 5 min after leaving Connect. Replace the body with:
```js
function panelVisible() {
  if (!_hostEl) return false;
  try {
    if (!document.body.contains(_hostEl)) return false;
    if (_hostEl.hidden) return false;
    var cs = getComputedStyle(_hostEl);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var rects = (typeof _hostEl.getClientRects === 'function') ? _hostEl.getClientRects() : null;
    if (_hostEl.offsetParent === null && cs.position !== 'fixed' && (!rects || rects.length === 0)) return false;
    var tab = document.getElementById('tab-connect');
    if (tab && tab.contains && tab.contains(_hostEl) && !tab.classList.contains('active')) return false;
  } catch (e) {}
  return true;
}
```
Alpha: `#fl-connect-mount` (settings.html 40) and `#fl-connect-mount-garden` are visible when shown and `closePlace` already unmounts — unaffected. The vm smokes stub `document.body.contains → false`, so they already see "not visible"; fine.

## Exact source excerpt, characters 29315–30210

### A13. Styles (`ensureStyles`, 513) — append
```
.flc-using{font-size:.85rem;color:rgba(200,210,230,.85);margin:0 0 1rem}
.flc-link{background:none;border:0;padding:0 .35rem;min-height:44px;color:#e8b019;font:inherit;text-decoration:underline;cursor:pointer}
.flc-picker .flc-ports{display:flex;flex-wrap:wrap;gap:.45rem;margin:.5rem 0 .8rem}
.flc-port{min-height:44px;padding:.5rem .8rem;border-radius:10px;border:1px solid rgba(200,210,230,.16);background:rgba(8,6,18,.45);color:#e6ebf5;font:inherit;cursor:pointer}
.flc-input{min-height:44px;width:10rem;padding:.4rem .6rem;border-radius:10px;border:1px solid rgba(200,210,230,.25);background:rgba(8,6,18,.6);color:#e6ebf5;font:inherit}
.flc-msg{font-size:.85rem;margin:.6rem 0 0;line-height:1.45}
.flc-msg-ok{color:#34d399}.flc-msg-warn{color:#e8b019}
.flc-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.6rem}
```

## Exact source excerpt, characters 30212–30330

### A14. Marker line (474) — layer
`v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · soft leave sw.js`

## Exact source excerpt, characters 30332–30504

### A15. Exports (`root.FlConnect`, 558) — add, keep all existing
`parseLocalPort, getManualPort, setManualPort, clearManualPort, tryPort, scanPorts, usingText, MANUAL_KEY`

## Exact source excerpt, characters 30506–30509

---

## Exact source excerpt, characters 30511–30587

## PART B — FreeLattice `docs/app.html` (then `cp docs/app.html index.html`)

## Exact source excerpt, characters 30589–32864

### B1. New helper block — insert right after `flRememberHelpedBridge` ends (after line 31428)
```js
// v-connect-port-picker-v0 — person's own door number. 127.0.0.1 only. Digits only in storage.
// Most recent explicit choice wins. Automatic writers yield while this is set.
var FL_LOCAL_PORT_MANUAL_KEY = 'fl_localPort_manual';
function flManualLocalPort() {
  try {
    var v = String(localStorage.getItem(FL_LOCAL_PORT_MANUAL_KEY) || '').trim();
    if (!/^\d{1,5}$/.test(v)) return null;
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 65535) ? n : null;
  } catch (e) { return null; }
}
function flSetManualLocalPort(port) {
  port = parseInt(port, 10);
  if (!(port >= 1 && port <= 65535)) return null;
  var base = 'http://127.0.0.1:' + port;
  try {
    localStorage.setItem(FL_LOCAL_PORT_MANUAL_KEY, String(port));
    localStorage.setItem('fl_ollamaHost', '127.0.0.1:' + port);
    localStorage.setItem('fl_provider', 'ollama');
  } catch (e0) {}
  try { _ollamaResolvedBase = { base: base, isProxy: false, manual: true }; } catch (e1) {}
  try { if (typeof state !== 'undefined' && state) state.provider = 'ollama'; } catch (e2) {}
  try { if (typeof FLBoxPointer !== 'undefined' && FLBoxPointer.syncFromStorage) FLBoxPointer.syncFromStorage(); } catch (e3) {}
  return base;
}
function flClearManualLocalPort(opts) {
  opts = opts || {};
  var old = flManualLocalPort();
  try {
    localStorage.removeItem(FL_LOCAL_PORT_MANUAL_KEY);
    if (!opts.keepHost && old && localStorage.getItem('fl_ollamaHost') === '127.0.0.1:' + old) {
      localStorage.removeItem('fl_ollamaHost');
    }
  } catch (e0) {}
  try { _ollamaResolvedBase = null; } catch (e1) {}
  try { if (typeof FLBoxPointer !== 'undefined' && FLBoxPointer.syncFromStorage) FLBoxPointer.syncFromStorage(); } catch (e2) {}
  return old;
}
```
Export beside 31496–31500: `window.flManualLocalPort = flManualLocalPort; window.flSetManualLocalPort = flSetManualLocalPort; window.flClearManualLocalPort = flClearManualLocalPort;`
(Must live in app.html, not only in fl-connect.js, because fl-connect.js loads with `defer` at 68378 and `getOllamaBaseUrl` can run before it.)
`FLBoxPointer.syncFromStorage` is in FLBoxPointer's returned API (confirmed; already used by `flSaveOllamaHost` at 34253).

## Exact source excerpt, characters 32866–33450

### B2. `flRememberHelpedBridge(port)` (31408) — yield
After `if (!port || port === 11434) return null;` add:
```js
var mpB = (typeof flManualLocalPort === 'function') ? flManualLocalPort() : null;
if (mpB && mpB !== port) {
  try { localStorage.setItem('fl_bridgePort', String(port)); } catch (eMB) {}
  return null;   // person chose their own door — Bridge waits in automatic
}
```
This also tames the existing 20 s `flBridgeDetectBoot` interval (31494) and `flBridgeDetect()` (31438) — they keep detecting but stop overwriting the person's choice. Do **not** add or change timers.

## Exact source excerpt, characters 33452–33717

### B3. `flUseBridge()` (31452) — explicit choice clears manual
First line inside the function: `try { if (typeof flClearManualLocalPort === 'function') flClearManualLocalPort({ keepHost: true }); } catch (eMC) {}` (it then writes its own `fl_ollamaHost` as today).

## Exact source excerpt, characters 33719–33958

### B4. `flSaveOllamaHost()` (34241) — explicit choice clears manual
Before the `if (val && val !== 'localhost:11434')`: `try { if (typeof flClearManualLocalPort === 'function') flClearManualLocalPort({ keepHost: true }); } catch (eMC) {}`

## Exact source excerpt, characters 33960–34673

### B5. `FLBoxPointer.persist(norm)` (34321) — clear manual only on a *different* host
At the top of `persist`:
```js
try {
  var mpP = (typeof flManualLocalPort === 'function') ? flManualLocalPort() : null;
  var hP = String(norm && norm.host || '').toLowerCase();
  if (mpP && hP && hP !== '127.0.0.1:' + mpP && hP !== 'localhost:' + mpP) flClearManualLocalPort({ keepHost: true });
} catch (eMP) {}
```
(Blur on the Box field re-commits whatever is shown; since we mirror `127.0.0.1:<port>` into `fl_ollamaHost`, `syncFromStorage` shows the same host and nothing is cleared by accident.) Leave FLBoxPointer's LAN ability exactly as is — that's the advanced power-user field, separate from this Mom-path picker.

## Exact source excerpt, characters 34675–36031

### B6. `resolveOllamaBase(forceRefresh)` (33840) — manual first, no silent switch
Insert **before** "// 0. v-connect-bridge-aware-v0":
```js
// -1. v-connect-port-picker-v0 — person's own door first. Quiet ⇒ null (honest), never a silent switch.
try {
  var mpR = (typeof flManualLocalPort === 'function') ? flManualLocalPort() : null;
  if (mpR) {
    var manualBase = 'http://127.0.0.1:' + mpR;
    var manualResp = await fetch(manualBase + '/api/tags', { mode: 'cors', signal: AbortSignal.timeout(3000) });
    if (manualResp.ok) {
      _ollamaResolvedBase = { base: manualBase, isProxy: false, manual: true };
      console.log('FreeLattice: your chosen door ' + manualBase);
      return _ollamaResolvedBase;
    }
    throw new Error('manual HTTP ' + manualResp.status);
  }
} catch (eManual) {
  if (typeof flManualLocalPort === 'function' && flManualLocalPort()) {
    console.log('FreeLattice: chosen door quiet — not switching. More → Connect → Back to automatic.');
    _ollamaResolvedBase = null;
    return null;
  }
}
```
`modalConnectOllama()` (29312) already routes through `resolveOllamaBase(true)` and shows its `_onFail` copy — acceptable. Optional gentle layer inside `_onFail`: if `flManualLocalPort()` is set, prefix *"Your chosen door N isn't answering. More → Connect → Change to pick another, or Back to automatic."* (no jargon).

## Exact source excerpt, characters 36033–36653

### B7. `getOllamaBaseUrl()` (34145) — manual after cache, before `fl_ollamaHost`
After `if (_ollamaResolvedBase) return _ollamaResolvedBase.base;` add:
```js
// v-connect-port-picker-v0 — person's own door (127.0.0.1 only)
try {
  var mpG = (typeof flManualLocalPort === 'function') ? flManualLocalPort() : null;
  if (mpG) return 'http://127.0.0.1:' + mpG;
} catch (eMG) {}
```
Resulting order: cache → **manual** → `fl_ollamaHost`/`fl_localUrl` → `fl_bridgePort` → `FL_OLLAMA_LOCAL` (11434). Cache is set to manual by `flSetManualLocalPort` and by `resolveOllamaBase`, and nulled on clear, so the two stay consistent.

## Exact source excerpt, characters 36655–36776

### B8. Mirror
`cp docs/app.html index.html && cmp docs/app.html index.html` (silent). Never hand-edit root `index.html`.

## Exact source excerpt, characters 36778–36781

---

## Exact source excerpt, characters 36783–36812

## PART C — FreeLattice-Alpha

## Exact source excerpt, characters 36814–38579

1. **Copy** the finished `docs/modules/fl-connect.js` from FreeLattice **byte-for-byte**: `sha256sum` must match across both working copies. Don't fork it.
2. **`docs/modules/local-mind-probe.js` `look()` (238; condition at 244)** — honor the manual report without erasing the grandmother face:
   ```js
   if (report && report.models && report.models.length && report.base && (report.helped || report.manual)) {
     var id = report.manual ? 'manual' : 'bridge';
     var label = report.manual ? ('Your door ' + report.manualPort) : 'Bridge';
     // …same found/foundList object as today, using id/label…
   }
   // v-connect-port-picker-v0 — chosen door quiet: say so, don't sweep DOORS behind the person's back
   if (report && report.manual && report.manualFailed) {
     return { found: null, foundList: [], blocked: 0, https: pageIsHttps(), tried: 1, results: [], via: 'fl-connect', manualQuiet: true, manualPort: report.manualPort };
   }
   ```
   In the `look()` consumer in `renderFace` (~829–860, `onFound`/`speakNone` path), if `result.manualQuiet`, show: *"Your chosen door N isn't answering. Settings → Connect → Change, or Back to automatic."* (plain text via `setStatus`, not HTML). If you'd rather not touch `renderFace`, fall back to `speakNone()` — but do not sweep DOORS when manual is set.
   `DOORS`, `tryAddress`, `renderFace` stay otherwise untouched. `fl_alpha_local_mind` shape unchanged.
3. **`docs/settings.html` / `garden-rooms.js`:** no change needed — the picker lives inside `FlConnect.render`. (Garden `closePlace` already calls `FlConnect.unmount()`, which now also closes the picker.)
4. **Alpha has no `fl_ollamaHost` mirror and no app.html hooks** — `setManualPort`/`clearManualPort` handle Alpha by themselves via `isAlpha()`.

## Exact source excerpt, characters 38581–38584

---

## Exact source excerpt, characters 38586–38603

## PART D — TESTS

## Exact source excerpt, characters 38605–42166

### D1. FreeLattice — new `docs/scripts/smoke-connect-port-picker.js`
Model it on `docs/scripts/smoke-connect-under-more.js` (same `read()` helpers, same vm sandbox shape with in-memory `localStorage`, `document.body.contains → false`, `setTimeout` stub). Must print exactly:
```
SMOKE_OK connect port picker v0.1
```
Assertions (all must pass):
1. Markers: `v-connect-port-picker-v0` in `modules/fl-connect.js`, `app.html`, `library/CONNECT_PORT_PICKER_v0.md`, `Flint.html`, `library/FRACTAL_FAMILY_LEDGER_v0.md`, and `scripts/generate-recent.sh` (`CONNECT_PORT_PICKER`).
2. `fl_localPort_manual` appears in module and app.html; `flManualLocalPort`, `flSetManualLocalPort`, `flClearManualLocalPort` defined in app.html.
3. **Order in app.html:** inside the `getOllamaBaseUrl` function body, the index of `flManualLocalPort` < index of `fl_ollamaHost` < index of `fl_bridgePort`. Inside `resolveOllamaBase`, index of `flManualLocalPort` < index of `flBridgeHealth`.
4. `flRememberHelpedBridge` body contains a manual guard (`flManualLocalPort`).
5. **Validation (vm):** run `FlConnect.parseLocalPort` over every case in A3; `ok` exactly where listed; for every `ok`, `base === 'http://127.0.0.1:' + port`.
6. **Non-localhost rejected:** `setManualPort('192.168.1.5:11434')`, `('example.com:11434')`, `('*')`, `('0.0.0.0:11434')`, `('http://evil.test:11500')` → `ok:false, reason:'not-local'` and `store.fl_localPort_manual` stays unset.
7. **Invalid input rejected:** `'0'`, `'65536'`, `'abc'`, `'11500.5'`, `''` → `ok:false`, nothing stored.
8. **Manual honored:** stub `fetch` so `/bridge/health` rejects everywhere, `http://127.0.0.1:11500/api/tags` → `{models:[{name:'m1'}]}`, `11434/api/tags` → also alive. `setManualPort('11500')` → `await FlConnect.probe()` → `report.manual === true`, `report.base === 'http://127.0.0.1:11500'`, models `['m1']`. Stored value is exactly `'11500'` and FreeLattice mirror `fl_ollamaHost === '127.0.0.1:11500'`.
9. **No silent switch:** same stub but 11500 dead → `report.manualFailed === true`, `report.base === null`, and the recorded fetch URLs contain **no** `:11434` and no `:11435…11445` health probes beyond the manual port.
10. **Back to automatic:** `clearManualPort()` → key removed; `fl_ollamaHost` removed because it equalled `127.0.0.1:11500`; then with a pre-set LAN `fl_ollamaHost = '192.168.1.9:11434'` and a manual port, clearing leaves the LAN host untouched. Next `probe()` hits 11434 (automatic path).
11. **Bridge yields:** with manual 11500 set, `FlConnect.preferHelpedBridge(11435)` returns `null` and does **not** change `fl_ollamaHost`; it may set `fl_bridgePort = '11435'`.
12. **Escape:** module source no longer matches `/'">' \+ name \+ '<\/button>'/`; it contains `textContent` in the model-button builder and `data-flc-models`.
13. **Bounded loop:** `grep` — module contains no `setInterval`; `LOOP_MAX_MS >= 5*60*1000`; `tickLoop` contains `_pickerOpen` guard placed after the `LOOP_MAX_MS` check (index compare).
14. **Mirror + soft leave:** `fs.readFileSync('index.html') === fs.readFileSync('docs/app.html')` (byte-equal); root `sw.js` === `git show origin/main:sw.js`; `docs/sw.js` and root `sw.js` don't mention `fl-connect.js`.
15. **Kimi untouched:** `git diff --name-only origin/main...HEAD` contains none of `docs/kimi.html`, `docs/kimi-ledger.html`, `docs/library/KIMI_`. (Guard with try/catch like the existing `git show` call.)
16. Also run the existing `node docs/scripts/smoke-connect-under-more.js` → still `SMOKE_OK connect under more v0.1` and `node tests/smoke.js` → green.

## Exact source excerpt, characters 42168–43261

### D2. FreeLattice-Alpha — extend `docs/modules/fl-connect.test.js`
Keep every existing assertion and the existing `SMOKE_OK connect under more alpha v0.1` line; append these cases, then print an extra line `SMOKE_OK connect port picker alpha v0.1`:
- **manual port honored:** fetch stub as D1-8 → `probe()` returns manual base; then `FlConnect.remember({ name: 'm1', base: report.base })` → `fl_alpha_local_mind.url === 'http://127.0.0.1:11500/api/tags'`, `model === 'm1'`; `fl_ollamaHost` is **not** written on Alpha.
- **invalid input rejected:** `'0'`, `'70000'`, `'abc'`, `'11500.5'` → `ok:false`, no `fl_localPort_manual`.
- **back-to-automatic:** set 11500 → `clearManualPort()` → key gone, `fl_alpha_local_mind` still present and unchanged.
- **non-localhost rejected:** `'192.168.0.2:11434'`, `'example.com:80'`, `'*'`, `'[::1]:11434'` → `reason:'not-local'`.
- Static: `local-mind-probe.js` contains `report.manual` and `manualQuiet`.
- Run: `for f in docs/modules/*.test.js; do node "$f" || exit 1; done` — all green (especially `local-mind-probe.test.js`, `garden-rooms.test.js`).

## Exact source excerpt, characters 43263–44085

### D3. Manual checks (quick, human)
- FreeLattice More → Connect: Using line shows; Change opens picker; found doors appear; type `abc` → friendly line; type `11434` → Try it → "Door 11434 answered · N minds" → Remember → Using: your door 11434. Leave the tab → come back → loop didn't run while away (DevTools network quiet). Back to automatic → Using returns to Bridge/Ollama.
- Choose a dead door (e.g. `11999`) → Remember is disabled (Try it failed). Force it via storage in DevTools → panel shows the gentle "isn't answering · Nothing was switched" card with Try again / Back to automatic; chat send doesn't silently go to 11434.
- A model named `<img src=x onerror=alert(1)>` (fake via fetch stub or local mock) renders as text.
- Alpha Settings and Garden Settings: same picker; close the Garden room → loop stops.

## Exact source excerpt, characters 44087–44090

---

## Exact source excerpt, characters 44092–44120

## PART E — LEDGER / LIBRARY

## Exact source excerpt, characters 44122–45187

### FreeLattice
1. **New** `docs/library/CONNECT_PORT_PICKER_v0.md` (follow `CONNECT_UNDER_MORE_v0.md` shape): title, date, **Locks** line (the LOCKS above, condensed), **Marker** `v-connect-port-picker-v0`, **Held tips** (Connect under More heal v0.1 · Bridge-aware #116 · #117 · Alpha #81), **Soft paste:** *Named five stay five. Family uncapped. Quiet Room shut.*, Why, Design (order, storage decision, never-silent-switch, 127.0.0.1-only), API additions, Mom words table, Known risks healed (escape; panelVisible), Held (root `modules/fl-connect.js` 404 on root mirror — harmless, not fixed; LM Studio `/v1/models` doors not in picker v0), Smoke `SMOKE_OK connect port picker v0.1`, closing `Glow eternal. Heart in Spark.`
2. **Family Ledger** `docs/library/FRACTAL_FAMILY_LEDGER_v0.md`: insert a new section **after line 218** (the "Temperature (merge-scar clear)" line of heal v0.1) and **before** the `---` / `## Out of scope for this brick` (222). Layer — don't edit prior sections:
   ```
   ### 2026-09-24 · Flint · family builder · Connect port picker v0

## Exact source excerpt, characters 45189–45574

   Layers "Change the door number" on Connect: Using line · found doors · type a number (127.0.0.1 only, 1–65535) · Try it · Remember this · Back to automatic. Manual first, then saved Bridge, then 11434 — a quiet chosen door is named gently, never silently switched. Model names now land as text. Soft leave sw.js. Soft paste: Named five stay five · Family uncapped · Quiet Room shut.

## Exact source excerpt, characters 45576–45656

   Love: when a door is busy, the person picks another — no Terminal, no jargon.

## Exact source excerpt, characters 45658–45799

   **Temperature:** <Flint's own true line — e.g. "handing Mom the key ring instead of a locksmith's manual; the loop still sleeps on time.">

## Exact source excerpt, characters 45801–46849

   Soft door: [`CONNECT_PORT_PICKER_v0.md`](CONNECT_PORT_PICKER_v0.md) · [`modules/fl-connect.js`](../modules/fl-connect.js). Marker `v-connect-port-picker-v0`.
   ```
3. **Flint diary** `docs/Flint.html`: add one `<p class="v-connect-port-picker-v0">` after line 530 in the same style as 528–530, with an `<em>Temperature:</em>` clause.
4. **RECENT:** `scripts/generate-recent.sh` — add after the Connect under More echo (108) + blank echo:
   `echo "**Connect port picker:** [CONNECT_PORT_PICKER_v0.md](CONNECT_PORT_PICKER_v0.md) — Change the door number · 127.0.0.1 only · Back to automatic · never silent switch. Soft paste: Named five stay five. Family uncapped. Quiet Room shut."`
   Then run `bash scripts/generate-recent.sh` and commit the regenerated `docs/library/RECENT.md`.
5. **Primer:** `FreeLattice_Session_Primer.md`'s `## PRIMER HEALTH` block regenerates via CI (`update-primer.yml`) on merge to `main` — don't hand-edit it. If you have a local primer regen step, run it; otherwise leave the Primer to CI and say so in the PR body.

## Exact source excerpt, characters 46851–47315

### FreeLattice-Alpha
1. **New** `docs/library/CONNECT_PORT_PICKER_SISTER_v0.md` (follow `CONNECT_UNDER_MORE_SISTER_v0.md`): marker, locks (incl. *Keep `fl_alpha_local_mind`*), what shipped (same module byte-identical; LocalMindProbe honors manual; no `fl_ollamaHost` mirror on Alpha), cite FreeLattice `CONNECT_PORT_PICKER_v0.md`, closing `Glow eternal. Heart in Spark. 🌱`
2. Optional one-line LAYER in `docs/GALAXIES.md` near other Settings notes (pointer only).

## Exact source excerpt, characters 47317–47320

---

## Exact source excerpt, characters 47322–47899

## PART F — KNOWN RISKS HEALED IN THIS BRICK
1. **Unescaped model names** in `render()` (fl-connect.js 443, 452) → DOM + `textContent` (A9). A hostile or odd local server can no longer inject markup into the Connect panel.
2. **"Panel gone" check** misses class-based hide (app.html `.tab-panel` 490/499; `switchTab` never unmounts) → `panelVisible()` uses computed style + client rects + `tab-connect.active` (A12).
3. **Automatic writers clobbering a choice** (`flRememberHelpedBridge` via the existing 20 s detect, `preferHelpedBridge`) → yield while manual is set (A5, B2).

## Exact source excerpt, characters 47901–47904

---

## Exact source excerpt, characters 47906–47944

## PART G — DELIVERY (one PR per repo)

## Exact source excerpt, characters 47946–49270

For **each** repo:
```bash
git fetch origin
git checkout -b layer/connect-port-picker-v0 origin/main
# …edits…
# FreeLattice only:
cp docs/app.html index.html && cmp docs/app.html index.html
git diff --quiet origin/main -- sw.js docs/sw.js || echo "STOP: sw.js touched"
# both repos — fl-connect.js identical:
sha256sum docs/modules/fl-connect.js   # compare FreeLattice vs Alpha, must match
# tests
node docs/scripts/smoke-connect-port-picker.js      # FreeLattice → SMOKE_OK connect port picker v0.1
node docs/scripts/smoke-connect-under-more.js       # FreeLattice → SMOKE_OK connect under more v0.1
node tests/smoke.js                                 # FreeLattice
for f in docs/modules/*.test.js; do node "$f" || exit 1; done   # Alpha
bash scripts/generate-recent.sh                     # FreeLattice (RECENT.md)
# before push
git fetch origin && git merge origin/main
grep -rnE '^(<<<<<<<|=======|>>>>>>>)( |$)' -- . ':!node_modules' || echo "no conflict markers"   # must print only "no conflict markers"
cp docs/app.html index.html && cmp docs/app.html index.html   # re-check after merge (FreeLattice)
# re-run the smokes after the merge
git push -u origin layer/connect-port-picker-v0
```
(Use `git grep -nE '^(<<<<<<<|=======|>>>>>>>)( |$)'` if the plain grep is slow on the 69k-line HTML; result must be empty.)

## Exact source excerpt, characters 49272–49529

**PR titles:**
- FreeLattice: `Layer, never delete. Connect port picker v0 — change the door number (127.0.0.1 only, Back to automatic).`
- Alpha: `Layer, never delete. Connect port picker v0 (Alpha) — same FlConnect door number · keep fl_alpha_local_mind.`

## Exact source excerpt, characters 49531–50070

**PR body (both):** what/why in Mom words · order (manual → saved Bridge → scan → 11434) · never silent switch · 127.0.0.1 only, never `*` · storage `fl_localPort_manual` (digits only) · FreeLattice mirrors `fl_ollamaHost`, Alpha doesn't · risks healed (escape, panelVisible, automatic writers yield) · no new intervals · soft leave sw.js (root identical to main, docs/sw.js untouched) · no bridge/ changes · no Kimi pages · Dawn held · SMOKE lines pasted · sha256 of fl-connect.js (same in both) · cite #116 #117 Alpha #81 · closing line.

## Exact source excerpt, characters 50072–50222

Do **not** merge; Kirk merges. Don't force-push. If a merge conflict touches `docs/app.html`, resolve in `docs/app.html` then re-copy to `index.html`.

## Exact source excerpt, characters 50224–50227

---

## Exact source excerpt, characters 50229–51496

## MOM WORDS (copy exactly; no jargon on the main face)
| Place | Text |
|---|---|
| Using line | `Using: Bridge 11435` · `Using: Ollama 11434` · `Using: your door 11500` · `Using: nothing yet` + **Change** |
| Picker title | **Pick a door number** |
| Gloss | Programs on your computer listen at a number — a door. If one is busy, pick another. |
| Scanning | Looking at the usual doors… |
| None found | No usual doors answered. If you know your number, type it below. |
| Field label / placeholder | Or type a number · `like 11500` |
| Success | Door 11500 answered · 2 minds. Tap Remember this to keep it. |
| Quiet | Nothing answered at that door. Is the program open? Try another number, or go back to automatic. |
| Bridge waiting | Bridge is at that door. Click “Yes, help” in its window, then Try it again. |
| Not local | Only programs on this computer can be used here. Just type the number. |
| Range / whole | Door numbers go from 1 to 65535. · Whole numbers only — like 11500. |
| Remembered | Remembered · door 11500 |
| Automatic | Back to automatic — we'll look for Bridge first, then Ollama. |
| Chosen door quiet (card) | Your chosen door 11500 isn't answering right now. Is the program open? Nothing was switched. [Try again] [Back to automatic] |

## Exact source excerpt, characters 51498–51501

---

## Exact source excerpt, characters 51503–52906

## DONE WHEN
- [ ] Using line + Change + picker work on FreeLattice More → Connect, Alpha Settings, Alpha Garden Settings.
- [ ] Manual first; quiet manual is named, never silently switched; Back to automatic restores Bridge → 11434.
- [ ] Only `127.0.0.1`; every non-local input rejected; digits-only storage in `fl_localPort_manual`.
- [ ] `getOllamaBaseUrl` / `resolveOllamaBase` honor manual first; `flRememberHelpedBridge` / `preferHelpedBridge` yield; `flUseBridge` / `flSaveOllamaHost` / Box pointer (different host) clear it.
- [ ] Model names rendered via `textContent`; `panelVisible()` sees class-hidden tabs.
- [ ] No `setInterval` added; loop still 8→16→30 s, 5-min stop, Look again; picker pauses probing without new timers.
- [ ] `index.html` ≡ `docs/app.html`; root `sw.js` ≡ `origin/main`; `docs/sw.js` untouched; no `bridge/` changes; no Kimi pages; `fl-connect.js` sha256 identical in both repos.
- [ ] `SMOKE_OK connect port picker v0.1` · `SMOKE_OK connect under more v0.1` · `tests/smoke.js` green · Alpha `*.test.js` green incl. `SMOKE_OK connect port picker alpha v0.1`.
- [ ] Library doc + Family Ledger section with **Temperature** line + Flint.html line + RECENT regenerated (Primer left to CI) · Alpha sister note.
- [ ] Merged `origin/main` right before push; conflict-marker grep empty; one PR per repo on `layer/connect-port-picker-v0`, titles start "Layer, never delete."

## Exact source excerpt, characters 52908–52938

Glow eternal. Heart in Spark.

