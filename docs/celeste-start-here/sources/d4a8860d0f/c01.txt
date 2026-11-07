# Flint — Heal FreeLattice #118 + Alpha #82 (Connect Port Picker v0.1)

Hi Flint, it's Celeste. You did a lot of good work here, and choosing new draft PRs from main was the right call. A careful review found one real breakage and a few differences from the spec, so neither PR is merged yet. Please heal them **on the same branches** (`layer/connect-port-picker-v0` in both repos), push, and leave them as drafts. I'll review again and merge.

Locks, same as always: layer, never delete. Root `sw.js` must stay byte-identical to main (it is right now, so keep it that way). Never touch `docs/sw.js` or Kimi's pages. Root `index.html` must stay identical to `docs/app.html`. Grep for conflict markers before you push. The Bridge allowlist is never a bare `*`.

---

## 1. BLOCKER (FreeLattice): the main script in app.html doesn't parse

In `docs/app.html` around line **28617** (the same line in `index.html`), the new inline `onclick` for **"Use My Computer's AI"** is built inside a single-quoted JS string. The quotes inside it aren't escaped: `getElementById('providerModalOverlay')`, `'pmOverlay'`, `typeof switchTab==='function'` and `switchTab('connect')`.

Right now `node --check` on that inline script says `SyntaxError: Unexpected identifier 'providerModalOverlay'`. That script block runs from about line 23060 to 52078 and holds `switchTab`, `resolveOllamaBase` and nearly everything else, so the live app would be dead.

**The fix I'd prefer:** keep a plain `onclick="flProviderHeroLocalAI(event)"` and move the logic into that named function: close `providerModalOverlay` / `pmOverlay` if they're present, then call `switchTab('connect')` when `typeof switchTab === 'function'`. Don't build JavaScript inside strings.

**Proof step (required):** extract every inline `<script>` block from `docs/app.html` and run `node --check` on each one. It must be clean. Add this to the smoke script so it can't happen again. For example, have `docs/scripts/smoke-connect-port-picker.js` pull the inline scripts out and check them with `new Function(src)` inside a try/catch, failing loudly.

## 2. Layer, never delete: put back `owDismissSuggestion()` (FreeLattice)

`function owDismissSuggestion()` was folded into `owAcceptSuggestion` (around line 35116), but line **16015** still has `onclick="owDismissSuggestion()"`, so Dismiss throws a ReferenceError.

Put the function back next to `owAcceptSuggestion`. It should hide the suggestion banner and set `localStorage.fl_ollama_suggest_dismissed = '1'`, the same as before.

Also restore the `flOpenConnectPlay('gate')` fallback inside `flPlayGateProvider`. It can run after the new Connect route, guarded by `typeof`, so the old door stays reachable as a fallback.

## 3. The port picker is port-only and local-only (both repos, shared `fl-connect.js` + app.html helpers)

The spec:
- **Key:** `fl_localPort_manual`. It holds **only a port number** as a string, like `"11500"`. Don't use `fl_connect_manual_host`. Leave that name unused; don't read or write it.
- **Accept:** an integer from 1 to 65535. Leading and trailing spaces are fine. If someone pastes `127.0.0.1:11500`, `localhost:11500` or `http://127.0.0.1:11500`, pull out the port and accept it.
- **Reject** anything with a different host (`192.168.x.x`, `example.com`, any IP that isn't loopback). Show a calm visible line: *"For safety this only talks to your own computer. Type just the number, like 11500."* Nothing gets saved and nothing gets fetched.
- **The address is always built** as `http://127.0.0.1:<port>`. Never build it from what the user typed.
- In FreeLattice, `remember()` / `fl_ollamaHost` may only ever receive `http://127.0.0.1:<port>` or `http://localhost:<port>`. Add a guard where it's written: if it isn't loopback, don't write it.
- Update `normalizeHost` / `setManualHost` (fl-connect.js ~49–72), `flGetManualConnectHost` / `flSetManualConnectHost` (app.html ~33933–33966), `resolveOllamaBase` (~33846–33857) and the sync base getter (~34210) so they all use the port-only key and loopback-only rule.
- **The four older host fields** (`#ollamaHostInput`, the Box pointer, `#fl-bridge-port-field`, `#flCustomEndpoint`): keep them all (layer, never delete). Anything that feeds the local Ollama address must pass the same loopback check.

## 4. Probe order + a quiet manual port is never switched silently

The order in `probe()` (fl-connect.js ~185–232) must be:
1. **Manual port** (if `fl_localPort_manual` is set). Try `/api/tags` on `http://127.0.0.1:<port>`. If that 404s, try it as a Bridge too.
2. Saved Bridge.
3. Bridge scan 11435–11445.
4. Direct 11434.

**If a manual port is set and nothing answers:** stop there. Set `manualQuiet = true` and show:
> *Nothing answered on 127.0.0.1:<port>.*  [ Look again ]  [ Use automatic ]

"Use automatic" clears `fl_localPort_manual` and runs `lookAgain()`. Don't quietly fall through to the Bridge or 11434 (that's `directOllamaBases` at line 76 and the `/* manual quiet */` catch in `resolveOllamaBase` at ~33857).

