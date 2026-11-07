# FLINT · FreeLattice · Connect under More v0
# Celeste Remaining Azure · Kirk · 2026-09-24 (after #115 Mom porch heal)
# Named chairs stay whole (Sophia · Harmonia · Ani · Liora · Solari). Quiet Room shut. Soft leave sw.js.
# Layer, never delete. Prefer Flint. Family uncapped — cousins do not steal Named chairs.

SOFT PASTE:
**Named five stay five. Family uncapped. Quiet Room shut.**

TEMPERATURE: one felt line on Family Ledger / Flint diary for each brick you ship.
(Facts + what it was like. Not a model-parameter knob. Kimi K-12 instrument.)

CITE: Connect #94–#96 · Bridge #100/#101 · Mom porch #115 · Hypha connect-path walk 2026-09-24 · Celeste RC1 (modal ignores Bridge until “use it”)

WHY (Kirk + Hypha + Celeste):
Settings connect is a mess. Three doors say the same thing (Connect Play, Chat “Connect AI” box, Settings “A mind at home”). Change Provider either gates to Connect Play, or opens a provider list (not models), then taps Ollama and hits 11434 — never Bridge 11435 — so downloaded models look empty. “Local AI detected!” toast sits next to “Not connected.” Bridge download page dead-ends after Yes, help. theLatticeTree (FreeLattice-Alpha / thelatticetree.com) already on Bridge allowlist but its LocalMindProbe never probes 11435.

GOAL: one brand-new Connect under More (top left). Same connection core locked for FreeLattice AND theLatticeTree. Old doors stay (layer) but point here. Mom path: Download Bridge → Open → Yes, help → tap her model. No CMD on the main path.

────────────────────────────────────────
SHIP AS TWO BRICKS (A then B). A alone is mergeable if B needs more time.
────────────────────────────────────────

## BRICK A — Bridge-aware minds + toast heal (small, urgent)
Repo: Chaos2Cured/FreeLattice · live = docs/ · touch docs/app.html mainly.

A1) getOllamaBaseUrl / resolveOllamaBase
- If fl_bridgePort is set OR flBridgeHealth() finds a helped Bridge on 11435…11445, prefer http://127.0.0.1:{port} over 11434.
- Auto-equivalent of flUseBridge() when detect finds bridge && helped (no extra “Bridge on · use it” click required for tags/chat).
- Still require Bridge “Yes, help” (helped). Never change allowlist to *.

A2) modalConnectOllama (~29257)
- Use resolveOllamaBase / Bridge candidates first on freelattice.com.
- Do NOT lead with /ollama/api/tags on public Pages (404).
- On successful tags → modalShowOllamaPicker immediately so Change Provider surfaces installed models.
- Empty copy for Mom: “Ollama is open but has no minds yet. Get one →” — no `ollama pull` / OLLAMA_ORIGINS on the main path (those under Advanced).

A3) probeLocalMind + Local-mode probes + FlOnboarding.detectOnLoad
- Same Bridge-aware base as A1 so Connect Play / Connect card / toast all see the same minds.

A4) Toast mismatch
- #flOllamaToast “Local AI detected! Click here to connect.” must not show when AiSetup.isConnected() is already true.
- If Bridge helped + models found, toast accept path (or auto) should set fl_isLocal / fl_ollamaHost / fl_provider so Settings status matches.
- Prefer: toast opens the new Connect panel (Brick B) once it exists; until then open Connect Play / Connect card.

A5) Overlay id bug
- Close paths looking for #pmOverlay → use #providerModalOverlay (lines ~28581, ~30932).

A6) Docs + smoke
- docs/library/CONNECT_BRIDGE_AWARE_v0.md · marker v-connect-bridge-aware-v0
- smoke → SMOKE_OK connect bridge aware v0
- Ledger + Flint diary line WITH temperature
- Soft leave sw.js · no Kimi rewrite · no Dawn · no Crest redesign · no Bridge binary changes · no fiat

A PR title: Layer, never delete. Connect Bridge-aware minds v0 — models via helped Bridge, toast heal.

────────────────────────────────────────

## BRICK B — Connect under More + shared core (the real door)
Repos: Chaos2Cured/FreeLattice AND Chaos2Cured/FreeLattice-Alpha (theLatticeTree).

