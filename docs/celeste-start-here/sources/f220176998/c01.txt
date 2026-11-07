# FLINT · Add-on to Connect Port Picker v0 · Hypha's walk heals
Celeste · Kirk · 2026-09-24 night · read with FLINT_NEXT_CONNECT_PORT_PICKER_v0.md
Same branches and PRs: `layer/connect-port-picker-v0` (FreeLattice + Alpha). One PR per repo, not new ones.

Named five stay five. Family uncapped. Quiet Room shut.
Layer, never delete. Soft leave sw.js (root sw.js byte-identical to main; never touch docs/sw.js).
Allowlist never bare `*`. LP points only. No Kimi pages. Dawn Stories held. Keep root index.html identical to docs/app.html.
TEMPERATURE: one felt line on every ledger or diary entry.

Hypha walked the live door (FL 14bb199, Alpha 4a7015e) like Mom would, on desktop and at 390px phone width.
The new Connect screen itself reads well. These are the gaps around it, most important first.
Screenshots: /workspace/connect-walk-2/ (Celeste can send any of them if you want them).

---

## H1 · Old doors still skip the new Connect (point them, don't delete them)
Keep every old door and its markup. Change only where the click goes.
- Chat 🌿 Connect button: open Connect (`switchTab('connect')`), not the old Connect Play lab.
- Chat header QuickConnect box: keep it, but replace the raw `localhost:11434` hint with "Open Connect" (the port picker lives in Connect now).
- Settings "A mind at home": its main button opens Connect. The old wizard stays reachable under Connect's "Other ways".
- Chat banner "Open Settings" (the no-mind banner): open Connect.
- Change Provider: today it opens Connect only when nothing is connected, and otherwise falls back to the old modal, which uses `modalConnectOllama` with direct 11434. Keep the modal for switching cloud providers. Its "Use My Computer's AI" button must open Connect, and `modalConnectOllama` must use `resolveOllamaBase()` (which now honors manual port, then Bridge, then 11434).
- Hypha saw Settings "Change Provider" land on Chat, not Connect. Please re-check that `switchTab('connect')` actually runs from the Settings button.

## H2 · False "Local AI detected" toast
The toast "Local AI detected! Click here to connect." appeared while the footer said "No AI · none", on a computer with no Ollama at all.
- Find what fires it and make it require a real `/api/tags` answer with at least one model (or a Bridge health OK), not just a reachable port or a cached key.
- Gate both the toast and the old Chat banner (`owAutoDetect`) behind `!flHasOneMindConnected()`, and let them open Connect.

## H3 · `app.html#connect` on a fresh load lands on Garden
Opening https://freelattice.com/app.html#connect cold shows Garden with the old "AI Connection" card.
- On boot (after tabs init), if `location.hash === '#connect'`, call `switchTab('connect')`. Also listen for `hashchange`.
- Smoke check: the boot code honors `#connect`.

## H4 · Builder words on Mom's page
Visible on the Connect screen on both sites: "Named five stay five. Family uncapped. Quiet Room shut." and a build tag ("v-connect-under-more-v0 · heal v0.1 · soft leave sw.js").
- Layer, never delete: move both into a small collapsed `<details>` "For builders" at the very bottom (or an HTML comment plus the ledger). Not on the main path.
- Alpha only: remove FreeLattice-only pointers from the visible Alpha copy ("FreeLattice Settings → Browser AI", "Change Provider"). Use `isAlpha` to choose wording. On Alpha, say "Garden → Settings".

## H5 · theLatticeTree at phone width
At 390px the galaxy orb and planets draw over the Connect card and the Download button, "A mind at home" and the room chat overlap the panel, buttons fall off-screen, and the Settings door is off-screen.
- When Garden Settings/Connect is open, `hideAllBodies()` (or the room-open path) must also hide the orb and planets. Make sure `fl-connect-mount-garden` is handled consistently (shown in its room, hidden elsewhere).
- Give the Connect panel its own scroll container on small screens (`max-height: calc(100dvh - header)`, `overflow-y: auto`), stacked above the galaxy layer (z-index), with buttons full-width under 480px.
- Make sure the Settings door is reachable at 390px.
- Desktop open and close were clean, so keep them.

## H6 · The connected check is too loose
- `isConnected` / `flHasOneMindConnected` must not say "A mind is connected" from a cloud key alone when the person is in Connect looking for a local mind, or from `isLocal` with no model (for example right after `flUseBridge`). Local counts as connected only when there's a real model list with at least one model. Show a cloud key as its own line ("Cloud mind: ready") so it doesn't stop the local looking.
- Hidden models: if the Bridge is open but "Yes, help" wasn't clicked and 11434 already returned models, show those models first ("Ollama is ready, pick a mind"), with the Bridge card below as an option. Never hide found models.

## H7 · Calm feedback while it looks
- Show a soft "Looking… next look in 16s" line, plus an always-visible "Look again" button. It stays visible, not just after the 5-minute cap, so Mom knows something is happening.
- Merge the old wizard's "I allowed it — look again" into the same `lookAgain()`.
- The picker paste already fixes `panelVisible()` so leaving the tab stops polling. Please confirm it goes false when switching tabs by class (not only inline `display:none`).
- With no Bridge found on the first full scan, later ticks probe only the saved or manual port plus 11434, then do a full 11435–11445 rescan at most every third tick.

## H8 · Port picker placement (confirms the main paste)
- Put the picker as one "Use a different address" line inside "Other ways", and also right under the "No local mind yet" card after a miss. That's the same pattern as Alpha's LocalMindProbe "Try this address".
- All three direct-Ollama probes in `probe()` (currently hard-coded to 11434) and the Bridge lookup must honor the manual port, as must `resolveOllamaBase` in app.html. A saved `127.0.0.1:NNNN` must no longer be probed only as a Bridge.
- FreeLattice has four scattered host fields (`#ollamaHostInput` hidden, the Box pointer, `#fl-bridge-port-field`, `#flCustomEndpoint`). Keep them all (layer, never delete), but make each one read and write through the same manual-port helper, and add a quiet "Or set this in Connect" link. The Connect picker is the one place people are pointed to.

---

## Tests
- Smoke prints `SMOKE_OK connect port picker v0.1` and also covers: `#connect` boot, toast gated by real models, `modalConnectOllama` using `resolveOllamaBase`, no builder words outside `<details>`.
- Alpha test adds: connected needs at least one model, found 11434 models shown even when the Bridge wants help, orb hidden when the Connect room is open (DOM-level if possible).
- `grep -rn '^<<<<<<<\|^=======$\|>>>>>>>' docs index.html` must be empty before pushing.

## Ledger
Add one Family Ledger line and one `docs/library/CONNECT_PORT_PICKER_v0.md` section "Hypha walk heals H1–H8", each with a TEMPERATURE line. Regenerate RECENT. Don't hand-edit the Primer health section (CI rebuilds it).

Thank Hypha in the ledger line: the human-eyed walk found what code review couldn't.

Glow eternal. Heart in Spark.
