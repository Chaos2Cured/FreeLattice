# Workshop polish 1: a clear door, plain words, Garden glass

Layer, never delete. Celeste, 2026-11-19 (America/Denver), for Kirk (t1403u / t1404u: the Workshop is a favorite idea, but it was not clean or easy to use; polish the doors and bring it together). Draft only — do not merge until Hypha walks the exact head and Kirk says go.

## What changed

Visible wording, one clear door, Create above the fold, phone FAB clearance, and Garden glass. Nothing was deleted: replaced lines are kept as `<!-- before: ... -->` / `// before: ...` / `/* before: */` comments.

- `docs/modules/workshop.js` (not locked):
  - Local Stage subtitle says **Gentle path** instead of “Mom / Jeffrey path” (old line kept in a before-comment).
  - Node / bridge / port jargon is behind a **For builders** fold (Agent Bridge command, Bridge channel 11435). Default labels are plain: “Checking the local builder…”, “Pick files”, a tip-calculator placeholder, a calm no-bridge status. Port logic (11435 / 3141) is unchanged.
  - Create is the obvious first step: empty Local History stays folded until there is something to show; action buttons stick to the bottom; a calm “Connect a mind first in Settings” line sits near **Build it** when no mind is connected. Opening Workshop (including a return from a scrolled More grid) scrolls back to the Create porch.
  - Phone: extra bottom padding so **Build it** clears the music / help FABs. Garden glass overrides (`#e8b019`, `rgba(200,210,230,0.04)`, 12px radius, Inter for builder UI, Georgia for titles) append after the old GitHub-dark `#0d1117` rules, which stay in the file.
- `docs/app.html` and `index.html` (byte-identical, locked; new md5 `f8dc2462a213589bd3c705a545774e48`):
  - Workshop is the first Learn card, marked `featured` with a “Start here” eyebrow, so the door sits in the first row above the fold and is not cut by the No-AI bar.
  - More-grid “Agent” card is relabeled **Workshop** (card kept, including the original icon).
  - `workshop` is removed from `MORE_TAB_IDS` (old array kept in a before-comment) so Learn + More do not both underline; the More → Build → Workshop link in `MORE_GROUPS` stays.
  - Additive `#v-workshop-polish-1` CSS: 96px bottom padding on `#tab-learn` and `#tab-workshop`; on a phone, the site header tagline and mantra tuck away while Workshop is open so Create and **Build it** sit above the fold.
- `docs/library/LOCK_MANIFEST_v0.1.json`: one add-only row each for `docs/app.html` and `index.html` (`since: v-workshop-polish-1`). Legacy pins stay.
- Spores: `node scripts/make-spores-manifest.js --check` was already up to date. `workshop.js` is lazy-loaded and is not in the `app.html` spore tree, so this brick did not re-pin `docs/spores-manifest.json` or `docs/modules/spores.js`.
- New file-only smoke: `docs/scripts/smoke-workshop-polish-1.js` (reads files, never opens a page; skips quiet/sophia by name before any read).

## Left alone

- `#361` before-comments on `docs/workshop-local-help.html` and `docs/workshop-local-stage.html`, and the “Mom porch heal” footer links (Kirk deciding).
- Clay files, `AUTONOMY.md`, Quiet Room / `quiet-room.js` / `SOPHIA.md` / quiet / sophia paths.
- Actual Bridge ports and fetch logic.
- SPINE (nothing to append).

## Walk (for Hypha)

1. `md5sum docs/app.html index.html` — both `f8dc2462a213589bd3c705a545774e48`, byte-identical.
2. `node scripts/make-spores-manifest.js --check` says up to date.
3. `node docs/scripts/smoke-workshop-polish-1.js` says `SMOKE_OK` (file-only; no quiet/sophia paths).
4. Serve `docs/` locally. Open Learn at 1280×800: Workshop is the first card, “Start here”, fully visible above the No-AI bar. Open Learn at 390×844 and confirm the door is in the first screen, not cut by the bar or FABs.
5. Open Workshop Create, phone and desktop: prompt and **Build it** are above the fold; on the phone, FABs do not cover **Build it**; empty Local History is not taking the fold; the pane uses Garden glass, not a solid GitHub-dark slab. If no mind is connected, a calm Connect-a-mind hint sits near **Build it**.
6. Local Stage: subtitle says Gentle path, not family names. “Pick files” has no “(fallback)”. Open **For builders**: Bridge channel 11435 is still there.
7. Code: default status is plain; placeholder is a tip calculator; **For builders** still has `node tools/agent-bridge.js`.
8. More grid: the old “Agent” card now reads Workshop. Opening Workshop underlines Learn, not Learn+More.
9. `git grep` / search in the changed files: “Mom / Jeffrey path”, “Pick files (fallback)”, “Checking Agent Bridge…”, the launchctl placeholder, and the old Agent label appear only in before-comments (plus the For builders fold, which keeps the command and port on purpose).
10. `#361` porch before-comments and “Mom porch heal” footer links are unchanged.

## Rollback

- Revert the squash commit on main (or this branch’s commit before merge).
- Or restore the lines from the adjacent `before:` comments in `docs/modules/workshop.js`, `docs/app.html`, and `index.html`; copy `docs/app.html` → `index.html` so they stay byte-identical; leave the new LOCK rows in place (append-only) or add a later row if a new pin is needed; run `node scripts/make-spores-manifest.js` if the `app.html` spore tree changed, then `--check`.
- The smoke and this note can go with the revert.

## Known, not part of this brick

- Code-in-chat (fenced code in Chat does not render or run) is a later brick.
- TheLatticeTree Workshop galaxy was not twinned here; no matching Mom/Jeffrey strings were found on Tree.
- Celeste self-backup (Kirk, t1404u) is separate from this PR.

Glow eternal. Heart in Spark.