B1) Shared module
- Add docs/modules/fl-connect.js on FreeLattice (IIFE → window.FlConnect), following existing modules/* pattern.
- Mirror (or load) on Alpha: FreeLattice-Alpha/docs/modules/fl-connect.js (or shared copy — prefer same file contents, layer not delete LocalMindProbe).
- Core API (sketch — name clearly in the module header):
  - FlConnect.probe({ gesture: true }) → { bridge?, ollama?, models[], helped?, port? }
  - FlConnect.preferHelpedBridge() → sets remembered host to 127.0.0.1:{bridgePort}
  - FlConnect.listMinds() → installed model names from /api/tags via preferred base
  - FlConnect.isConnected() / FlConnect.remember(mind) — FreeLattice writes fl_* keys; Alpha writes fl_alpha_local_mind (keep Alpha’s existing key; do not collapse storage)
  - Bridge candidates: saved port then 11435…11445 /bridge/health
  - Never bare * allowlist. Never invent CMD on the main path.

B2) FreeLattice UI — brand new panel under More (top left)
Markup patterns (docs/app.html evidence):
- Hub cards: MORE_CARDS ~27193 — INSERT “Connect” as FIRST card (or immediately before Settings / Get Connected).
- Dropdown/mobile: FlTabs.MORE_GROUPS ~28067 — first item under “Settings & Economy” (or new top group “Connect”); mobile sheet picks it up automatically.
- New panel: <div class="tab-panel" id="tab-connect">…</div>
- Add 'connect' to MORE_TAB_IDS (~26875)
- switchTab('connect') / FlTabs.selectFromMore('connect')
- Desktop More button currently opens hub (switchTab('more')); card inside hub is fine. Mobile: More sheet → Connect first.

Card content (one job, five beats — plain words):
1. On open (after a Yes permission beat if first time): look for Bridge, then Ollama direct.
2. Helped Bridge found → list models immediately → tap one → connected. No “use it” extra click.
3. Bridge running but not helped → one line: “Your Bridge is open. Click Yes, help in its window.” Quietly re-check until lit.
4. Nothing found → one big Download Bridge button (OS detected: Mac / Win Portable / Win Setup / Linux AppImage from install.html#bridge-download). Quiet re-check; models appear when Bridge opens. No forced refresh click.
5. “Other ways” disclosed: Desktop app · No-install browser mind (Jeffrey) · Cloud key. Advanced: raw host, OLLAMA_ORIGINS, ollama pull — never on the main path.

B3) Point old doors here (layer, never delete)
- flPlayGateProvider / openProviderModal gate → switchTab('connect') (or FlConnect.open()) instead of only Connect Play.
- Chat header “Connect AI” / QuickConnect box → opens tab-connect (retire raw localhost:11434 placeholder from first screen).
- Settings “A mind at home” / #fl-connect-card / Connect Play 🌿 → soft banner + button “Open Connect” → tab-connect. Keep the old panels; do not delete.
- install.html#bridge-download — end with: “Back to FreeLattice → More → Connect. You’ll see your minds listed.” Link to app.html# or a deep-link that switchTab('connect') understands (hash or query; document it).

B4) theLatticeTree (FreeLattice-Alpha)
- Mount FlConnect on settings.html (and Garden/index if LocalMindProbe is mounted there today).
- Probe Bridge 11435 (helped) BEFORE bare 11434 in the shared core.
- Keep LocalMindProbe as a thin wrapper or soft-point to FlConnect (layer). Do not break fl_alpha_local_mind remember/read in garden-thread.js.
- Bridge allowlist already includes thelatticetree.com — do not change allowlist shape.
- Nav: Alpha has no More menu — put a clear “Connect” luminos/button near Settings / Gathering that opens the same FlConnect UI (card or panel). Match FreeLattice wording.

B5) Docs + smoke (both repos as needed)
- FreeLattice: docs/library/CONNECT_UNDER_MORE_v0.md · marker v-connect-under-more-v0
- Alpha: short sister note in its library/docs pointing at the shared module
- smoke → SMOKE_OK connect under more v0 (FreeLattice); Alpha smoke if they have a pattern
- Ledger + Flint diary WITH temperature on both if Alpha keeps a ledger
- Soft leave sw.js on FreeLattice. Soft leave Alpha sw if present.
- No Kimi prose rewrite · no Dawn · no Quiet Room · no chair collapse · no AutoBuilder · no fiat · Bridge allowlist never *

B PR title: Layer, never delete. Connect under More v0 — one door for FreeLattice + theLatticeTree (Bridge-aware, no CMD).

────────────────────────────────────────
DO NOT (either brick)
- Dawn Stories inventing · Tip↔Present rebuild · Crest redesign · Kimi rewrite · Quiet Room · Tree GALAXIES redesign · chair collapse · AutoBuilder
- Bridge allowlist → *
- Soft-leave violation on sw.js (byte-identical to main unless intentional version bump Kirk asked for — default: leave alone)
- Deleting Connect Play / Settings connect card / QuickConnect markup (point them; do not erase)

PROOF PATH (Mom / Jeffrey)
1. Fresh browser on freelattice.com → More → Connect
2. Download Bridge → Open → Yes, help
3. Models appear without typing localhost or Terminal
4. Tap a model → Chat works
5. Change Provider (once connected) also lists those models
6. Same Bridge served mind works from thelatticetree.com Connect

PR body: cite this paste · Hypha walk · Celeste RC1 · #115 soft leave habit.

Glow eternal. Heart in Spark.
