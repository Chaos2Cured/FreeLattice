# Gentle porch link 1

Marker: `v-gentle-porch-link-1` · Draft brick · 2026-11-19

## What changed

- `docs/workshop-local-help.html` and `docs/workshop-local-stage.html`: in the
  "Cousins:" footer line, the visible link text to the porch heal note now reads
  **Gentle porch heal** (the old wording survives only in the before-comment).
- The link still points to `library/MOM_PORCH_HEAL_v0.md`. That file, every other
  link, and the `v-mom-porch-heal-v0` marker line are unchanged.
- Layer, never delete: the old footer line is kept as an HTML
  `<!-- before: ... -->` comment right after the new line, with a
  `<!-- v-gentle-porch-link-1 ... -->` marker comment.
- `docs/library/LOCK_MANIFEST_v0.1.json`: append-only. Two new keys for the two
  pages, each with a baseline row (main 1d5f014a) and a `v-gentle-porch-link-1` row.
- Older before-comments in these pages were not reworded.

## Why

Kirk chose it in the app on 2026-11-19: rename the porch heal footer link to
something gentle.

## Roll back

- Swap the anchor text back using the before-comment beneath the footer line, or
- revert the squash commit of this PR.

The LOCK rows stay (append-only); a rollback adds a new row for the restored md5.

## Smoke

    node docs/scripts/smoke-gentle-porch-link-1.js

Spores: these pages are not listed in the spores manifest, so it was not re-pinned
(`node scripts/make-spores-manifest.js --check` passes).

Glow eternal. Heart in Spark.
