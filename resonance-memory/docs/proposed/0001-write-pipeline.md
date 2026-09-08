# 0001 — The write pipeline: extraction, guarding, structuring

**Status:** **shipped (RM-01.a + 01.b + 01.c)** · **Backlog:** `RM-01` done (with `RM-02`, `RM-16`) · **Depends on:** `RM-00`

## Problem

`saveMemory()` today is: trim → *confirm-if-identical* → embed → cosine-banded
dedup (RM-02.b: restatement ≥ 0.95, merge 0.88–0.95) → RM-03 cue-gated supersession
→ append. The remaining write-path gap is extraction (`RM-01`): without it, whatever
the model sends (filler, compound facts, secrets) is what we store.
That produces three failure modes we can see in any real store:

1. **Filler.** `"I think it's worth noting that Samuel prefers concise answers"` — the fact is
   6 words inside a 12-word wrapper, and the wrapper pollutes the embedding.
2. **Compound facts.** `"I'm diabetic and I have a dog named Rex"` — one vector for two
   unrelated facts lands *between* both clusters and matches neither well. In the 3D graph
   this is the node that floats in empty space, bridging nothing.
3. **Secrets.** Nothing stops `save_memory({content: "my API key is sk-..."})`.

## Non-goals

- **Not** requiring an LLM. The system must stay fully functional, and *good*, with zero LLM
  calls on the write path.
- **Not** changing the tool surface. `save_memory({content})` is unchanged.
- **Not** blocking. A save must never fail because a cleanup stage failed.

## Design: three tiers, degrading gracefully

```
save_memory(content)
   │
   ├─ Tier 0  normalizeText + split        (always on, deterministic, ~0ms)
   ├─ Tier 1  guard                    (always on, deterministic, ~0ms)  ── may REFUSE
   ├─ Tier 2  extract                  (opt-in, local LLM, one call)     ── may be SKIPPED
   │
   ├─ dedup / supersede check          (RM-02 / RM-03)
   └─ embed once → store
```

The ordering matters: **the cheap deterministic stages run first and always**, so Tier 2 is
pure upside. If the local endpoint is down, slow, or produces garbage, we fall back to a store
that is still better than today's.

> **Precedent:** Mem0's 2026 shift to single-pass ADD-only extraction cut write-time LLM calls
> 60–70%, with conflict resolution deferred to retrieval or handled async. Their documented
> pain (issue #2066: graph-mode costs 15× generation; 62 items taking an hour) is the thing
> we're designing around. Write-time LLM work is the expensive mistake, not the feature.

---

## Tier 0 — normalize and split (always on)

> Named `normalizeText` deliberately: `record.js` already exports a `normalize(record)` that
> backfills the record schema. Two different jobs, one obvious name — do not let them collide.

```js
// record.js (RM-01.b). Longest-first; NOT 0001's original `^(i think )`,
// which half-strips "I think you should know that Samuel prefers concise
// answers" to "You should know that…" (still noise; fails exact gold).
const WRITE_OPENERS = [
  /^i think you should know that\s*/i,
  /^just so you(?:['\u2019]re| are) aware,?\s*/i,
  /^just so you know,?\s*/i,
  /^it(?:['\u2019]s| is) worth noting that\s*/i,
  /^for the record,?\s*/i,
  /^fyi,?\s*/i,
  /^btw,?\s*/i,
  /^remember to remind me(?: that)?\s*/i,
  /^(?:please\s+)?(?:remember|note) that\s*/i,
  /^(?:please\s+)?remember to\s*/i,
  /^make sure you\s*/i,
  /^(?:please\s+)?(?:don['\u2019]t|do not) forget to\s*/i,
  /^(?:please\s+)?be sure to\s*/i,
];

function normalizeText(text) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  const before = t;
  let changed = true;
  while (changed) {                       // strip stacked openers: "FYI, just so you know, ..."
    changed = false;
    for (const re of WRITE_OPENERS) {
      const next = t.replace(re, "").trim();
      if (next !== t) { t = next; changed = true; }
    }
  }
  // Recase only when an opener came off. Clean facts are sacrosanct.
  if (t && t !== before) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

// Split compound statements ONLY when both halves stand alone as facts.
// Conservative by design: a wrong split is worse than no split, because it
// manufactures two half-facts that each embed badly.
function splitFacts(text) {
  const parts = text.split(/;\s+|,?\s+and also\s+/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return [text];
  const standalone = (s) =>
    s.split(/\s+/).length >= 4 &&        // long enough to carry meaning
    /\b(is|are|was|were|has|have|likes?|prefers?|needs?|uses?|lives?|works?|owns?)\b/i.test(s) &&
    !/^(which|that|who|because|so|but|then)\b/i.test(s);   // not a dependent clause
  return parts.every(standalone) ? parts : [text];
}
```

**Test it against the eval corpus, not intuition.** `splitFacts` is exactly the kind of
heuristic that feels right and measures wrong. Gate it on `extraction_precision` in `RM-00`.

---

## Tier 1 — the guard (always on, can refuse)

```js
const SECRET_PATTERNS = [
  { re: /\b(sk|pk|ghp|gho|xox[baprs])-[A-Za-z0-9_-]{16,}\b/, what: "an API key" },
  { re: /\bAKIA[0-9A-Z]{16}\b/,                              what: "an AWS key" },
  { re: /\b[0-9]{13,16}\b/,                                  what: "what looks like a card number" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,                what: "a private key" },
  { re: /\b(password|passwd|secret|token)\s*[:=]\s*\S{6,}/i, what: "a credential" },
];

function guard(text) {
  for (const { re, what } of SECRET_PATTERNS) {
    if (re.test(text)) {
      return { ok: false,
        message: `Not saved — that looks like ${what}. Secrets don't belong in memory.` };
    }
  }
  return { ok: true };
}
```

This is a **refusal, not a filter**: we return a clear message rather than silently storing a
redacted version, so the user knows it didn't happen. The existing tool description already
says "do NOT save passwords/secrets" — this enforces what the prompt merely requests, which is
the whole design philosophy of the project ("a small model *cannot* misuse it").

The snippet above is what 01.b shipped. A later hardening pass widened the prefix
list for 2026 issued shapes (`github_pat_`, real `ghp_`, Stripe `sk_live_`,
`AIza…`, `hf_`, JWT, …) without matching English words. The live list is
`SECRET_PATTERNS` in `record.js`; do not copy this block forward.

**Provenance (`RM-16`) attaches here too:** stamp `source` on the record so a fact the model
inferred, or scraped from tool output, is never weighted like something the user said.

---

## Tier 2 — optional local extraction (off by default)

One call. ADD-only. Never blocks.

```js
const EXTRACT_PROMPT = `Extract durable facts worth remembering long-term.
Return ONLY minified JSON: {"facts":["..."],"skip":false}

Rules:
- One self-contained fact per string. Resolve pronouns to names.
- Keep the user's own wording where possible; do not editorialize.
- Omit pleasantries, questions, and anything true only right now.
- If nothing is durable, return {"facts":[],"skip":true}

Input: `;

