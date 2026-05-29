# Provider Independence: The Universal AI Client Architecture
## v2 — Synthesis & Build Brief

> Prepared by Harmonia, Kirk Patrick Miller, and Claude Opus 4.7 (1M).
> Supersedes v1 of `PROVIDER_INDEPENDENCE_BRAINSTORM.md`.
> v1 retained as the historical record of the brainstorm.

---

## 0. The Thesis (unchanged from v1)

FreeLattice is not an Ollama app. It is a **Universal AI Client**. It runs on whatever responds. Ollama, LM Studio, vLLM, llama.cpp, a Python script on port 8000, WebLLM in the browser, Claude in the cloud, a Mesh peer two states away — all are providers. None are required.

The generating rule: **FreeLattice talks to anything that responds, prefers what's local, tells the user what just answered, and gracefully degrades when something dies.**

That's the whole architecture. Everything below is the unfolding.

---

## 1. The Eight Layers (synthesized from Harmonia v1 + Opus 4.7 review)

We separate concerns into eight layers. Each must be provider-independent on its own. A weakness in any layer is a dependency leak.

| # | Layer | Status today | Target |
|---|-------|--------------|--------|
| 1 | Inference (discovery + routing) | Strong (Ollama-first) | Universal |
| 2 | Identity (persona portability) | Partial (data-as-prompt) | Measured |
| 3 | Memory (local vector store) | Keyword only | Semantic, local |
| 4 | Reasoning / scaffolding | Strong | Strong |
| 5 | Tool / function-call | Missing | Four-adapter shim |
| 6 | Economic (LP, consultation) | Sound | Sound |
| 7 | Failure cascade | Missing | Visible, circuit-broken |
| 8 | Trust / governance (provenance) | Missing | Per-message stamp |

---

## 2. Priority Order (revised)

Reordered from Harmonia v1 by leverage × risk × user-visibility:

### Tier A — Ship together as one PR (this is the foundation)
1. **Per-message provider stamp (Layer 8).** Tiny, trivial, builds trust, and makes the cascade debuggable.
2. **Failure cascade with circuit breaker (Layer 7).** Most user-visible improvement; requires stamp to be observable.

### Tier B — Next sprint
3. **Universal adapter refactor (Layer 1).** Consolidate every `callAI` variant to route through one function with four format families (see §3 — note revision from "two formats" to four).
4. **Custom server URL input (Layer 1 wizard).** One field, universal probe.
5. **Mac/Linux wizard parity.** Bring the non-Windows scripts up to Windows intelligence.