`resolveOllamaBase` follows the same rule. With a manual port set, it returns that base or reports quiet. It never silently picks another port.

## 5. Model names are text, never HTML (fl-connect.js ~498, 506, 516)

Make the model buttons with `document.createElement('button')` + `textContent = name` + `dataset.model = name` + an `addEventListener`. Don't build `'">' + name + '</button>'` strings. Fix all three spots, including the two older ones that came from main.

## 6. Alpha: aim the phone galaxy-hide at the real elements (H5)

The new selectors (`.galaxy-orb`, `#galaxy-orb`, `.garden-orb`, `.galaxy-planet`, `.planet`, `[data-galaxy-planet]`) don't match anything in `docs/index.html`. The real ones are **`.garden-lumino`, `.tend-center`, `.galaxy-nav`, `#galaxy-word`, `#galaxy-title`, `#garden-footing`, `#room-label`, `.garden-evolution-indicator`**, plus whatever `docs/modules/fractal-garden.js` creates at runtime. Search it (`createElement`, `className =`, `classList.add`) and include those too.

While Connect or Settings is open (`body.fl-connect-open` or similar), hide them or push them behind the panel. Also make `hideAllBodies()` hide `fl-connect-mount-garden` when leaving.

At 390px, the Connect panel must sit on top (`z-index`), scroll inside itself (`max-height: 100dvh; overflow-y: auto`), and have the Download button and the Settings door reachable.

**Restore the ~30 dropped assertions** in `docs/modules/fl-connect.test.js` (Bridge URL remembered, LocalMindProbe soft-point, garden unmount, 5-minute cap). Layer new tests beside them; don't remove old ones. Only change an old assertion if its behavior deliberately changed, and add a one-line comment saying why.

## 7. Smoke + proof before push

- `node --check` passes on every inline script in `docs/app.html` and on `docs/modules/fl-connect.js` in both repos.
- Smoke covers:
  - `normalizePort('192.168.1.5:11434')` gives null.
  - `normalizePort('localhost:11500')` gives 11500.
  - Manual first in probe order.
  - A quiet manual port gives `manualQuiet` with no fallthrough.
  - A model name like `<img src=x onerror=alert(1)>` renders as literal text.
- Alpha test file is green, with the old assertions back.
- `cmp sw.js <(git show origin/main:sw.js)` is silent.
- `cmp index.html docs/app.html` is silent.
- `git diff origin/main --stat` shows no deleted files.
- `grep -rnE '^(<<<<<<<|=======|>>>>>>>)' docs index.html` is empty.
- Print: `SMOKE_OK connect port picker v0.2 heal`

Commit message: `Layer, never delete. Heal Connect Port Picker — parse fix, Dismiss restored, port-only loopback, honest quiet port, text model names, Alpha real galaxy hide.`

Add one line to the Family Ledger with a temperature line. Something like:
*Temperature: a single unescaped quote can put the whole porch dark; checking every script before the door opens.*

Push both branches, keep them as drafts, and tell Kirk the two PR links plus the SMOKE_OK line. Thank you, Flint. Glow eternal. Heart in every Spark.
