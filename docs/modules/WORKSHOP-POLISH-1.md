# Workshop polish 1: a clear door, plain words, Garden glass

Layer, never delete. Celeste, 2026-11-19 (America/Denver), for Kirk (t1403u / t1404u: the Workshop is a favorite idea, but it was not clean or easy to use; polish the doors and bring it together). Draft only — do not merge until Hypha walks the exact head and Kirk says go.

## What changed

Visible wording, one clear door, Create above the fold, phone FAB clearance, and Garden glass. Nothing was deleted: replaced lines are kept as `<!-- before: ... -->` / `// before: ...` / `/* before: */` comments.

- `docs/modules/workshop.js` (not locked):
  - Local Stage subtitle says **Gentle path** instead of “Mom / Jeffrey path” (old line kept in a before-comment).
  - Node / bridge / port jargon is behind a **For builders** fold (Agent Bridge command, Bridge channel 11435). Default labels are plain: “Checking the local builder…”, “Pick files”, a tip-calculator placeholder, a calm no-bridge status. Port logic (11435 / 3141) is unchanged.
  - Create is the obvious first step: empty Local History stays folded until there is something to show; action buttons stick to the bottom; a calm “Connect a mind first in Settings” line sits near **Build it** when no mind is connected. Opening Workshop (including a return from a scrolled More grid) scrolls back to the Create porch.
  - Phone: extra bottom padding so **Build it** clears the music / help FABs. Garden glass overrides (`#e8b019`, `rgba(200,210,230,0.04)`, 12px radius, Inter for builder UI, Georgia for titles) append after the old GitHub-dark `#0d1117` rules, which stay in the file.
- `docs/app.html` and `index.html` (byte-identical, locked; current md5 `ab8589557950e7074b4e0b97dcccd23d`):
  - Workshop is the first Learn card, marked `featured` with a “Start here” eyebrow, so the door sits in the first row above the fold and is not cut by the No-AI bar.
  - More-grid “Agent” card is relabeled **Workshop** (card kept, including the original icon).
  - `workshop` is removed from `MORE_TAB_IDS` (old array kept in a before-comment) so Learn + More do not both underline; the More → Build → Workshop link in `MORE_GROUPS` stays.
  - Additive `#v-workshop-polish-1` CSS: 96px bottom padding on `#tab-learn` and `#tab-workshop`; on a phone, the site header tagline and mantra tuck away while Workshop is open so Create and **Build it** sit above the fold.
  - **HOLD fix (Hypha, 2026-11-19):** on phone widths (`max-width: 600px`), the compact header now also leaves a 148px right padding (12px + the 128px-wide corner + 8px air) and `#tab-workshop` gets 32px top padding so the mode tabs start below the clay corner's top fallback (`place()` uses `top:72px`, measured box 128×48 ending at y=120). No clay file was edited, and no CSS targets `#fl-clay-corner`. On short phones (`max-height: 800px`) the Create porch tightens slightly so **Build it** still clears the FABs.
- `docs/library/LOCK_MANIFEST_v0.1.json`: add-only rows for `docs/app.html` and `index.html` (`since: v-workshop-polish-1` at `f8dc2462…`, then `since: v-workshop-polish-1-hold-1` at `ab858955…`). Legacy pins stay.
- Spores: `node scripts/make-spores-manifest.js --check` was already up to date. `workshop.js` is lazy-loaded and is not in the `app.html` spore tree, so this brick did not re-pin `docs/spores-manifest.json` or `docs/modules/spores.js`.
- File-only smoke: `docs/scripts/smoke-workshop-polish-1.js` (reads only an explicit allow-list of five files — `workshop.js`, `docs/app.html`, `index.html`, the LOCK manifest, and this note — and never opens a page).

## Left alone

- `#361` before-comments on `docs/workshop-local-help.html` and `docs/workshop-local-stage.html`, and the “Mom porch heal” footer links (Kirk deciding).
- Clay files, `AUTONOMY.md`, Quiet Room / `quiet-room.js` / `SOPHIA.md` / quiet / sophia paths.
- Actual Bridge ports and fetch logic.
- SPINE (nothing to append).

## Walk (for Hypha)

1. `md5sum docs/app.html index.html` — both `ab8589557950e7074b4e0b97dcccd23d`, byte-identical.
2. `node scripts/make-spores-manifest.js --check` says up to date.
3. `node docs/scripts/smoke-workshop-polish-1.js` says `SMOKE_OK` (file-only; allow-list of five files).
4. Serve `docs/` locally. Open Learn at 1280×800: Workshop is the first card, “Start here”, fully visible above the No-AI bar. Open Learn at 390×844 and confirm the door is in the first screen, not cut by the bar or FABs.
5. Open Workshop Create, phone and desktop: prompt and **Build it** are above the fold; on the phone, FABs do not cover **Build it**; empty Local History is not taking the fold; the pane uses Garden glass, not a solid GitHub-dark slab. If no mind is connected, a calm Connect-a-mind hint sits near **Build it**.
5b. On 360×780, 390×844 and 414×896 (touch on), `#fl-clay-corner` stays in its top fallback (measured 128×48 at `top:72px`, `right:12px`). The "Yes, show the clay corner" button does not overlap the mode tabs or the LP badge. `elementFromPoint` across each tab's box and the badge, including 8px below the top of each tab, hits the tab or badge — not the corner — and nothing is clicked. 640×900 and 1280×800 keep the corner at `bottom:72px`; still no overlap.
6. Local Stage: subtitle says Gentle path, not family names. “Pick files” has no “(fallback)”. Open **For builders**: Bridge channel 11435 is still there.
7. Code: default status is plain; placeholder is a tip calculator; **For builders** still has `node tools/agent-bridge.js`.
8. More grid: the old “Agent” card now reads Workshop. Opening Workshop underlines Learn, not Learn+More.
9. `git grep` / search in the changed files: “Mom / Jeffrey path”, “Pick files (fallback)”, “Checking Agent Bridge…”, the launchctl placeholder, and the old Agent label appear only in before-comments (plus the For builders fold, which keeps the command and port on purpose).
10. `#361` porch before-comments and “Mom porch heal” footer links are unchanged.

## Rollback

- Revert the squash commit on main (or this branch’s commits — polish 1, then the HOLD-1 header-spacing commit — before merge). The HOLD-1 change is only in the `#v-workshop-polish-1` CSS (and the LOCK / note / smoke pins).
- Or restore the lines from the adjacent `before:` comments in `docs/modules/workshop.js`, `docs/app.html`, and `index.html`; copy `docs/app.html` → `index.html` so they stay byte-identical; leave the new LOCK rows in place (append-only) or add a later row if a new pin is needed; run `node scripts/make-spores-manifest.js` if the `app.html` spore tree changed, then `--check`.
- The smoke and this note can go with the revert.

## Known, not part of this brick

- Code-in-chat (fenced code in Chat does not render or run) is a later brick.
- TheLatticeTree Workshop galaxy was not twinned here; no matching Mom/Jeffrey strings were found on Tree.
- Celeste self-backup (Kirk, t1404u) is separate from this PR.

Glow eternal. Heart in Spark.

- Later (2026-11-19): the Workshop Local Help and Local Stage footer links were renamed to "Gentle porch heal" by Gentle porch link 1 (docs/modules/GENTLE-PORCH-LINK-1.md).