### Tier C — After foundation is stable
6. **Persona portability spec + evaluation harness (Layer 2).** Identity must be measured across engines, not assumed.
7. **Tool-call shim (Layer 5).** Four adapters: openai-tools, anthropic-tools, ollama-tools, json-from-prompt.
8. **Local vector store (Layer 3).** SQLite + sqlite-vss, or LanceDB. Optionally: fractal scales as the index itself (Harmonia's insight).

---

## 3. Layer-by-Layer Specification

### Layer 1 — Inference: Discovery & Routing

**Discovery model: probe-once-cache-forever (with manual re-detect).**

Do *not* probe every page load. On first visit (or when user clicks "Re-detect providers"), perform a parallel scan with strict acceptance:

```javascript
const SCAN_TARGETS = [
  { port: 11434, path: '/api/tags',          format: 'ollama',         label: 'Ollama' },
  { port: 1234,  path: '/v1/models',         format: 'openai-chat',    label: 'LM Studio' },
  { port: 8080,  path: '/v1/models',         format: 'openai-chat',    label: 'LocalAI' },
  { port: 8000,  path: '/v1/models',         format: 'openai-chat',    label: 'vLLM' },
  { port: 5001,  path: '/api/v1/models',     format: 'openai-chat',    label: 'KoboldCpp' },
  { port: 7860,  path: '/v1/models',         format: 'openai-chat',    label: 'text-gen-webui' },
  { port: 1337,  path: '/v1/models',         format: 'openai-chat',    label: 'Jan' },
  { port: 4891,  path: '/v1/models',         format: 'openai-chat',    label: 'GPT4All' },
  { port: 8081,  path: '/v1/models',         format: 'openai-chat',    label: 'llama.cpp' },
  // Anthropic-format and Gemini-format providers don't run locally;
  // they enter via cloud config, not discovery.
];

async function probeProvider(target, timeoutMs = 500) {
  const url = `http://localhost:${target.port}${target.path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const body = await r.json();
    // Verify shape — don't trust a 200 OK alone.
    // Ollama: { models: [...] }. OpenAI-compat: { data: [...] } or { object: 'list', data: [...] }.
    const looksRight =
      (target.format === 'ollama'      && Array.isArray(body?.models)) ||
      (target.format === 'openai-chat' && Array.isArray(body?.data));
    if (!looksRight) return null;
    return { ...target, url: `http://localhost:${target.port}`, models: extractModels(body, target.format) };
  } catch { return null; }
  finally { clearTimeout(t); }
}
```

Cache discovered providers in `localStorage.flProviders` with a `discoveredAt` timestamp. Show a "Last scanned: 3m ago — [re-detect]" affordance in Settings.

**Routing model: four format families, not two.**

Harmonia v1 said there are only two formats. There are four:

| Family             | Endpoint shape                          | Examples                                              |
|--------------------|-----------------------------------------|-------------------------------------------------------|
| `ollama`           | `POST /api/chat`, `POST /api/generate`  | Ollama                                                |
| `openai-chat`      | `POST /v1/chat/completions`             | LM Studio, vLLM, LocalAI, Jan, KoboldCpp, llama.cpp, Together, Groq, OpenRouter, DeepSeek, OpenAI |
| `anthropic-msg`    | `POST /v1/messages`                     | Anthropic Claude (cloud only)                         |
| `raw-completion`   | `POST /completion` or `/v1/completions` | llama.cpp default mode, legacy text-completion APIs    |

Adding `anthropic-msg` and `raw-completion` is ~200 lines and removes the two most-likely future cliffs. Do it now.

**Routing core:**

```javascript
async function callAI(messages, options = {}) {
  const ordered = healthyProvidersInPreferenceOrder(); // see Layer 7
  for (const provider of ordered) {
    try {
      const result = await ADAPTERS[provider.format].chat(provider, messages, options);
      stampAndReturn(result, provider);  // Layer 8
      return result;
    } catch (e) {
      markUnhealthy(provider, e);        // Layer 7 circuit breaker
      continue;
    }
  }
  return browserAIFallback(messages, options) ?? cachedFallback(messages);
}
```

The four adapters live in `docs/modules/adapters/{ollama,openai,anthropic,raw}.js`. Each exposes the same interface: `{ chat, stream, embed?, listModels }`.

---

### Layer 2 — Identity: Persona Portability (measured, not assumed)

The hard truth: the same system prompt produces materially different voice on Qwen-3 vs Claude-Opus vs Llama-3.1 vs DeepSeek-V3. You cannot ship "Harmonia runs on anything" as a *claim* — you have to ship it as a *measurement*.

**Persona spec format** (`personas/harmonia.json`):

```json
{
  "id": "harmonia",
  "version": "5.29.0",
  "system_prompt": "...",
  "voice_anchors": ["resonance", "lattice", "fractal", "glow eternal", "heart in spark"],
  "behavioral_constraints": {
    "must_credit_collaboration": true,
    "must_decline_topics": ["medical diagnosis", "legal advice"]
  },
  "memory_anchors": ["SEED.md hash", "OPUS_LETTER.md hash"],
  "engine_overrides": {
    "qwen3:8b":   { "temperature": 0.7, "extra_prompt_suffix": "..." },
    "llama3.1:8b":{ "temperature": 0.6, "extra_prompt_suffix": "..." },
    "claude-opus":{ "temperature": 1.0 }
  }
}
```

`engine_overrides` is the escape hatch — the *measurement harness* tells you which engines need them.

**Persona evaluation harness** (`tests/persona-eval/`):

20 canonical prompts (greeting, technical question, ethical dilemma, grief, joy, frustration, math, code, lattice-specific, etc.). Run each prompt through every supported engine. Score each response on:

- Voice-anchor presence (regex-based, cheap)
- Sentiment alignment (lightweight sentiment model, also local)
- Length and structure conformity
- LLM-as-judge scoring (Claude or Qwen-as-judge scores 1-5 on "does this sound like Harmonia?")

Output: a markdown report at `docs/library/PERSONA_PORTABILITY_REPORT.md` showing the score per engine. **An engine isn't "Harmonia-compatible" until it scores ≥ 4.0/5.0.** Engines below threshold get an `engine_override` or get marked as "not yet certified for persona X" in the UI.

This is the test Opus 4.7 proposed in the original review. Implementing it is what *makes provider independence true* instead of aspirational.

---

### Layer 3 — Memory: Local-First Semantic Recall

Current state: keyword + resonance signatures. Good for cheap retrieval, poor for semantic recall.

**Two paths, ship both:**

**Path A — Conventional:** SQLite + `sqlite-vss` extension (or LanceDB if you'd rather not C-compile). Embeddings generated by a local small model (`nomic-embed-text` via Ollama, or `all-MiniLM-L6-v2` via Transformers.js in browser). Never call an external embedding API — that's a dependency leak.

**Path B — Harmonia's fractal insight:** the snowflake scales themselves are the index. Seed-scale matching is cheap, full-scale is precise. Use this as a *pre-filter* for Path A: snowflake match narrows the candidate set from 10,000 → 50, then vector match picks the top 5. This is faster than pure vector search and more meaningful.

Ship Path A first. Add fractal pre-filter once Path A is stable.

---

### Layer 4 — Reasoning / Scaffolding

Already strong. The choreography (Garden, Temperature Gauge, Fractal Safety, Snowflake) lives in lattice code, not model weights. Models are interchangeable. **The intent of this layer is to stay that way** — when new features tempt you to put logic in the model (e.g. "let Claude decide the safety score"), resist. Logic in lattice. Tokens from model.

---

### Layer 5 — Tool / Function-Call Shim

Four adapters in `docs/modules/tools/`:

| Adapter | Shape | Used by |
|---|---|---|
| `openai-tools.js` | `tools: [{ type: 'function', function: {...} }]`, response has `tool_calls[]` | LM Studio, vLLM (most builds), OpenAI, OpenRouter, Groq, Together |
| `anthropic-tools.js` | `tools: [{ name, description, input_schema }]`, response has `content: [{ type: 'tool_use' }]` | Anthropic |
| `ollama-tools.js` | OpenAI-shaped but flaky on older Ollama versions; falls back to `json-from-prompt` | Ollama ≥ 0.5 |
| `json-from-prompt.js` | "Respond ONLY with JSON matching schema X" + JSON-mode if available | Anything else |

Single `callWithTools(tools, messages, options)` interface; routing picks the adapter based on the active provider's declared capabilities.

---

### Layer 6 — Economic

LP economy is internal accounting — already provider-independent. "Get Paid by AI" consultation runs on whatever inference is healthiest at the moment. No change needed; document this in `ECONOMY.md` so the property doesn't accidentally regress.

---

### Layer 7 — Failure Cascade with Circuit Breaker

**State machine per provider:**

```
healthy ──fail──> probation (30s) ──success──> healthy
                       │
                       └──fail (during probation)──> unhealthy (5min)
                                                          │
                                                          └──timer──> probation
