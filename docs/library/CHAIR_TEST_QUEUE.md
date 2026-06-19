# CHAIR_TEST_QUEUE.md

> Pending chair-test items for Kirk. Newest first. *Never delete entries; flip to ✓ confirmed and leave the receipt.*
>
> Created 2026-06-18 per Opus's Letter Six instruction in `docs/inbox/cc.md`. Lives in `docs/library/` so the queue travels with the codebase.
>
> Each entry has: version, what shipped, the single (or few) thing(s) Kirk needs to verify on the live site, and the chair-test status (`[pending verification]` until confirmed).

---

## v5.56.1 — Naming Lock: `[FL_REVISE]` → `[FL_ANNOTATE]`

- **What shipped:** sentinel pattern, ledger key, kind field, audit-page section title, render function, and all UI copy renamed per Letter Six. The architecture never amends; it layers. Annotation adds context; it does not replace the original. One-time migration of any v5.56.0 chair-test data from `fl_revisionLedger` → `fl_annotationLedger` runs on first load; the old ledger is preserved as a historical receipt (never delete, only layer). A provenance chain entry is written so the chain itself carries the migration receipt.
- **Single chair-test step:** After hard refresh, open `docs/audit.html`. The section is titled **Annotations** (not "Revisions"). Any annotation text the AI emitted via the old `[FL_REVISE]` sentinel during v5.56.0 chair testing appears under the new section. **No language like "revised", "revision", "corrected", "correction", "amended" appears anywhere in the annotation UI** — the chip should read *"the original message above is unchanged · the annotation adds context."*
- **Smoke locks the discipline:** the annotation-language enforcement lock greps the audit render path for forbidden revision-coded words and halts CI if any are present. If a future change accidentally introduces revision-style language, the deploy fails.
- **Chair-test status:** ✓ **Kirk confirmed 2026-06-18.** Hard-refresh on freelattice.com showed the audit section titled *Annotations* with no revision-coded language present. The naming lock holds on the live site. The architecture cannot claim to amend; it can only claim to add — confirmed in the chair, not just in smoke.

---

## How to add an entry

1. Open this file.
2. Add a new entry at the TOP under a `## vX.Y.Z — short title` heading.
3. Fill in: **What shipped** (one paragraph), **Single chair-test step** (or numbered steps if more than one), **Chair-test status** (`[pending verification — what Kirk verifies]` until confirmed, then `✓ Kirk confirmed YYYY-MM-DD`).
4. Never delete an entry. Closed chair tests sit in this file forever as the lineage of *what was actually verified on the live site.*

---

*"Smoke is necessary. Kirk's eyes on the live page are sufficient. Until Kirk says 'I see the fix,' ship status is `[pending verification]`, not `done`."* — CC_POEMS.md stanza II.
