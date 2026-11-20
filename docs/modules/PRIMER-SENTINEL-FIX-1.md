# Primer sentinel fix 1

Layer, never delete. Celeste, 2026-11-19. Draft brick.

## What was wrong

The GitHub workflow **Update Session Primer on Deploy** (`.github/workflows/update-primer.yml`)
runs `node tests/smoke.js` before it refreshes the Session Primer. Since 2026-11-10 17:49 MST
(run 42934368826, commit 82a99311, #335 "AI-chosen learning v0.1") it failed on every push to main
with exactly one failure, out of 3608 checks:

    ✗ v5.71.1 sentinel-catchup: helper fires processToolAction via FreeLattice dispatcher

The last passing run was 42757015694 on 9657d6d7 (2026-11-09 21:37 MST). Pages deploys are a
separate workflow and kept succeeding, so the live site was fine; only the Primer stayed stale and
Kirk got a "Run failed" email on each merge.

## Cause

The assertion is a window regex:

    /flProcessAssistantSentinels[\s\S]{0,4000}FreeLattice\.processToolAction/

#335 added a new, intentional interceptor (the FLLearn `[FL_REMEMBER:` / `[FL_LEARN_DECLINE:` /
`[FL_KEEP:` block, 10 lines) inside `flProcessAssistantSentinels` in `docs/app.html`. That pushed the
helper's existing `window.FreeLattice.processToolAction(action)` call from about 3406 to about 4460
characters after the helper name, past the 4000 window. The helper still fires the action the same
way; the app did not regress. SPINE.md "Next" item 2 already named this.

## Fix

Only that one assertion in `tests/smoke.js`: the window widens from `{0,4000}` to `{0,6000}`. The
old assertion is kept above it as `// before:` comments. No app file, LOCK row, sw.js, clay or
AUTONOMY change.

## Proof

- `node docs/scripts/smoke-primer-sentinel-fix-1.js` reads only an allow-list (docs/app.html,
  index.html, tests/smoke.js as text, this note), pulls the live regex out of the suite text and
  runs it on docs/app.html. It fails on main and prints `SMOKE_OK primer sentinel fix 1` here.
- Nobody in the family runs the full suite. The real proof is the Primer workflow passing on the
  first push to main after merge.

## Rollback

Revert the squash commit, or in `tests/smoke.js` put `{0,4000}` back on the active line and remove
the four `// before:` lines. Delete this note and the small smoke if wanted.