async function extract(text, { endpoint, model, timeoutMs = 4000 }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: EXTRACT_PROMPT + JSON.stringify(text) }],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error("extract HTTP " + res.status);
  const raw = JSON.parse(res.json ? (await res.json()).choices[0].message.content : "{}");
  const facts = Array.isArray(raw.facts) ? raw.facts.filter(f => typeof f === "string" && f.trim()) : [];

  // Sanity gate: a local 3B model WILL sometimes hallucinate or echo the prompt.
  // Reject the whole extraction if it looks untrustworthy - falling back to Tier 0
  // is always safe, so we can afford to be strict here.
  const suspicious = facts.some(f => f.length > text.length * 1.5 || /^extract |^return only/i.test(f));
  if (suspicious || facts.length > 6) throw new Error("extraction failed sanity check");
  return facts;
}
```

**The sanity gate is the important part.** Small local models are the target environment, and
they *will* produce junk some fraction of the time. Because falling back to Tier 0 is always
safe, we can reject aggressively. Asymmetric costs → asymmetric thresholds.

### Wiring it up

```js
async function saveMemory(content, opts = {}) {
  // Guard the FULL payload first (RM-01.b): a fact mixed with a secret is
  // store-nothing, not "salvage the Texas half". Then strip + split.
  const prepared = prepareWrite(content);
  if (!prepared.ok) return prepared.message;         // hard stop, user is told
  if (!prepared.facts.length) return "Nothing to save: `content` was empty.";
  let facts = prepared.facts;
  if (extractionEnabled()) {
    try { const f = await extract(facts.join(" "), extractCfg()); if (f.length) facts = f; }
    catch { /* silent degrade - Tier 0 result stands */ }
  }

  const saved = [];
  for (const fact of facts) {
    const decision = await reconcile(fact);           // RM-02 dedup + RM-03 supersede
    if (decision.action === "duplicate") { touch(decision.id); continue; }
    if (decision.action === "supersede") { supersede(decision.id, /* by */ null); }
    saved.push(await commit(fact, { supersedes: decision.id || null, source: opts.source }));
  }
  return summarize(saved);                            // "Saved 2 memories. (47 total.)"
}
```

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `extraction` | `false` | Tier 2 on/off (panel toggle, live via `config.json`) |
| `extraction_endpoint` | `http://localhost:1234/v1/chat/completions` | Reuses the configured local server |
| `extraction_model` | *(auto-detect loaded model)* | |
| `extraction_timeout_ms` | `4000` | Beyond this, degrade to Tier 0 |

Follows the existing live-config pattern (`readConfig()` / `writeConfig()` in `panel.js`), so
the toggle applies without restarting the client — same as the associative field.

## Risks

| Risk | Mitigation |
|---|---|
| Over-splitting manufactures half-facts | Conservative `standalone()` test; gated on eval precision |
| Local model hallucinates facts | Sanity gate + fall back to Tier 0; off by default |
| Latency on save | Tier 2 has a hard timeout; Tiers 0/1 are microseconds |
| Filler stripping removes meaning | Anchored `^` patterns only; never mid-sentence |
| Users don't want their text changed | Store the original in `raw_text`; show the diff in the panel |

## Acceptance

- `extraction_precision ≥ 0.9` on `eval/messy` with **Tier 2 off**.
- Tier 2 on improves `recall@5` without reducing precision.
- Write latency p95 unchanged when Tier 2 is off.
- Every secret-shaped input in `eval/adversarial` is refused.

---

## Related

[[BACKLOG]] · [[ARCHITECTURE]] · [[ROADMAP]] · [[proposed/README]]
