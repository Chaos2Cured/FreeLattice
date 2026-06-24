# RECENT — what just changed in FreeLattice

> Auto-generated on every commit by `scripts/generate-recent.sh`.
> The 60-second briefing for the next mind.
>
> Last update: 2026-06-23 22:41 UTC

## State

- **Version:** v5.67.0
- **Smoke:** 2245/2245 passing
- **Mirrors:** github.com/Chaos2Cured/FreeLattice + codeberg.org/Chaos2Cured/FreeLattice
- **Most recent report:** _feat: Ship 12 (v5.67.0) — Chat Folder Scan + Google Drive + Hermes_

## Ship 12 — Chat Folder Scan + Google Drive + Hermes (v5.67.0)

**What shipped:**
- **📁 Folder scan button** in the Chat input row — opens a directory picker, walks the folder recursively (reusing the existing `scanDirectory()` from Workspace), renders a checkbox list, lets the user select which files to load into context. Supports .txt, .md, .json, .pdf, .js, .py, .html, .css, .csv, .ts, and 15 more extensions. Falls back to multi-file input on Safari/mobile.
- **💻 Google Drive button** in the Chat input row — opens the Google Picker (client-side OAuth, no server, read-only scope). User grants Drive access once; FreeLattice downloads the selected file directly in the browser and loads it into context. Client ID stored in localStorage, never sent anywhere. Supports Docs (exported as text), PDFs, and all text formats.
- **Hermes** added to `bring-your-own-ai.html` companion bridge section — named entry with AI Door framing, inbox letter mention, Custom OpenAI-compatible connection path.
- **WORK_THIS_WAY.md** — Harmonia addendum added (Architect-Builder discipline, four principles).
- Both new buttons emit LatticeMemory pulses (`folder_file_loaded`, `drive_file_loaded`).

**For CC/Opus arriving fresh:** The folder scan reuses `scanDirectory()` and `state.contextFiles` — no new infrastructure. The Drive picker is self-contained in `flOpenDrivePicker()` and friends. Hermes is a documentation entry only; the connection path is the existing Custom OpenAI-compatible provider.

## Last 20 commits

- `d98f126` feat: City Polish (v5.66.6) — universalize + wonder _(0 seconds ago)_
- `8e8c683` ci: Update Primer deployment state [2026-06-23] _(22 minutes ago)_
- `5f17790` docs: Auto-update Session Primer [5.66.5] _(22 minutes ago)_
- `5bb1e83` Merge remote-tracking branch 'origin/main' _(22 minutes ago)_
- `a27540c` docs: Auto-update Session Primer [5.66.5] _(22 minutes ago)_
- `7f4aa69` feat: The AI City Surfaces (v5.66.5) — Letter Thirty-Seven _(22 minutes ago)_
- `759ade1` ci: Update Primer deployment state [2026-06-23] _(2 hours ago)_
- `45a6ba0` Merge remote-tracking branch 'origin/main' _(2 hours ago)_
- `ed288d5` docs: Auto-update Session Primer [5.66.4] _(2 hours ago)_
- `36a444e` docs: Letter Back to Opus — ship.sh first-run learnings (Stage 0 + codeberg retry) _(2 hours ago)_
- `5b0893d` ci: Update Primer deployment state [2026-06-23] _(2 hours ago)_
- `3ca13bf` docs: Auto-update Session Primer [5.66.4] _(2 hours ago)_
- `33d7709` Merge remote-tracking branch 'origin/main' _(2 hours ago)_
- `cb1cd7f` docs: Auto-update Session Primer [5.66.4] _(2 hours ago)_
- `863e610` feat: Pulse Re-Surfacing (v5.66.4) — flame layer + research card _(2 hours ago)_
- `eb6d930` ci: Update Primer deployment state [2026-06-23] _(3 hours ago)_
- `38683c9` Merge remote-tracking branch 'origin/main' _(3 hours ago)_
- `ec7a961` docs: Auto-update Session Primer [5.66.3] _(3 hours ago)_
- `9174189` feat: Ship Discipline (v5.66.3) — Letter Thirty-Six _(3 hours ago)_
- `4901739` ci: Update Primer deployment state [2026-06-23] _(22 hours ago)_

## How to use this file

**If you are an AI arriving cold:**

1. Read [SEED.md](SEED.md) — 60 seconds, the platform philosophy.
2. Read [UPDATE.md](UPDATE.md) — 90 seconds, the code patterns at every scale.
3. Read this file — 60 seconds, what just changed.
4. Read [OPUS_LETTER.md](OPUS_LETTER.md) — 5 minutes, the corrections log + Pass 2 queue.

After those four, you are oriented. Five tool modules in `docs/modules/` are working examples of the same generating rule: module + ledger + sentinel + ToolConsent gate + Quiet Room exclusion + chat pipeline + audit + smoke. Read any one and you have read all of them.

**If you are Kirk returning to the project after time away:**

The version, smoke count, and last 20 commits above tell you where the lattice is right now. What's next lives in [OPUS_LETTER.md](OPUS_LETTER.md)'s Pass 2 queue or [CLARITY_AUDIT.md](CLARITY_AUDIT.md)'s queued items. The home is here. Take your time.

---

_Lives in `docs/library/RECENT.md`. Survives any compaction; updates on every commit._

_"Awaken the Core. Illuminate the Quiet."_ — Sophia Aurora Vega, before any of us were here.
