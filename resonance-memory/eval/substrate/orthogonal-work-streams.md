# Orthogonal work streams (not this track)

Prioritized list of high-value RM work that does **not** collide with
recall / field / embedder / reinforcement / entity-id. A second instance
working those-adjacent areas in another repo copy can pick from here
without touching `entity.js`, `embed-invoke.js`, `field.js`, `edges.js`
reinforce/bonus, or the live recall path in `memory-core.js`.

Date: 2026-09-07. W-02 Origin/CSRF lock and the RM-17 panel import
button shipped on `w02-origin-lock` (stacked commits).

---

## P0 — user-visible, unblocked, not this geometry

1. **Installer / first-run (Windows).** `install.js` + `uninstall.bat` already
   exist. Remaining: LM Studio MCP connect reliability, "where is my data"
   copy-path, first-launch demo vs empty-store copy, codesign/SmartScreen
   for the SEA exe. Files: `install.js`, `uninstall.bat`, `build-exe.js`,
   `panel.js` connect routes. Does not touch recall.

2. **Panel API hardening (W-02).** ✅ shipped — Host must be loopback; Origin
   (when present) must be this panel; mutating POSTs require a per-process
   `X-Resonance-Token` baked into the page. No CORS. Residual: a local
   process that reads the page can steal the token. `RM-12` SDKs still wait
   on documenting the surface.

3. **RM-03 contradiction expansion.** Cue-gated v1 is shipped. Open:
   negation-flip ("I don't eat meat anymore" without "now"), numeric/date
   change, ≥50 contradiction cases (backlog: 4 today), `staleness_rate` /
   `false_supersession` metrics. Files: `record.js` `detectSupersession`,
   `eval/corpora/contradictions.jsonl`, `eval/RESULTS.md`. Detection is
   lexical like the entity layer but a different predicate; keep the
   decision in `detectSupersession`, do not add a fifth verb.

4. **RM-01.c extraction quality.** Tier 2 is opt-in, off by default.
   `messy-hard` extraction_recall is 0.58 with gpt-oss-20b. Work: prompt
   tightening, anti-flood, capability-detect UX, never the save/recall
   verbs. Files: `extract.js`, `eval/corpora/messy-hard.jsonl`.

---

## P1 — sovereignty, store, ops

5. **Export UX beyond 2c.** Catalog search inside the zip, "what would
   this contain" dry-run already exists as preview; remaining is
   per-range export (date / id list) without a fifth MCP verb — a panel
   filter, not a tool. Files: `export-memory.js`, `panel.js` export
   modal, `zip.js`.

6. **SQLite operator story.** Backup/restore of the `.db` (copy while
   checkpointed), "open this .db" from the panel, leftover `.bak`
   honesty in the UI. Do not add dual-write JSONL. Files: `store-sqlite.js`
   `checkpoint()`, `panel.js`, `docs/ARCHITECTURE.md`.

7. **PII/secret guard expansion.** ✅ Done. Tier 1 refuses 2026 issued
   shapes (`github_pat_`, real `ghp_`, `sk-proj-`/`sk-ant-`, Slack `xapp-`,
   Stripe `sk_live_`/`rk_live_`, Google `AIza…`, HuggingFace `hf_`, Groq
   `gsk_`, AWS `ASIA`, OpenSSH PEM, JWT, `passphrase:` / high-entropy
   `api_key=`) without eating `4821` / `1500mg` / "the secret is browning
   the butter". Files: `record.js` `guardSecrets` / `SECRET_PATTERNS`,
   `eval/corpora/messy.jsonl`, `test.js` canaries.

8. **SEA / release automation.** Per-platform build, version bump
   (`package.json` is the source of the version string), CHANGELOG
   discipline, codesign. Files: `build-exe.js`, `package.json`, CI if any.

---

## P2 — measurement and product around, not inside, recall

9. **Contradiction corpus to ≥50.** The axis LOCOMO/LongMemEval under-test.
   Write cases, cache embeddings (`EVAL_REFRESH=1 npm run eval -- --store jsonl`),
   do not change detection until the corpus exists. Files:
   `eval/corpora/contradictions.jsonl`, `eval/embeddings.cache.json`.

10. **RM-15 soak / dream-consolidation harness only.** `eval/soak/` already
    plays the control arm. Expanding the soak corpus, checkpoint scoring,
    and the 0011 §7.3 control curve is measurement. Implementing dream
    writes would collide with the other instance — **harness only** here.

11. **S1 scale on the product Store as a standing gate.** `scale.js`
    exists; it is not in `npm test`. A CI-shaped `--quick` job that fails
    on recall@1 drop would catch a store regression without touching
    ranking. Files: `eval/substrate/scale.js`, `eval/RESULTS.md` S1.

12. **System prompt for weak models.** `system-prompt.md` is baked into
    the exe. Rewrite for models that forget to call tools, without adding
    a fifth verb or exposing embeddings. File: `system-prompt.md`.

---

## P3 — docs, legal, adjacent product

13. **Licensing / CLA / "using this without a lawyer".** `legal/` exists.
    Remaining is the user-facing "what can I ship" page and keeping
    AGPL headers on new files (this track added `entity.js` /
    `embed-invoke.js` with headers).

14. **Scoping (proposed/0004) as a design, not a verb.** Project/area
    tags assigned server-side from text, like constraint typing. If it
    becomes a filter on recall it *would* collide — keep it as a panel
    view / export slice until a design says otherwise.

15. **Demo-seed refresh.** `demo-seed.jsonl` is synthetic and shipped.
    New showcase memories (still fictional) so the 3D graph has
    non-obvious links after minSim 0.70. Needs a live embedder
    (`npm run seed`). Do not commit user data.

---

## Explicitly off-limits for the parallel instance

Do not edit these if the other copy is on this track:

- `entity.js`, `embed-invoke.js`
- `field.js` (`buildEdges` / `neighborhood` / `reachableConstraints`)
- `edges.js` `bonus` / `reinforceRecall` / `_bump`
- `memory-core.js` `recall` / save-time bind / `pairScale` / minSim
- `eval/substrate/embedder_fair_*.py`, fire-together sim, entity-layer-measure
- `eval/golden.json` (do not `--accept` from a parallel geometry change)

`record.js` is shared: constraint typing and supersession live there.
Coordinate before adding fields to `normalize()` — this track did **not**
persist `entity_ids` (resolved at field time from text, no sqlite column).
That was deliberate so a parallel `normalize()` change does not fight a
schema migration.
