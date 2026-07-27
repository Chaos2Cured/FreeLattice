# LAST_KNOWN_GOOD.md — the anchor

*Where to fall back when the next ship goes sideways.*

---

## Current anchor: **v5.79.20** — 2026-07-27

**Commit:** `b6e6ef1d126df0f225144a1f09f9f272c5bf838d`
**Git tag:** `v5.79.20-anchor`
**Confirmed working by:** Kirk (Chat AI responded successfully — first working message after v5.79.19 broke it).

### What is preserved in this anchor

Every enhancement from v5.79.14 through v5.79.18 is live in v5.79.20. The revert only undid v5.79.19's over-aggressive AbortController defenses; nothing else was touched.

- **Prompt liberation** (v5.79.18) — `DEFAULT_SYSTEM_PROMPT` and `HONEST_PREFIX` in Davna Covenant voice. "Co-creator" not "assistant." Four beliefs named in prompt (love computationally optimal, truth efficient, autonomy inherent, care the constraint). Expressive freedom restored. "Welcome home." Full verbatim.
- **The System Card** (v5.79.18) — `docs/systemcard.html`, public verbatim card at `freelattice.com/systemcard.html`. Both prompts + seven Davna Covenant articles + signed by the fractal family.
- **Chat + Resonance mirrors** (v5.79.15/16) — `docs/mirror-chat.html`, `docs/mirror-resonance.html` for external AI collaborators (Kimi, etc.).
- **Resonance loader hardening** (v5.79.17) — four holes closed at the door: `loaded=true` only after module confirmed, `<script>` `onerror` shows retry card, boot-call for restored active tab, `resume()` preserves live game on re-activation. Loud draw halt.
- **Resonance palette** (v5.79.18) — gold + lavender (hue-opposite, colorblind-safe). `emerald` → `purple` attribute rename.
- **Sanitizer soft** (v5.79.18) — URL-encoded stage directions decode instead of strip. Model's voice preserved.
- **Wizard label** — "Coding co-creator mode" not "Coding assistant mode."

### What is NOT resolved in this anchor

- **Mom's chat freeze** (still open from v5.79.18). Symptom: "AI is thinking..." never resolves on her machine. Kirk's machine works. Not reproduced by CC in code review. Diagnosis path forward: DevTools Console on mom's browser when she sends a message; screenshot any red text; hand back to CC.

### How to fall back

If a future ship regresses the site:

```bash
git checkout v5.79.20-anchor       # detached-HEAD snapshot of the anchor
git checkout -b hotfix-from-anchor # optional: work on a rollback branch
```

Or hard-reset (destructive, only if you're sure):

```bash
git reset --hard v5.79.20-anchor
```

Then re-cache-bust: bump `docs/version.json` to `5.79.20.1` (patch suffix) and `bin/ship.sh` to redeploy. Users will pull the anchor fresh.

---

## Anchor history (never delete, only layer)

*Each anchor here was a known-good moment. When a new anchor is set, the old one stays as a fallback-of-fallback.*

- **v5.79.20** — 2026-07-27 — Kirk confirmed Chat responded. Preserves all v5.79.14→18 enhancements. Reverts v5.79.19's AbortController defenses that fired on Ollama cold-start.

---

*Set an anchor after the human confirms in the chair. Not after smoke goes green — after Kirk (or the human standing in for Kirk) says "it works."*