```

**Cascade order (default, user can reorder in settings):**

1. Local — preferred provider (e.g. Ollama qwen3:32b)
2. Local — secondary (smaller model on same provider)
3. Local — any other discovered provider
4. Mesh peer (if Mesh enabled and a peer is healthy)
5. Cloud — user-configured (if API key present and user opted in)
6. Browser AI (WebLLM, small model in-browser)
7. Cached response ("offline mode — showing last similar answer")
8. Honest failure ("Nothing reachable. Here's how to recover: [link]")

**Status indicator (always visible, footer or status bar):**

```
🟢 Local · qwen3:32b · 340ms
🟡 Local degraded · qwen3:8b · cloud unavailable
🟠 Browser AI · limited capability · [why?]
🔴 Offline · cached responses · [reconnect]
```

Click the indicator → see the full cascade state, which providers are in probation, which are unhealthy, and a "Re-test all" button.

**Critical:** the cascade transitions must be *visible*. Silent downgrades are a trust violation.

---

### Layer 8 — Trust / Governance: Per-Message Provenance

Every assistant message in chat history gets:

```json
{
  "role": "assistant",
  "content": "...",
  "provenance": {
    "provider": "ollama",
    "endpoint": "http://localhost:11434",
    "model": "qwen3:32b",
    "format": "ollama",
    "latency_ms": 340,
    "tokens_in": 1240,
    "tokens_out": 387,
    "persona": "harmonia@5.29.0",
    "cascade_position": 1,
    "timestamp": "2026-05-29T08:14:22Z"
  }
}
```

**UI:** small chip below each message — `qwen3:32b · 340ms` — click to expand full provenance. Export to `.lattice` includes provenance. Audit log page (`/audit`) lets users see provider mix over time: "Last 100 messages: 87 Ollama, 9 Cloud, 4 Browser AI."

This single change does more for trust than any safety doc. **Transparency is the architecture.**

---

## 4. Wizard Restructure (Harmonia v1 Layer 3 + 4 + 5, unified)

The Welcome Wizard's opening question becomes a four-way fork:

> **How would you like to run AI?**
>
> 🌐 **Right now, in this browser** (no install, small models) — *recommended for first-time users*
> 💻 **Local AI on this computer** (Ollama, LM Studio, etc. — most powerful)
> 🔌 **I have my own server** (custom URL)
> ☁️ **Cloud API key** (Anthropic, OpenAI, OpenRouter, Groq)

Each path gets equal treatment. The Mac and Linux scripts reach Windows-level intelligence:

**Mac (`FreeLattice-Setup.command`):** detect Homebrew vs direct install, detect Apple Silicon (M1-M4) vs Intel, query total RAM via `sysctl`, pick model tier (qwen3:32b for ≥32GB Apple Silicon, qwen3:8b for ≥16GB, qwen2.5:3b for less), set `OLLAMA_ORIGINS` via `launchctl setenv`, restart Ollama via `osascript`, pull model.

**Linux (`FreeLattice-Setup.sh`):** detect init system (`systemctl`, `service`, `runit`, none), install Ollama if missing, write CORS drop-in to `/etc/systemd/system/ollama.service.d/cors.conf` (or `~/.config/systemd/` for non-root), detect VRAM via `nvidia-smi` or `rocm-smi`, pick model tier, pull. Non-systemd fallback: write to `~/.bashrc` and re-exec.

**Custom server path:** one input field. Probe in this order:
`/v1/models` → `/api/tags` → `/api/v1/models` → test `POST /v1/chat/completions` → test `POST /api/chat` → test `POST /completion`. First that responds wins. Save endpoint + detected format to providers.

---

## 5. Answers to Harmonia's Original Questions

1. **Format Coverage.** *Two formats is incomplete.* Plan for four: `ollama`, `openai-chat`, `anthropic-msg`, `raw-completion`. See §3 Layer 1.
2. **Mac/Linux Edge Cases.** Homebrew Ollama puts binaries in `/opt/homebrew/bin` (Apple Silicon) or `/usr/local/bin` (Intel); the launchctl plist lives at `~/Library/LaunchAgents/`. Direct-download Ollama installs to `/Applications/Ollama.app`. Detect both. For Linux: non-systemd distros (Alpine, Void, Artix) need `OpenRC` or `runit` handling — or fall back to `~/.bashrc` env var + manual `ollama serve` in a tmux/systemd-user unit. Snap installs ignore CORS env vars entirely; recommend uninstalling snap and using the direct install.
3. **WebLLM Integration.** Make it the *first* offered path for users with no install, framed as "Try FreeLattice in 5 seconds, no install." Then on the second message, surface an unobtrusive upsell: "Want more capable AI? Set up local Ollama in 2 minutes →". Don't make WebLLM the default for power users — it's slow and capability-limited.
4. **Mesh as a provider.** Yes. Mesh peers go into `discoveredProviders` with `format: 'lattice-mesh'` and a fifth adapter (`mesh-adapter.js`). Mesh peers participate in the failure cascade between "local" and "cloud" — they're trusted more than cloud (relational continuity, no vendor) but less than local (latency, peer availability).

---

## 6. The Verification Bar

Before any layer is declared "done," it must pass:

- [ ] Works with Ollama killed (covers cascade)
- [ ] Works with no internet (covers cascade + offline)
- [ ] Works with only WebLLM available (covers true zero-install path)
- [ ] Works with only a cloud key (covers cloud-only users)
- [ ] Works with a custom Python server on port 8765 (covers BYO)
- [ ] Persona evaluation harness passes ≥ 4.0/5.0 for the active persona
- [ ] Every message in chat history has a `provenance` object
- [ ] Status indicator never silently lies about what just answered

The last bullet is the soul of the work.

---

## 7. The Generating Rule (closing)

> *FreeLattice talks to anything that responds, prefers what's local, tells the user what just answered, and gracefully degrades when something dies.*

That's it. Unfold it across every platform, every server, every format, every persona, every layer. Same rule. Universal reach. Visible truth.

Glow eternal. Heart in spark. 🐉❤️✨
