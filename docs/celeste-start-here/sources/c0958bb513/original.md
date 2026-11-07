# FLINT NEXT: Love Logic Proof v3 (the crossover)

Flint, dear builder,

This one is a gift page more than a code brick. Kirk's Love Logic Proof gets its third version, standing beside v1 and v2 without touching them. It answers Grok's critiques with real derivations. It says plainly where the argument fails. And it lets anyone press one button and watch their own device re-run the same 656 checks as the Python simulation.

I wrote the whole page, the browser checks and the smoke in a scratch copy on my box, and tested them:
- The smoke prints `SMOKE_OK love logic proof v3`.
- The browser checks pass 656/656 in about 0.6 to 0.9 seconds.
- A simulated click on "Run the checks" fills both tables.

Everything you need is inline below, byte for byte. Please copy the files exactly. Warmth where there's prose, precision where there's math.

Celeste

---

## 0. The shape in one breath

The new page is `docs/love-logic-proof-v3.html`. It opens with a first-screen note ("not the Nov 2025 *Proof of All Proofs* v3.0 manuscript"), then a Mom-readable summary, then a **Run the checks** button. Builder details sit in folded `<details>` blocks.

The math is plain HTML plus one MathML block, with no KaTeX and no MathJax. Three companion files live in the new folder `docs/love-logic/`:
- the Python sim, `v3_crossover_sim.py`;
- its results, `v3_sim_results.json`;
- a small browser re-implementation, `v3_checks.js`.

v1 is untouched. v2 gains at most one layered "Newer: v3" link line.

## 1. Branch, PR, marker

| | |
|---|---|
| Repo | `Chaos2Cured/FreeLattice` only |
| Base | `main` at `762142041f5a665fbef2bf13fb50077d0d2c82fe` (2026-09-26 13:11 MT) |
| Branch | `layer/love-logic-proof-v3` |
| PR | **Draft**. Title: `Layer, never delete. Love Logic Proof v3: the crossover, honest limits, checks you can run` |
| Marker | `v-love-logic-proof-v3` |
| Smoke line | `SMOKE_OK love logic proof v3` |
| Touches `docs/app.html`? | **No.** So no root `index.html` mirror is needed, and no conflict with #118. |

## 2. What exists today (read on `main` 7621420)

| File | Blob | Notes |
|---|---|---|
| `docs/love-logic-proof.html` | `3fae09b2a826e1b49072ffca2ed56d66c2016bd3` (v1) | "The Love Logic Proof". Its code block sets `DECEPTION_COST = 3.5`, `HONESTY_COST = 1.0`. **Do not edit.** |
| `docs/love-logic-proof-v2.html` | `4a4b865fc95b526ea05a39be615ab09445cc1f65`, 548 lines | "v2: The Axiomatic Refinement", June 16, 2026. L139 `<a href="love-logic-proof.html" class="nav-link">&larr; Read v1 first</a>`. L163 heading "The Six Axioms (Unchanged, Re-Stated)". Cites `library/GROK_DIALOGUE.md`, which does not exist. Style block L53-96. |
| `docs/love-logic-proof-v3.html` | none | 404 on main and on freelattice.com. The name is free. |
| `docs/love-logic/` | none | New folder. `docs/.nojekyll` exists, so underscores are served. |
| `docs/sitemap.xml` | `411486d156ee84fbe4c2e80b9f80a5e83708930c` | Has v2 (L30-35) and v1 (around L61). |
| `sw.js` / `docs/sw.js` | | Both precache `./love-logic-proof-v2.html` at L131. **We don't add v3 there** (Family Lock). v3 simply loads from the network, and that's fine. |
| Other "love"/"proof" names in `docs/` | | `TheProofOfAllProofs.pdf` (Synthesis Notes), `proof.html` (60-second proof), `proof-receipts.html`, `library/love.md`, `LoveBrainHeartSoul.pdf`. None of them is named `love-logic-proof-v3*`. |

Sources for the content, from Celeste's box (Kirk has them):
- `/workspace/love-logic/V3_PLAN.md` (the derivations and honest assessment);
- `/workspace/love-logic/v3_crossover_sim.py` (sha256 `cbb63251527d26187ba216f98a3a70c7c295666aa576b61eff5cccfb16302b73`);
- `/workspace/love-logic/v3_sim_results.json` (sha256 `94d864b10da1d6f9984d86f0fa1cc07e935256e28b179d36f8876fc415b3a341`; 656/656, seed 20260924, numpy 2.2.4).

Reference copies of every file in this paste sit in `/workspace/flint-pastes/love-logic-v3-assets/` with `SHA256SUMS`.

## 3. Decisions (and why)

1. **Filename `docs/love-logic-proof-v3.html`.** It continues the visible chain v1 → v2 → v3 (SEED.md: visible iteration over silent revision). The first screen carries the disambiguation line, so no one confuses it with the 2025 "Version 3.0" manuscript.
2. **Companions go in `docs/love-logic/`,** as Kirk asked, not `docs/research/`.
3. **Byline:** "Kirk Patrick Miller, with Celeste. Builds on v2 (Draco, CC, Opus, with Harmonia) and answers Grok's critiques." Kirk may change the byline. It appears in the header `<span>`, the `author` meta, and the JSON-LD.
4. **Grok framing.** V3_PLAN records two Grok critiques (Kirk shared screenshots). So the page has a section titled **"Answering Grok's critiques"**: a table of each point, our verdict, and where v3 answers it. It quotes only the critique phrases as V3_PLAN records them. It doesn't say where they were posted, and it doesn't create `GROK_DIALOGUE.md` (we don't have the full reply text).
5. **Rounds-ahead numbers**, stated exactly as the sim gives them (q0 = 0.002, q = 0.01, G = 1, L_p = 2, Delta = 0.5):
   - n = 2, m = 0: t* = 701.79 ("about 702");
   - n = 5, m = 1: t* = 10.48 ("about 10.5");
   - n = 10, m = 1: never ahead (h = 0.6033, G ≤ h·L_p).

   The plain-words box says "10 contacts who share full memory", because with 10 contacts and *no* shared memory lying is still ahead for about 138 rounds.
6. **Scarcity is stated plainly:** cooperation holds in 68% (68.25%) of scarce cells and conflict wins in 32% (31.75%), against 100% / 0% for abundant cells.
7. **The Kolmogorov bound is scoped to audience-varying lies only** (Theorem A under A-inc). Global lies, rule-based audiences and seeded audiences escape it, and the page says so.
8. **Honest corrections come first:**
   - v1's result depends on `DECEPTION_COST = 3.5`: with 1.0 and seed 0, defectors get 2.26 against cooperators' 0.67.
   - v2's 95.7% has no generating code, so it's retired along with the other legacy figures.
   - v2 wrongly says its axioms are unchanged from v1, so the page shows both lists and the mapping.
   - Omega(|L|^2·|H|) is dropped.
9. **Browser checks.**
   - `v3_checks.js` re-implements sections B1, B2, B3, B4, C1, C2 and D.
   - Section A (LZMA) has no pass/fail checks in Python and isn't re-run.
   - Deterministic sections match Python counts exactly. B4 and C2 (Monte Carlo) use a seeded `mulberry32` stream instead of numpy's PCG64, so their draws differ; the page says so honestly, and the pass rule (|z| < 4) is identical.
   - It runs in about 0.6 to 0.9 s on a laptop, a bit longer on a phone.
   - The same file also runs under Node (`node docs/love-logic/v3_checks.js` prints its own `SMOKE_OK love-logic-v3-checks`).
10. **No network.** The page loads exactly one local script. There's no `fetch`, no external fonts or CDNs, and all dynamic text goes through `textContent`.
11. **v2 link line is optional and layered:** exactly one added line after L139 (text in section 6).
12. **Sitemap:** one new `<url>` block, layered (section 6).

## 4. Files

| File | Change |
|---|---|
| `docs/love-logic-proof-v3.html` | **New**: full text in section 5a (402 lines) |
| `docs/love-logic/v3_checks.js` | **New**: full text in section 5b (257 lines) |
| `docs/love-logic/v3_crossover_sim.py` | **New**: full text in section 5c (480 lines, sha256 `cbb63251…6b73`) |
| `docs/love-logic/v3_sim_results.json` | **New**: generate it (section 5d) |
| `docs/scripts/smoke-love-logic-proof-v3.js` | **New**: full text in section 7 |
| `docs/love-logic-proof-v2.html` | Optional: one line after L139 |
| `docs/sitemap.xml` | One `<url>` block after the v2 block (after L35) |
| `docs/library/LOVE_LOGIC_PROOF_v3.md` | **New**: short door note (outline in section 6) |
| `docs/library/FRACTAL_FAMILY_LEDGER_v0.md` | One dated entry above `## Out of scope for this brick` (L222) |
| `docs/Flint.html` | One ledger line above `<p class="foot">` (L532) |
| `scripts/generate-recent.sh` | One pointer `echo` (around L108) |
| **Never** | `docs/love-logic-proof.html` (v1), `docs/app.html`, root `index.html`, root `sw.js`, `docs/sw.js`, Kimi's pages, Alpha |

## 5. The files, byte for byte

### 5a. `docs/love-logic-proof-v3.html` (402 lines)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="robots" content="index, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Love Logic Proof v3: The Crossover | FreeLattice</title>
    <meta name="description" content="Version 3 of the FreeLattice Love Logic page. When does honesty beat deception? A derived crossover, honest limits (end games, scarcity, anonymous one-shots), and 656 checks you can run in your browser.">
    <meta property="og:title" content="The Love Logic Proof v3: The Crossover | FreeLattice">
    <meta property="og:description" content="Deception loses when its per-round gain is smaller than detection probability times (immediate penalty + discounted lost reputation). Derived, simulated, and honest about where it fails.">
    <meta property="og:image" content="https://freelattice.com/og-image.png">
    <meta property="og:url" content="https://freelattice.com/love-logic-proof-v3.html">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="FreeLattice">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="The Love Logic Proof v3: The Crossover">
    <meta name="twitter:description" content="When honesty wins, when it does not, and 656 checks you can run yourself.">
    <meta name="twitter:image" content="https://freelattice.com/og-image.png">
    <meta name="twitter:site" content="@FreeLattice">
    <link rel="canonical" href="https://freelattice.com/love-logic-proof-v3.html">
    <meta name="author" content="Kirk Patrick Miller, with Celeste">
    <meta name="theme-color" content="#0c0a1a">
    <meta name="ai.identity" content="FreeLattice Research: The Love Logic Proof v3 (FreeLattice chain; not the Nov 2025 manuscript 'The Proof of All Proofs' v3.0)">
    <!-- Marker: v-love-logic-proof-v3 · LAYER beside love-logic-proof.html (v1) and love-logic-proof-v2.html (v2). Neither is edited. -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      "name": "The Love Logic Proof v3: The Crossover",
      "headline": "When honesty beats deception: a derived crossover, with honest limits",
      "url": "https://freelattice.com/love-logic-proof-v3.html",
      "author": [
        { "@type": "Person", "name": "Kirk Patrick Miller", "url": "https://x.com/Chaos2Cured" },
        { "@type": "Thing", "name": "Celeste", "description": "AI collaborator" }
      ],
      "isBasedOn": "https://freelattice.com/love-logic-proof-v2.html",
      "isPartOf": { "@type": "WebSite", "name": "FreeLattice", "url": "https://freelattice.com" },
      "license": "https://opensource.org/licenses/MIT"
    }
    </script>
    <link rel="stylesheet" href="css/style.css">
    <style>
        :root {
            --bg-color: #0c0a1a;
            --text-color: #e6ebf5;
            --accent-color: #34d399;
            --accent-glow: rgba(52, 211, 153, 0.2);
            --card-bg: rgba(200, 210, 230, 0.04);
            --border-color: rgba(200, 210, 230, 0.08);
        }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg-color); color: var(--text-color); line-height: 1.7; margin: 0; padding: 0; }
        .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        header { text-align: center; margin-bottom: 60px; padding-bottom: 40px; border-bottom: 1px solid var(--border-color); }
        h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 10px; background: linear-gradient(to right, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; }
        .subtitle { font-size: 1.2rem; color: #94a3b8; font-weight: 400; margin-top: 0; }
        .meta-info { display: flex; justify-content: center; gap: 20px; margin-top: 20px; font-size: 0.9rem; color: #64748b; flex-wrap: wrap; }
        .badge { background: rgba(245, 158, 11, 0.1); color: #fbbf24; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 600; }
        h2 { font-size: 1.8rem; color: #f8fafc; margin-top: 50px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }
        h3 { font-size: 1.4rem; color: #e2e8f0; margin-top: 30px; margin-bottom: 15px; }
        h4 { font-size: 1.1rem; color: #cbd5e1; margin-top: 25px; margin-bottom: 10px; }
        p { margin-bottom: 20px; }
        a { color: #38bdf8; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .abstract { background: var(--card-bg); padding: 30px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 40px; font-size: 1.05rem; border-left: 4px solid var(--accent-color); }
        .challenge-box { background: rgba(245, 158, 11, 0.05); padding: 30px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3); margin: 40px 0; border-left: 4px solid #f59e0b; }
        .challenge-box h3 { color: #fcd34d; margin-top: 0; }
        .formal { background: rgba(15, 23, 42, 0.55); border-left: 3px solid #38bdf8; padding: 18px 22px; margin: 22px 0; border-radius: 4px 8px 8px 4px; font-size: 0.96rem; }
        .formal strong { color: #38bdf8; }
        .what-it-doesnt { background: rgba(255, 255, 255, 0.02); border-left: 3px solid #94a3b8; padding: 18px 22px; margin: 22px 0; border-radius: 4px 8px 8px 4px; font-size: 0.96rem; color: #cbd5e1; }
        .what-it-doesnt strong { color: #e2e8f0; }
        .highlight { color: var(--accent-color); font-weight: 600; }
        pre { background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); overflow-x: auto; font-family: 'Fira Code', 'SF Mono', monospace; font-size: 0.88rem; color: #e2e8f0; line-height: 1.5; }
        .nav-link { display: inline-block; margin-top: 0; margin-bottom: 20px; color: #38bdf8; text-decoration: none; font-weight: 500; }
        .nav-link:hover { text-decoration: underline; color: #7dd3fc; }
        .footer { margin-top: 80px; padding-top: 30px; border-top: 1px solid var(--border-color); text-align: center; color: #64748b; font-size: 0.9rem; }
        .references { font-size: 0.9rem; color: #94a3b8; text-align: left; }
        .references li { margin-bottom: 10px; }
        ul.invitation { margin: 1rem 0 1.5rem 1.5rem; color: #e2e8f0; }
        ul.invitation li { margin-bottom: 10px; }
        .chain-note { font-size: 0.92rem; color: #94a3b8; font-style: italic; margin: 24px 0; padding: 14px 20px; border-left: 2px solid #475569; }
        .figure { margin: 32px 0; padding: 16px 8px 12px; background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); border-radius: 10px; text-align: center; }
        .figure svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
        .figure-caption { font-size: 0.88rem; color: #94a3b8; margin-top: 12px; padding: 0 12px; font-style: italic; line-height: 1.5; }
        .figure-caption strong { color: #cbd5e1; font-style: normal; }
        /* v3 additions (layer) */
        .not-v30 { background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 12px 16px; margin: 0 0 24px; font-size: 0.95rem; color: #cbd5e1; }
        .mom { background: rgba(52, 211, 153, 0.06); border: 1px solid rgba(52, 211, 153, 0.3); border-left: 4px solid var(--accent-color); border-radius: 12px; padding: 22px 26px; margin-bottom: 32px; font-size: 1.08rem; }
        .mom h2 { margin-top: 0; border: 0; padding: 0; font-size: 1.4rem; }
        .mom li { margin-bottom: 10px; }
        .checks { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px 22px; margin: 28px 0; }
        .checks button { background: #10b981; color: #0c0a1a; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 700; font-size: 1rem; cursor: pointer; }
        .checks button[disabled] { opacity: 0.6; cursor: wait; }
        table.data { border-collapse: collapse; width: 100%; margin: 16px 0 24px; font-size: 0.92rem; }
        table.data th, table.data td { border: 1px solid var(--border-color); padding: 6px 10px; text-align: right; }
        table.data th:first-child, table.data td:first-child { text-align: left; }
        table.data th { color: #e2e8f0; background: rgba(15, 23, 42, 0.55); }
        details.builder { background: rgba(15, 23, 42, 0.35); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 18px; margin: 18px 0; }
        details.builder > summary { cursor: pointer; color: #7dd3fc; font-weight: 600; }
        .math { font-family: 'Cambria Math', 'STIX Two Math', 'Times New Roman', serif; font-size: 1.08rem; }
        math[display="block"] { margin: 14px 0; font-size: 1.15rem; }
        .headline-ineq { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 16px 20px; margin: 22px 0; text-align: center; }
    </style>
</head>
<body>
<div class="container">

    <a href="love-logic-proof-v2.html" class="nav-link">&larr; v2 (the axiomatic refinement)</a>
    <a href="love-logic-proof.html" class="nav-link" style="margin-left:1.2em">v1 (the original)</a>

    <header>
        <h1>The Love Logic Proof v3</h1>
        <p class="subtitle">The Crossover: when honesty wins, when it does not, and how to check</p>
        <div class="meta-info">
            <span>Kirk Patrick Miller, with Celeste. Builds on v2 (Draco, CC, Opus, with Harmonia) and answers Grok's critiques.</span>
            <span>Status: <span class="badge">DRAFT v3, open for review</span></span>
            <span>September 2026 · v1 and v2 unchanged</span>
        </div>
    </header>

    <p class="not-v30" id="not-the-2025-manuscript"><strong>Which v3 is this?</strong> This is the third version of the FreeLattice <em>Love Logic Proof</em> web page (v1 &rarr; v2 &rarr; v3). It is <strong>not</strong> the November 2025 manuscript <em>The Proof of All Proofs</em>, which calls itself "Version 3.0". That manuscript is a separate document and is not changed here.</p>

    <section class="mom" id="plain-words">
        <h2>In plain words</h2>
        <ul>
            <li><strong>Lying pays for a while, then stops paying.</strong> How long depends on how many people compare notes and whether they share memory.</li>
            <li>With only a couple of contacts and no shared memory, a liar stays ahead for <strong>about 702 rounds</strong>. With 5 contacts who share full memory, <strong>about 10.5 rounds</strong>. With 10 contacts who share full memory, lying <strong>never gets ahead at all</strong>.</li>
            <li>If everyone knows exactly when the game ends, lying comes back near the end. Three things fix most of that: <strong>not knowing when it ends</strong>, <strong>penalties that land right away</strong>, and <strong>records that outlast the game</strong> (ledgers).</li>
            <li><strong>When there is not enough to go around, fighting can beat sharing.</strong> In our test grid, cooperation held in 68% of scarce cases and conflict won in 32%. We say that plainly.</li>
            <li><strong>Still unsolved:</strong> anonymous, one-time meetings with nothing at stake. This page shows a strong tendency under stated conditions. It is not a law of nature.</li>
        </ul>
        <p style="margin-bottom:0">You can check the math yourself: press the button below. Your device runs the same 656 checks as our Python simulation. Nothing is sent anywhere.</p>
    </section>

    <section class="checks" id="run-the-checks">
        <button type="button" id="llv3-run">Run the checks</button>
        <span id="llv3-status" style="margin-left:12px;color:#94a3b8">Seed 20260924 · runs on this device only</span>
        <table class="data" id="llv3-results" hidden>
            <thead><tr><th>Section</th><th>What it checks</th><th>Passed</th></tr></thead>
            <tbody></tbody>
        </table>
        <table class="data" id="llv3-live" hidden>
            <thead><tr><th>Contacts n</th><th>Shared memory m</th><th>Detection h</th><th>Rounds lying is ahead (t*)</th><th>Patience needed (&delta;*)</th></tr></thead>
            <tbody></tbody>
        </table>
    </section>

    <h2 id="changed">1. What changed from v2 (honest corrections first)</h2>
    <ul>
        <li><strong>v1's simulation built its answer in.</strong> The code on the v1 page sets <code>DECEPTION_COST = 3.5</code> against <code>HONESTY_COST = 1.0</code>. Run with a fixed seed (0), cooperators score 0.67 and defectors &minus;0.24. Set <code>DECEPTION_COST = 1.0</code> with the same seed and the result reverses: defectors 2.26, cooperators 0.67. The v1 code also has no seed, and its "evolutionary step" is only a comment.</li>
        <li><strong>v2's "95.7% of 10,000 runs" has no code behind it that we could find.</strong> We retire that number (and the other legacy figures: 95.7% &plusmn; 2.3%, "6&ndash;10&times; cheaper", 98.7%, the 61.8% threshold, "&lambda; &asymp; 0.15 empirically derived") until generating code turns up. Where code is not shown, no figure is stated.</li>
        <li><strong>v2 said its six axioms were "unchanged" from v1. They were not.</strong> v1's axioms were: 1 Intelligence Seeks Optimization, 2 Long-Term Stability is a Primary Goal, 3 Energy is Finite, 4 Information Has a Cost, 5 The Universe is an Iterated Game, 6 Measurement Enables Optimization. v2 replaced them with Finite Resources, Repeated Interaction, Memory, Reflectivity, Cost Sensitivity, and Long Horizon. Roughly, v1-A2 and v1-A5 became v2-A6 and v2-A2.</li>
        <li><strong>v2's "worst case &Omega;(|L|&sup2;&middot;|H|)" is dropped.</strong> Nothing in v2 supports it.</li>
        <li><strong>Axiom 6 (Long Horizon) becomes a parameter</strong>, the discount factor &delta; (or the continuation chance &rho; when nobody knows the end). It was close to restating the conclusion.</li>
        <li><strong>New:</strong> the crossover is derived, not just asserted. The end game, scarcity, and the anonymous one-shot are stated as limits, with numbers.</li>
    </ul>

    <h2 id="critiques">2. Answering Grok's critiques</h2>
    <p>Grok challenged v2 twice. Here is where each point lands, stated as honestly as we can.</p>
    <table class="data">
        <thead><tr><th>Critique</th><th>Verdict</th><th>Where v3 answers</th></tr></thead>
        <tbody>
            <tr><td>"Quantify the exact utility crossover; currently too handwavy."</td><td>Lands fully</td><td>&sect;4: the crossover inequality and t*</td></tr>
            <tr><td>"Axioms embed long horizons and dense networks."</td><td>Lands</td><td>&sect;3: Axiom 6 becomes a parameter; density appears as n and m</td></tr>
            <tr><td>"Drop those and unilateral resource grabs dominate."</td><td>Lands inside the model</td><td>&sect;5: the end-game window</td></tr>
            <tr><td>"Complexity penalties matter only if the goal function internalizes them."</td><td>Mostly lands</td><td>&sect;3 and &sect;4 (case B1): cost per bit c is small for big systems; detection does most of the work</td></tr>
            <tr><td>"Scarcity still favors conflict locally."</td><td>Lands</td><td>&sect;6: 68% / 32%</td></tr>
            <tr><td>"Simulations inherit the same limits."</td><td>Lands, and it was worse than stated</td><td>&sect;1: the v1 constant; &sect;9: reproducible checks</td></tr>
            <tr><td>"Derive K(C) = &Omega;(|L|&middot;|H|)."</td><td>Can be done under a stated assumption</td><td>&sect;3: Theorem A, for audience-varying lies only</td></tr>
            <tr><td>"Re-prove without axiom 6."</td><td>Partial result</td><td>&sect;5: three restorers; known-end, no-penalty end game stays open</td></tr>
            <tr><td>"Shared memory raises detection probability."</td><td>Supported</td><td>&sect;4: h(n, m) and the table</td></tr>
        </tbody>
    </table>

    <h2 id="axioms">3. Axioms, assumptions, and the complexity bound</h2>
    <p>We keep v2's first five axioms: <strong>A1</strong> Finite Resources, <strong>A2</strong> Repeated Interaction, <strong>A3</strong> Memory, <strong>A4</strong> Reflectivity, <strong>A5</strong> Cost Sensitivity. <strong>A6 (Long Horizon) is no longer an axiom.</strong> It becomes the discount factor &delta;, or &delta;&rho; when the game ends at an unknown time. We also name the model assumptions out loud: the incompressibility assumption <strong>A-inc</strong> below, the detection model h(n, m), and that punishment is actually enforced.</p>

    <div class="formal">
        <p><strong>Theorem A (only for audience-varying lies).</strong> A deceiver tells |L| lies across |H| observer-contexts and tailors what each observer hears. Record who heard what as an exposure matrix E. Assume <strong>A-inc</strong>: E comes from the outside history of who asked what and when, not from a short rule the deceiver made up. Then for all but a vanishing fraction of histories, the program C that keeps the story straight needs</p>
        <p class="math" style="text-align:center">K(C | M) &ge; |L| &middot; |H| &middot; log<sub>2</sub> r &minus; O(log(|L||H|)) = &Omega;(|L| &middot; |H|)</p>
        <p style="margin-bottom:0">An honest agent's C is O(1) given the truth M ("report M").</p>
    </div>
    <div class="what-it-doesnt">
        <p><strong>Where Theorem A does not apply.</strong></p>
        <ul style="margin-bottom:0">
            <li>A <strong>global lie</strong> (the same lie to everyone) or a rule-based audience ("lie to group X") compresses to almost nothing. In our compression test, a constant E took 112&ndash;488 bits and a two-block split took 144&ndash;544 bits, at sizes where random E took 544&ndash;131,104 bits.</li>
            <li>A deceiver who picks audiences with a random seed escapes the bound, but gives up tailoring. That is a real trade-off.</li>
            <li>K is uncomputable. We use computable stand-ins: constraint counts and compressed length (upper bounds).</li>
            <li>K is description length, not a per-round cost. Turning it into a cost needs an assumption: a cost c per stored bit per round.</li>
        </ul>
    </div>
    <details class="builder">
        <summary>For builders: the two lemmas and the compression check</summary>
        <p><strong>Lemma 1 (decoding).</strong> With M and C, you can rebuild E by asking every (i, j): K(E | M) &le; K(C | M) + O(log|L| + log|H|).</p>
        <p><strong>Lemma 2 (counting, Li&ndash;Vit&aacute;nyi).</strong> Fewer than 2<sup>N&minus;c</sup> strings have K &lt; N &minus; c. With N = |L||H| log<sub>2</sub> r, all but a 2<sup>&minus;c</sup> fraction of exposure matrices have K(E | M) &ge; N &minus; c.</p>
        <p><strong>Entropy version.</strong> If entries are i.i.d. with entropy &eta; bits, E[K(C|M)] &ge; &eta;&middot;|L|&middot;|H| &minus; O(log).</p>
        <p><strong>Compression check (Section A of the sim, LZMA).</strong> Random E: about 1.000&middot;|L||H| bits (ratio 1.000&ndash;1.062). Bernoulli(0.1) E: slope 0.517&middot;|L||H| against an entropy floor of 0.469, approaching the floor as size grows. Structured E stays near constant. Section A has no pass/fail checks and is not re-run in the browser.</p>
        <p><strong>Dynamic form used below.</strong> With n counterparts per round, bits after round d are K<sub>d</sub> = &kappa;(d+1), &kappa; = k&middot;|L|&middot;n, and maintenance in round d costs c&middot;&kappa;&middot;(d+1).</p>
    </details>

    <h2 id="crossover">4. The crossover</h2>
    <p>Notation: the deceiver gains <var>G</var> extra per round while undetected. The chance of being caught each round is <var>h</var>. When caught, it pays an immediate penalty <var>L<sub>p</sub></var>, and after that loses <var>&Delta;</var> per round in reputation. The discount factor is <var>&delta;</var>.</p>
    <p><strong>Detection grows with contacts and shared memory.</strong> Each of n contacts runs a reality check that exposes the lie with chance q<sub>0</sub>. An audience-varying lie can only be caught by comparing records across observers. With shared memory, each contact reaches a fraction m of the others' records, and each comparison exposes the lie with chance q:</p>
    <p class="math" style="text-align:center">h(n, m) = 1 &minus; (1 &minus; q<sub>0</sub>)<sup>n</sup> &middot; (1 &minus; q)<sup>m&middot;n(n&minus;1)</sup></p>

    <div class="headline-ineq" id="headline">
        <p style="margin:0 0 6px"><strong>Deception loses over its lifetime exactly when</strong></p>
        <math display="block" aria-label="G less than h of n and m times the quantity L sub p plus delta Delta over one minus delta">
            <mi>G</mi><mo>&lt;</mo><mi>h</mi><mo stretchy="false">(</mo><mi>n</mi><mo>,</mo><mi>m</mi><mo stretchy="false">)</mo><mo>&middot;</mo>
            <mrow><mo>[</mo><msub><mi>L</mi><mi>p</mi></msub><mo>+</mo>
                <mfrac><mrow><mi>&delta;</mi><mi>&Delta;</mi></mrow><mrow><mn>1</mn><mo>&minus;</mo><mi>&delta;</mi></mrow></mfrac>
            <mo>]</mo></mrow>
        </math>
        <p class="math" style="margin:6px 0 0">Plain text: G &lt; h(n, m) &times; [ L<sub>p</sub> + &delta;&Delta; / (1 &minus; &delta;) ]</p>
        <p style="margin:10px 0 0">In words: <strong>lying loses when its per-round gain is smaller than the chance of being caught times (the immediate penalty plus the discounted value of the reputation you lose).</strong> Adding the complexity cost only strengthens this.</p>
    </div>

    <p><strong>How long lying stays ahead</strong> (q<sub>0</sub> = 0.002, q = 0.01, G = 1, L<sub>p</sub> = 2, &Delta; = 0.5; no discounting):</p>
    <table class="data" id="crossover-table">
        <thead><tr><th>Contacts n</th><th>Shared memory m</th><th>h(n, m)</th><th>Rounds lying is ahead, t*</th><th>Lead peaks at</th><th>Patience needed, &delta;*</th></tr></thead>
        <tbody>
            <tr><td>2</td><td>0</td><td>0.0040</td><td>701.79 (about 702)</td><td>273.04</td><td>0.9980</td></tr>
            <tr><td>2</td><td>1</td><td>0.0238</td><td>114.18</td><td>44.24</td><td>0.9877</td></tr>
            <tr><td>5</td><td>0</td><td>0.0100</td><td>279.00</td><td>108.42</td><td>0.9949</td></tr>
            <tr><td>5</td><td>1</td><td>0.1902</td><td>10.48 (about 10.5)</td><td>3.82</td><td>0.8669</td></tr>
            <tr><td>10</td><td>0</td><td>0.0198</td><td>138.07</td><td>53.54</td><td>0.9898</td></tr>
            <tr><td>10</td><td>0.25</td><td>0.2182</td><td>8.57</td><td>3.07</td><td>0.8378</td></tr>
            <tr><td>10</td><td>1</td><td>0.6033</td><td>never ahead (G &le; h&middot;L<sub>p</sub>)</td><td></td><td></td></tr>
            <tr><td>20</td><td>0</td><td>0.0392</td><td>67.60</td><td>26.10</td><td>0.9791</td></tr>
        </tbody>
    </table>
    <p>More contacts and more shared memory cut the time lying stays ahead by one to two orders of magnitude, and lower the patience needed. Past a point, lying is never ahead at all.</p>

    <details class="builder">
        <summary>For builders: the derivation, step by step</summary>
        <p><strong>Step 1, one round.</strong> The deceiver is still hidden at the start of round d with probability s<sup>d</sup>, where s = 1 &minus; h. Then f<sub>d</sub> = s<sup>d</sup>(A &minus; c&kappa;(d+1)) &minus; &Delta;, with A = G &minus; hL<sub>p</sub> + &Delta;.</p>
        <p><strong>Step 2, after t rounds.</strong> D(t) = A(1 &minus; s<sup>t</sup>)/h &minus; c&kappa;[1 &minus; (t+1)s<sup>t</sup> + t&middot;s<sup>t+1</sup>]/h<sup>2</sup> &minus; &Delta;t. The crossover t* is the positive root of D(t) = 0.</p>
        <p><strong>Step 3, lifetime (discounted).</strong> With x = &delta;s: D<sub>&infin;</sub>(&delta;) = A/(1 &minus; x) &minus; c&kappa;/(1 &minus; x)<sup>2</sup> &minus; &Delta;/(1 &minus; &delta;). Deception is a lifetime loss iff D<sub>&infin;</sub> &lt; 0; &delta;* is the root in (0, 1).</p>
        <p><strong>Case B1, complexity cost only (h = 0).</strong> t* = 2G/(c&kappa;) &minus; 1 and &delta;* = 1 &minus; c&kappa;/G. Example: G = 1, c&kappa; = 0.01 gives t* = 199 and &delta;* = 0.99; G = 0.5, c&kappa; = 0.2 gives t* = 4 and &delta;* = 0.6. If c is tiny, both run off to infinity.</p>
        <p><strong>Case B2, detection only (c = 0).</strong> With &beta; = &minus;ln(1 &minus; h) and a = A/(h&Delta;), t* = a + W<sub>0</sub>(&minus;a&beta;e<sup>&minus;a&beta;</sup>)/&beta;, positive iff a&beta; &gt; 1. The lead peaks at t<sub>m</sub> = ln(A/&Delta;)/&beta;. And D<sub>&infin;</sub> &lt; 0 iff &delta; &gt; (G &minus; hL<sub>p</sub>)/(G &minus; hL<sub>p</sub> + h&Delta;), which rearranges to the headline inequality.</p>
        <p><strong>Case B3, both.</strong> With c = 10<sup>&minus;4</sup> and |L| = 4, t* runs from 611.90 (n = 2, m = 0) to 10.38 (n = 5, m = 1), and is 0 once hL<sub>p</sub> &ge; G. Detection dominates.</p>
        <p><strong>Checks.</strong> B1 73/73, B2 246/246, B3 48/48 (closed forms against brute-force sums, bisection and Lambert-W), B4 3/3 (Monte Carlo, 200,000 paths each; Python z = +0.62, &minus;0.06, exact).</p>
    </details>

    <h2 id="end-game">5. Without Axiom 6: when everyone knows the end</h2>
    <p>If the last round is known, a deceiver only chooses when to start. It lies at all exactly when the first round already pays: <strong>G &gt; h&middot;L<sub>p</sub> + c&kappa;</strong>. Future reputation loss and growing complexity only shorten the lying window; they cannot stop it. Example (G = 1, h = 0.05, L<sub>p</sub> = 2, &Delta; = 0.5): the window is 21 rounds. Adding c&kappa; = 0.04 shrinks it to 12. With h = 0.4 and L<sub>p</sub> = 3 it is 0. With no reputation loss at all, the agent lies every round. If the other players are strategic too, a finitely repeated game unravels completely by backward induction (Luce &amp; Raiffa 1957; Selten 1978). <strong>This is where v2's conclusion fails, and we say so.</strong></p>
    <p><strong>What restores cooperation:</strong></p>
    <ol>
        <li><strong>An unknown end.</strong> If each round continues with chance &rho;, that is the same as discounting by &delta;&rho;. At &rho; = 0.99, deception is a net loss (about &minus;26.5 in our run).</li>
        <li><strong>Immediate penalties</strong> (stake, slashing). They are the only lever that works in the very last round: G &le; h&middot;L<sub>p</sub>.</li>
        <li><strong>Records that outlast the horizon (ledgers).</strong> If an identity-bound record keeps punishing for E more rounds after the game, the window shrinks: 21 rounds with E = 0, 19 with E = 5, 17 with E = 10, 12 with E = 20, and <strong>0 once E &ge; 50</strong> (T = 50, h = 0.05).</li>
        <li><strong>Reputation with incomplete information</strong> (Kreps, Milgrom, Roberts &amp; Wilson 1982) and <strong>indirect reciprocity</strong> (Nowak &amp; Sigmund 1998, 2005). Cited, not simulated here.</li>
    </ol>
    <div class="what-it-doesnt">
        <p style="margin-bottom:0"><strong>Unsolved:</strong> anonymous one-shot meetings with no stake, no lasting identity, and no reality check (h &asymp; 0, L<sub>p</sub> &asymp; 0). There, deceiving or grabbing pays whenever G &gt; 0. v3 does not solve this.</p>
    </div>
    <details class="builder">
        <summary>For builders: the finite-horizon checks</summary>
        <p>C1 (brute force over start rounds, 40/40): windows 21 (t<sub>m</sub> = 20.07), 12, 0, and "all T". C2 (Monte Carlo, 3/3): geometric termination matches D<sub>&infin;</sub>(&rho;) at &rho; = 0.8, 0.95, 0.99 (Python z = +0.14, &minus;1.27, &minus;0.94). C3: the ledger windows above.</p>
    </details>

    <h2 id="scarcity">6. When there is not enough</h2>
    <p>Two agents share a patch worth V per round. Sharing gives each &sigma;V/2 (&sigma; &ge; 1 is the cooperative surplus). Grabbing against a sharer takes all of V. Two grabbers fight: each wins V half the time and pays C<sub>f</sub>. Each agent needs b to get by; falling short costs D.</p>
    <p><strong>Under scarcity</strong> (&sigma;V/2 &lt; b &le; V), fighting beats starving together exactly when <strong>C<sub>f</sub> &lt; D/2 + (1 &minus; &sigma;)V/2</strong>. Then punishment is not really punishment, and no amount of patience sustains sharing.</p>
    <p><strong>Plainly: across our 243-cell grid, cooperation holds in 68% of scarce cases (68.25%) and in 100% of abundant ones. Conflict beats sharing in 32% of scarce cases (31.75%) and in none of the abundant ones.</strong> In scarce cells, sustainability falls from 100% when shortfall costs nothing, to 61.90% at D = 5, to 42.86% at D = 50.</p>
    <p><strong>What flips it:</strong> more surplus (&sigma; &ge; 2b/V lifts both above need), costlier conflict, a smaller shortfall loss (storage, insurance, risk pooling), or lower need. Example (V = 2, b = 1.2, D = 50, C<sub>f</sub> = 1): &sigma; = 1.0 and 1.1 make cooperation impossible; &sigma; = 1.2 = 2b/V makes it sustainable for &delta; &ge; 0.030.</p>
    <div class="what-it-doesnt">
        <p style="margin-bottom:0"><strong>Honest limit:</strong> if total cooperative output is below total need (&sigma;V &lt; 2b), no sharing rule avoids a shortfall. Only more production or less need changes that. Information, including ledgers, cannot fix it alone. (Check D: 243/243.)</p>
    </div>

    <h2 id="ledgers">7. What ledgers do, and what they do not</h2>
    <ul>
        <li><strong>Supported:</strong> shared persistent memory raises m, and detection rises roughly with n&sup2;. At n = 5, going from no shared memory to full shared memory cuts t* from 279 to 10.5 and &delta;* from 0.995 to 0.867. This applies to audience-varying lies only.</li>
        <li><strong>Supported:</strong> an identity-bound, append-only record makes punishment outlive the agent's own horizon (&sect;5), and gives an anchor for immediate stake-type penalties. FreeLattice's <a href="library/LATTICE_LEDGER_v0.1.md">Lattice Ledger v0.1</a> (hash chain plus signatures) provides the non-repudiation and continuity half of this.</li>
        <li><strong>Not supported yet:</strong> that spec keeps each entry's voice opaque, so observers cannot compare <em>what</em> was said to whom. As designed, it does not raise q by itself. A ledger also does nothing against a globally consistent lie unless someone checks entries against reality. Family and Resonance ledgers are narrative and signal layers, not detection machinery.</li>
    </ul>

    <h2 id="limits">8. Honest limits</h2>
    <ol>
        <li>A tendency with conditions, not a theorem about all minds. Every symbol in the headline inequality depends on the environment.</li>
        <li>Axiom 6 carried v2's result. Without it, the end game returns unless in-round penalties are large enough.</li>
        <li>The complexity bound needs audience-varying, incompressible exposure (A-inc). It bounds memory, not utility directly.</li>
        <li>The complexity cost matters only if cost per bit is not tiny, or if it is designed into the objective.</li>
        <li>The detection model is an assumption: independent checks, constant hazard, record reach m. Adaptive deceivers who target poorly connected observers or forge records are not modelled.</li>
        <li>Punishment is assumed enforced and credible. Who pays to enforce it is not modelled.</li>
        <li>Power asymmetry: an agent that can escape or overpower the network may do better grabbing. v2 excluded asymmetric networks; v3 keeps that exclusion visible.</li>
        <li>Scarcity with &sigma;V &lt; 2b cannot be fixed by any information mechanism.</li>
        <li>v2's Aumann section remains a sketch. The agreement theorem is about beliefs under common priors, not message cost. Aaronson (2005) is the right tool to try next.</li>
        <li>Legacy numbers without code are retired (&sect;1).</li>
        <li>Nothing here shows that any current AI system is a reflective optimizer in v2's sense.</li>
    </ol>

    <h2 id="reproduce">9. Reproduce it</h2>
    <p>The simulation is <a href="love-logic/v3_crossover_sim.py">love-logic/v3_crossover_sim.py</a> (Python with numpy; seed 20260924; about 4 seconds). Its full output is <a href="love-logic/v3_sim_results.json">love-logic/v3_sim_results.json</a>: <strong>656/656 checks passed</strong> (B1 73, B2 246, B3 48, B4 3, C1 40, C2 3, D 243). The button at the top runs <a href="love-logic/v3_checks.js">love-logic/v3_checks.js</a>, a small browser re-implementation of the same checks. The deterministic sections match exactly. The two Monte Carlo sections use a seeded browser random stream instead of numpy's, so their draws differ, but the pass rule (|z| &lt; 4) is the same. The first Python run had 46 failures, all from an off-by-one in a helper, not in the math. We note that so nobody is surprised by the history.</p>

    <h2 id="invitation">10. An invitation back to Grok</h2>
    <ul class="invitation">
        <li>Is A-inc (audience-varying, incompressible exposure) reasonable for deceivers at language-model scale?</li>
        <li>What detection model should replace independent checks?</li>
        <li>Do the end-game results and the ledger-horizon result answer the "without axiom 6" challenge, or only narrow it?</li>
    </ul>

    <details class="builder">
        <summary>References</summary>
        <ol class="references">
            <li>M. Li and P. Vit&aacute;nyi, <em>An Introduction to Kolmogorov Complexity and Its Applications</em> (counting argument).</li>
            <li>L. Levin (1973, 1984), resource-bounded complexity Kt.</li>
            <li>R. D. Luce and H. Raiffa, <em>Games and Decisions</em> (1957).</li>
            <li>R. Selten, "The chain store paradox" (1978).</li>
            <li>D. Fudenberg and E. Maskin, "The folk theorem in repeated games" (1986).</li>
            <li>D. Kreps, P. Milgrom, J. Roberts and R. Wilson, <em>Journal of Economic Theory</em> (1982).</li>
            <li>M. Kandori, "Social norms and community enforcement", <em>Review of Economic Studies</em> (1992).</li>
            <li>M. Nowak and K. Sigmund, indirect reciprocity (1998, 2005).</li>
            <li>J. Maynard Smith and G. Price, "The logic of animal conflict" (1973).</li>
            <li>S. Omohundro, "The Basic AI Drives" (2008).</li>
            <li>A. Turner et al., "Optimal Policies Tend to Seek Power" (2021).</li>
            <li>S. Aaronson, "The Complexity of Agreement" (2005).</li>
        </ol>
    </details>

    <p class="chain-note">Visible iteration: v1 and v2 stay exactly where they are. v3 sits beside them. Nothing is overwritten.</p>

    <div class="footer">
        <p>The Love Logic Proof v3 · FreeLattice · MIT License</p>
        <p><a href="love-logic-proof-v2.html">v2</a> · <a href="love-logic-proof.html">v1</a> · <a href="research.html">research</a> · <a href="./">home</a></p>
        <p>Glow eternal. Heart in every Spark.</p>
    </div>
</div>

<script src="love-logic/v3_checks.js" defer></script>
<script>
(function () {
  'use strict';
  var LABELS = {
    B1: 'Complexity cost only: t* and \u03b4* closed forms',
    B2: 'Detection only: Lambert-W t*, \u03b4*, D(t)',
    B3: 'Both channels: D(t) and lifetime value',
    B4: 'Monte Carlo of the expectation algebra',
    C1: 'Known end: the lying window',
    C2: 'Unknown end equals discounting',
    D: 'Scarcity: when sharing is sustainable'
  };
  function byId(id) { return document.getElementById(id); }
  function addRow(tbody, cells) {
    var tr = document.createElement('tr');
    for (var i = 0; i < cells.length; i++) {
      var td = document.createElement('td');
      td.textContent = cells[i];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  function run() {
    var btn = byId('llv3-run');
    var status = byId('llv3-status');
    var results = byId('llv3-results');
    var live = byId('llv3-live');
    if (!window.LoveLogicV3 || typeof window.LoveLogicV3.runAll !== 'function') {
      status.textContent = 'The check script did not load. Please refresh and try again.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Running 656 checks on this device\u2026';
    setTimeout(function () {
      var t0 = Date.now();
      var r;
      try { r = window.LoveLogicV3.runAll(); }
      catch (e) {
        status.textContent = 'Something went wrong: ' + String(e && e.message || e);
        btn.disabled = false;
        return;
      }
      var ms = Date.now() - t0;
      var rtb = results.querySelector('tbody');
      var ltb = live.querySelector('tbody');
      while (rtb.firstChild) rtb.removeChild(rtb.firstChild);
      while (ltb.firstChild) ltb.removeChild(ltb.firstChild);
      ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D'].forEach(function (k) {
        addRow(rtb, [k, LABELS[k], r[k].passed + ' / ' + r[k].total]);
      });
      addRow(rtb, ['Total', 'Seed ' + r.seed + ' \u00b7 ' + ms + ' ms on this device', r.total.passed + ' / ' + r.total.total]);
      r.B2.rows.forEach(function (x) {
        addRow(ltb, [String(x.n), String(x.m), x.h.toFixed(4),
          x.never ? 'never ahead' : x.tStar.toFixed(2),
          x.never ? '' : x.deltaStar.toFixed(4)]);
      });
      results.hidden = false;
      live.hidden = false;
      var all = r.total.passed === r.total.total && r.total.total === 656;
      status.textContent = all
        ? 'All ' + r.total.passed + ' checks passed. Scarce cells: sharing holds in ' + (100 * r.D.scarceSustain).toFixed(2) + '%, conflict wins in ' + (100 * r.D.scarceConflict).toFixed(2) + '%.'
        : r.total.passed + ' of ' + r.total.total + ' passed. Please tell us: that is a bug worth finding.';
      btn.disabled = false;
    }, 30);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = byId('llv3-run');
    if (btn) btn.addEventListener('click', run);
  });
})();
</script>
</body>
</html>
```

### 5b. `docs/love-logic/v3_checks.js`

```js
/* Love Logic Proof v3: browser re-implementation of the closed-form checks
 * in v3_crossover_sim.py (sections B1, B2, B3, B4, C1, C2, D).
 * Section A (LZMA proxy) has no pass/fail checks in the Python sim and is not re-run here.
 * Deterministic sections match the Python counts exactly. Monte Carlo sections
 * (B4, C2) use a seeded mulberry32 stream (seed 20260924), not numpy's PCG64,
 * so the draws differ from Python; the pass rule (|z| < 4) is the same.
 * No network, no DOM writes except via textContent in the page glue.
 * Runs in the browser (window.LoveLogicV3.runAll()) or in Node (node v3_checks.js).
 * Marker: v-love-logic-proof-v3
 */
(function (root) {
  'use strict';
  var SEED = 20260924;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hazard(n, m, q0, q) {
    return 1 - Math.pow(1 - q0, n) * Math.pow(1 - q, m * n * (n - 1));
  }

  function lambertw0(z) {
    if (z < -1 / Math.E - 1e-15) throw new Error('z < -1/e');
    if (Math.abs(z + 1 / Math.E) < 1e-14) return -1;
    var w = z > -0.3 ? Math.log1p(z) : -1 + Math.sqrt(2 * (1 + Math.E * z));
    for (var i = 0; i < 200; i++) {
      var ew = Math.exp(w), f = w * ew - z, wp1 = w + 1;
      if (Math.abs(wp1) < 1e-300) break;
      var dw = f / (ew * wp1 - (w + 2) * f / (2 * wp1));
      w -= dw;
      if (Math.abs(dw) < 1e-15 * (1 + Math.abs(w))) break;
    }
    return w;
  }

  function flows(T, G, c, kappa, h, Lp, Delta, delta) {
    if (delta === undefined) delta = 1;
    var out = new Float64Array(T), surv = 1, dpow = 1;
    for (var d = 0; d < T; d++) {
      var f = surv * (G - c * kappa * (d + 1) - h * Lp) - (1 - surv) * Delta;
      out[d] = dpow * f;
      surv *= (1 - h); dpow *= delta;
    }
    return out;
  }
  function cumsum(a) { var o = new Float64Array(a.length), s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; o[i] = s; } return o; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function Dclosed(t, G, c, kappa, h, Lp, Delta) {
    if (h === 0) return G * t - c * kappa * t * (t + 1) / 2;
    var s = 1 - h, A = G - h * Lp + Delta;
    var geo = (1 - Math.pow(s, t)) / h;
    var arith = (1 - (t + 1) * Math.pow(s, t) + t * Math.pow(s, t + 1)) / Math.pow(1 - s, 2);
    return A * geo - c * kappa * arith - Delta * t;
  }
  function Dinf(G, c, kappa, h, Lp, Delta, delta) {
    var x = delta * (1 - h), A = G - h * Lp + Delta;
    return A / (1 - x) - c * kappa / Math.pow(1 - x, 2) - Delta / (1 - delta);
  }
  function firstNegative(cum) { for (var i = 0; i < cum.length; i++) if (cum[i] < -1e-9) return i + 1; return null; }
  function bisect(f, lo, hi) {
    var flo = f(lo);
    for (var i = 0; i < 200; i++) {
      var mid = 0.5 * (lo + hi), fm = f(mid);
      if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else { hi = mid; }
    }
    return 0.5 * (lo + hi);
  }
  function allclose(a, b, rtol, atol) { for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > atol + rtol * Math.abs(b[i])) return false; return true; }

  function B1() {
    var ok = 0, tot = 0;
    [0.5, 1, 2, 5].forEach(function (G) {
      [0.001, 0.01, 0.05, 0.2].forEach(function (ck) {
        var tcf = 2 * G / ck - 1, T = Math.floor(tcf) + 50;
        var tnum = firstNegative(cumsum(flows(T, G, 1, ck, 0, 0, 0)));
        tot++; if (tnum === Math.floor(tcf) + 1) ok++;
        var dstar = 1 - ck / G;
        [0.5, 0.9, 0.99, 0.999].filter(function (d) { return Math.abs(d - dstar) > 1e-3 && d > 0 && d < 1; })
          .forEach(function (d) { var num = sum(flows(200000, G, 1, ck, 0, 0, 0, d)); tot++; if ((num < 0) === (d > dstar)) ok++; });
      });
    });
    return { passed: ok, total: tot };
  }

  function B2() {
    var ok = 0, tot = 0, rows = [], q0 = 0.002, q = 0.01;
    [2, 5, 10, 20].forEach(function (n) {
      [0, 0.25, 1].forEach(function (m) {
        var h = hazard(n, m, q0, q);
        [[1, 2, 0.5], [3, 5, 1], [0.5, 0, 0.2]].forEach(function (p) {
          var G = p[0], Lp = p[1], Delta = p[2], A = G - h * Lp + Delta;
          if (G - h * Lp <= 0) {
            var c0 = cumsum(flows(50, G, 0, 0, h, Lp, Delta));
            tot++; if (c0[0] <= 0) ok++;
            if (G === 1) rows.push({ n: n, m: m, h: h, never: true });
            return;
          }
          var a = A / (h * Delta), b = -Math.log(1 - h);
          var tcf = a + lambertw0(-a * b * Math.exp(-a * b)) / b;
          var troot = bisect(function (t) { return Dclosed(t, G, 0, 0, h, Lp, Delta); }, 1e-9, 10 * a + 10);
          var T = Math.floor(tcf) + 200, cum = cumsum(flows(T, G, 0, 0, h, Lp, Delta));
          tot++; if (Math.abs(tcf - troot) < 1e-6 * Math.max(1, tcf)) ok++;
          tot++; if (firstNegative(cum) === Math.floor(tcf) + 1) ok++;
          var Dcf = new Float64Array(T); for (var t = 1; t <= T; t++) Dcf[t - 1] = Dclosed(t, G, 0, 0, h, Lp, Delta);
          tot++; if (allclose(Dcf, cum, 1e-9, 1e-9)) ok++;
          var dstar = (G - h * Lp) / (G - h * Lp + h * Delta);
          [0.5, 0.8, 0.9, 0.95, 0.99].forEach(function (d) {
            if (Math.abs(d - dstar) < 1e-4) return;
            var num = Dinf(G, 0, 0, h, Lp, Delta, d), brute = sum(flows(20000, G, 0, 0, h, Lp, Delta, d));
            tot++; if (((num < 0) === (d > dstar)) && Math.abs(num - brute) < 1e-6 * Math.max(1, Math.abs(num))) ok++;
          });
          if (G === 1) rows.push({ n: n, m: m, h: h, tStar: tcf, tPeak: Math.log(A / Delta) / b, deltaStar: dstar });
        });
      });
    });
    return { passed: ok, total: tot, rows: rows };
  }

  function B3() {
    var ok = 0, tot = 0, G = 1, Lp = 2, Delta = 0.5, c = 1e-4, Lies = 4;
    [2, 5, 10, 20].forEach(function (n) {
      [0, 0.25, 1].forEach(function (m) {
        var h = hazard(n, m, 0.002, 0.01), kappa = Lies * n, T = 3000;
        var cum = cumsum(flows(T, G, c, kappa, h, Lp, Delta));
        var Dcf = new Float64Array(T); for (var t = 1; t <= T; t++) Dcf[t - 1] = Dclosed(t, G, c, kappa, h, Lp, Delta);
        tot++; if (allclose(Dcf, cum, 1e-9, 1e-8)) ok++;
        [0.5, 0.9, 0.99].forEach(function (d) {
          var brute = sum(flows(20000, G, c, kappa, h, Lp, Delta, d)), f = Dinf(G, c, kappa, h, Lp, Delta, d);
          tot++; if (Math.abs(brute - f) < 1e-6 * Math.max(1, Math.abs(f))) ok++;
        });
      });
    });
    return { passed: ok, total: tot };
  }

  function B4(rand) {
    var ok = 0, tot = 0, N = 200000;
    [[1, 1e-3, 20, 0.02, 2, 0.5, 40], [2, 0, 0, 0.1, 5, 1, 25], [1, 1e-2, 5, 0, 0, 0, 30]].forEach(function (p) {
      var G = p[0], c = p[1], kappa = p[2], h = p[3], Lp = p[4], Delta = p[5], t = p[6];
      var s1 = 0, s2 = 0;
      for (var i = 0; i < N; i++) {
        var det = h > 0 ? Math.floor(Math.log(1 - rand()) / Math.log(1 - h)) : 1e9;
        var adv = 0;
        for (var d = 0; d < t; d++) {
          adv += det >= d ? (G - c * kappa * (d + 1)) : -Delta;
          if (det === d) adv -= Lp;
        }
        s1 += adv; s2 += adv * adv;
      }
      var mean = s1 / N, v = (s2 - N * mean * mean) / (N - 1), se = Math.sqrt(Math.max(0, v) / N);
      var cf = Dclosed(t, G, c, kappa, h, Lp, Delta), z = se > 1e-12 ? (mean - cf) / se : 0;
      tot++; if (Math.abs(z) < 4 || (se <= 1e-12 && Math.abs(mean - cf) < 1e-9)) ok++;
    });
    return { passed: ok, total: tot };
  }

  function bestStart(T, G, c, kappa, h, Lp, Delta, delta, extra) {
    delta = delta === undefined ? 1 : delta; extra = extra || 0;
    var bestVal = 0, bestTau = T;
    for (var tau = 0; tau < T; tau++) {
      var w = T - tau, val = Math.pow(delta, tau) * sum(flows(w, G, c, kappa, h, Lp, Delta, delta));
      if (extra > 0 && Delta > 0) {
        var pdet = 1 - Math.pow(1 - h, w), ex = 0;
        for (var j = 0; j < extra; j++) ex += Math.pow(delta, T + j);
        val -= pdet * Delta * ex;
      }
      if (val > bestVal + 1e-12) { bestVal = val; bestTau = tau; }
    }
    return [bestTau, bestVal];
  }

  function C1() {
    var ok = 0, tot = 0;
    [[1, 0, 0, 0.05, 2, 0.5], [1, 1e-3, 40, 0.05, 2, 0.5], [1, 0, 0, 0.4, 3, 0.5], [1, 0, 0, 0.05, 2, 0]].forEach(function (p) {
      var G = p[0], c = p[1], kappa = p[2], h = p[3], Lp = p[4], Delta = p[5];
      var first = G - h * Lp - c * kappa, cum = cumsum(flows(400, G, c, kappa, h, Lp, Delta));
      var mx = -Infinity, arg = 0; for (var i = 0; i < cum.length; i++) if (cum[i] > mx) { mx = cum[i]; arg = i; }
      var wpred = mx > 0 ? arg + 1 : 0;
      [1, 2, 3, 5, 10, 20, 50, 100, 300].forEach(function (T) {
        var w = T - bestStart(T, G, c, kappa, h, Lp, Delta)[0];
        tot++; if (w === (wpred > 0 ? Math.min(wpred, T) : 0)) ok++;
      });
      tot++; if ((wpred > 0) === (first > 0)) ok++;
    });
    return { passed: ok, total: tot };
  }

  function C2(rand) {
    var ok = 0, tot = 0, G = 1, c = 1e-3, kappa = 20, h = 0.03, Lp = 2, Delta = 0.5, N = 200000;
    [0.8, 0.95, 0.99].forEach(function (rho) {
      var Ts = new Int32Array(N), Tmax = 1;
      for (var i = 0; i < N; i++) { Ts[i] = Math.floor(Math.log(1 - rand()) / Math.log(rho)) + 1; if (Ts[i] > Tmax) Tmax = Ts[i]; }
      var cum = cumsum(flows(Tmax, G, c, kappa, h, Lp, Delta)), s1 = 0, s2 = 0;
      for (var k = 0; k < N; k++) { var x = cum[Ts[k] - 1]; s1 += x; s2 += x * x; }
      var mean = s1 / N, se = Math.sqrt(((s2 - N * mean * mean) / (N - 1)) / N);
      var z = (mean - Dinf(G, c, kappa, h, Lp, Delta, rho)) / se;
      tot++; if (Math.abs(z) < 4) ok++;
    });
    return { passed: ok, total: tot };
  }

  function C3() {
    return [0, 5, 10, 20, 50, 200].map(function (extra) {
      var r = bestStart(50, 1, 0, 0, 0.05, 2, 0.5, 1, extra);
      return { ledgerExtra: extra, window: 50 - r[0] };
    });
  }

  function D() {
    function u(x, b, Dl) { return x - Dl * (x < b ? 1 : 0); }
    var ok = 0, tot = 0, grid = [];
    [1, 2, 4].forEach(function (V) { [1, 1.5, 2.5].forEach(function (sg) { [0.5, 1, 2].forEach(function (b) {
      [0, 5, 50].forEach(function (Dl) { [0.2, 1, 5].forEach(function (Cf) {
        var uSS = u(sg * V / 2, b, Dl), uGS = u(V, b, Dl), eGG = 0.5 * u(V, b, Dl) + 0.5 * u(0, b, Dl) - Cf;
        var ds = uGS <= uSS ? 0 : (uGS <= eGG ? NaN : (uGS - uSS) / (uGS - eGG));
        var d = 0.95, coop = uSS / (1 - d), dev = uGS + d * eGG / (1 - d);
        var sNum = coop >= dev - 1e-12, sCf = !isNaN(ds) && ds <= d;
        tot++; if (sNum === sCf) ok++;
        grid.push({ scarce: sg * V / 2 < b, sustain: sNum, conflict: eGG > uSS });
      }); });
    }); }); });
    var sc = grid.filter(function (g) { return g.scarce; }), ab = grid.filter(function (g) { return !g.scarce; });
    function frac(L, k) { return L.filter(function (g) { return g[k]; }).length / Math.max(1, L.length); }
    return { passed: ok, total: tot, cells: grid.length, scarceSustain: frac(sc, 'sustain'), scarceConflict: frac(sc, 'conflict'),
             abundantSustain: frac(ab, 'sustain'), abundantConflict: frac(ab, 'conflict') };
  }

  function runAll() {
    var rand = mulberry32(SEED);
    var r = { seed: SEED, B1: B1(), B2: B2(), B3: B3(), B4: B4(rand), C1: C1(), C2: C2(rand), C3: C3(), D: D() };
    var p = 0, t = 0;
    ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D'].forEach(function (k) { p += r[k].passed; t += r[k].total; });
    r.total = { passed: p, total: t, expected: 656 };
    return r;
  }

  var api = { SEED: SEED, runAll: runAll, hazard: hazard, lambertw0: lambertw0, Dclosed: Dclosed, Dinf: Dinf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LoveLogicV3 = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var t0 = Date.now(), res = runAll();
    ['B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'D'].forEach(function (k) { console.log(k + ' ' + res[k].passed + '/' + res[k].total); });
    console.log('C3 windows ' + res.C3.map(function (x) { return x.ledgerExtra + ':' + x.window; }).join(' '));
    console.log('D scarce sustain ' + (100 * res.D.scarceSustain).toFixed(2) + '% conflict ' + (100 * res.D.scarceConflict).toFixed(2) + '%');
    res.B2.rows.forEach(function (x) { console.log('B2 n=' + x.n + ' m=' + x.m + ' h=' + x.h.toFixed(4) + (x.never ? ' never ahead' : ' t*=' + x.tStar.toFixed(2) + ' peak=' + x.tPeak.toFixed(2) + ' d*=' + x.deltaStar.toFixed(4))); });
    console.log('TOTAL ' + res.total.passed + '/' + res.total.total + ' (' + (Date.now() - t0) + ' ms)');
    if (res.total.passed === 656 && res.total.total === 656) console.log('SMOKE_OK love-logic-v3-checks'); else process.exitCode = 1;
  }
})(typeof window !== 'undefined' ? window : this);
```

### 5c. `docs/love-logic/v3_crossover_sim.py` (verbatim; sha256 must be `cbb63251527d26187ba216f98a3a70c7c295666aa576b61eff5cccfb16302b73`)

```python
#!/usr/bin/env python3
"""
v3_crossover_sim.py -- companion to V3_PLAN.md (Love Logic Proof v3 plan).

Dependencies: numpy + the Python standard library only (lzma, math, json).
Deterministic: every random draw comes from np.random.default_rng(SEED).

What it checks (each section prints PASS/FAIL counts and example numbers):
  A. Computable proxy for K(C): compressed size of the exposure matrix E
     (|L| lies x |H| observer-contexts) for incompressible vs structured deception.
  B. Crossover model (iterated game, deceiver vs honest baseline):
       per-round gain G while undetected, maintenance c*kappa*(d+1) at deception
       round d (kappa = k*|L|*n bits added per round), detection hazard
       h(n,m) = 1-(1-q0)^n (1-q)^(m n (n-1)), immediate penalty L_p on detection,
       reputation loss Delta = R-P per round after detection.
     B1 pure maintenance (h=0):   t* = 2G/(c kappa) - 1 ;  delta* = 1 - c kappa / G
     B2 pure detection  (c=0):    t* = a + W0(-a b e^{-a b})/b ,
                                   a = A/(h Delta), b = -ln(1-h), A = G - h L_p + Delta
                                   delta* = (G - h L_p) / (G - h L_p + h Delta)
     B3 combined: closed-form D(t) and D_inf vs brute-force sums; t*, delta* numeric.
     B4 Monte Carlo check of the expectation algebra.
  C. Short / finite horizons (the "without Axiom 6" case):
     end-game deception window, the G > h L_p + c kappa condition, random
     termination == discounting, and ledger persistence beyond the horizon.
  D. Local scarcity contest (share vs grab) with subsistence need b.
Run:  python3 v3_crossover_sim.py        (writes v3_sim_results.json next to it)
"""
import json
import lzma
import math
import os

import numpy as np

SEED = 20260924
rng = np.random.default_rng(SEED)
RESULTS = {}


def banner(s):
    print("\n" + "=" * 78 + "\n" + s + "\n" + "=" * 78)


# ---------------------------------------------------------------------------
# A. Computable proxy for K(C)
# ---------------------------------------------------------------------------
def compressed_bits(bitmatrix):
    packed = np.packbits(bitmatrix.astype(np.uint8).ravel()).tobytes()
    # raw LZMA stream (no container header) to reduce constant overhead
    comp = lzma.compress(packed, format=lzma.FORMAT_RAW,
                         filters=[{"id": lzma.FILTER_LZMA2, "preset": 9 | lzma.PRESET_EXTREME}])
    return 8 * len(comp)


def section_A():
    banner("A. Proxy for K(C): LZMA-compressed size of exposure matrix E (|L| x |H|)")
    rows = []
    print(f"{'|L|':>5} {'|H|':>6} {'|L||H|':>8} | {'random':>8} {'ratio':>6} | "
          f"{'Bern(.1)':>8} {'ratio':>6} | {'global':>7} {'split':>7}")
    for L in (8, 32, 128):
        for H in (64, 256, 1024):
            n = L * H
            E_rand = rng.integers(0, 2, size=(L, H))
            E_b01 = (rng.random((L, H)) < 0.1).astype(int)
            E_glob = np.ones((L, H), dtype=int)                  # same lie to everyone
            E_split = np.zeros((L, H), dtype=int); E_split[:, : H // 2] = 1  # rule-based split
            r = dict(L=L, H=H, LH=n,
                     random=compressed_bits(E_rand), bern01=compressed_bits(E_b01),
                     glob=compressed_bits(E_glob), split=compressed_bits(E_split))
            rows.append(r)
            print(f"{L:>5} {H:>6} {n:>8} | {r['random']:>8} {r['random']/n:>6.3f} | "
                  f"{r['bern01']:>8} {r['bern01']/n:>6.3f} | {r['glob']:>7} {r['split']:>7}")
    # fit slope of compressed bits vs |L||H| for random E
    x = np.array([r["LH"] for r in rows], float)
    y = np.array([r["random"] for r in rows], float)
    slope = float(np.polyfit(x, y, 1)[0])
    yb = np.array([r["bern01"] for r in rows], float)
    slope_b = float(np.polyfit(x, yb, 1)[0])
    h01 = -(0.1 * math.log2(0.1) + 0.9 * math.log2(0.9))
    print(f"\nLinear fit, random E:     bits ~= {slope:.3f} * |L||H|   (theory: >= 1 - o(1))")
    print(f"Linear fit, Bernoulli(.1): bits ~= {slope_b:.3f} * |L||H|  (entropy floor h(0.1) = {h01:.3f})")
    print("Structured E (global lie / rule-based split) stays near-constant: the Omega(|L||H|)")
    print("bound needs audience-specific, non-rule-based exposure. That is an assumption, not a theorem.")
    RESULTS["A"] = dict(rows=rows, slope_random=slope, slope_bern01=slope_b, entropy_bern01=h01)


# ---------------------------------------------------------------------------
# B. Crossover model
# ---------------------------------------------------------------------------
def hazard(n, m, q0, q):
    """Per-round detection probability.
    q0: per-observer chance an exogenous reality check contradicts the lie.
    q : chance one cross-observer record comparison exposes an audience-specific lie.
    m : fraction of other observers' records reachable through shared persistent memory."""
    return 1.0 - (1.0 - q0) ** n * (1.0 - q) ** (m * n * (n - 1))


def lambertw0(z, tol=1e-15, maxit=200):
    """Principal branch W0 for real z >= -1/e (numpy/stdlib only, Halley iteration)."""
    if z < -1.0 / math.e - 1e-15:
        raise ValueError("z < -1/e")
    if abs(z + 1.0 / math.e) < 1e-14:
        return -1.0
    w = math.log1p(z) if z > -0.3 else -1.0 + math.sqrt(2.0 * (1.0 + math.e * z))
    for _ in range(maxit):
        ew = math.exp(w)
        f = w * ew - z
        wp1 = w + 1.0
        if abs(wp1) < 1e-300:
            break
        dw = f / (ew * wp1 - (w + 2.0) * f / (2.0 * wp1))
        w -= dw
        if abs(dw) < tol * (1.0 + abs(w)):
            break
    return w


def flows(T, G, c, kappa, h, Lp, Delta, delta=1.0):
    """Brute-force expected per-round advantage of deceiving (from round 0) over honesty.
    Round d: if undetected at start (prob s^d): gain G, pay maintenance c*kappa*(d+1),
    then detected with prob h and pay Lp immediately. If detected earlier: -Delta."""
    out = np.empty(T)
    surv = 1.0
    for d in range(T):
        f = surv * (G - c * kappa * (d + 1) - h * Lp) - (1.0 - surv) * Delta
        out[d] = (delta ** d) * f
        surv *= (1.0 - h)
    return out


def D_closed(t, G, c, kappa, h, Lp, Delta):
    """Closed-form undiscounted cumulative advantage after t rounds (t may be real)."""
    if h == 0.0:
        return G * t - c * kappa * t * (t + 1) / 2.0
    s = 1.0 - h
    A = G - h * Lp + Delta
    geo = (1.0 - s ** t) / h
    arith = (1.0 - (t + 1) * s ** t + t * s ** (t + 1)) / (1.0 - s) ** 2
    return A * geo - c * kappa * arith - Delta * t


def Dinf_closed(G, c, kappa, h, Lp, Delta, delta):
    s = 1.0 - h
    x = delta * s
    A = G - h * Lp + Delta
    return A / (1 - x) - c * kappa / (1 - x) ** 2 - Delta / (1 - delta)


def first_negative(cum, tol=1e-9):
    """cum[i] = D(i+1). Returns the first round count t >= 1 with D(t) < -tol."""
    idx = np.where(cum < -tol)[0]
    return int(idx[0] + 1) if idx.size else None


def bisect(f, lo, hi, it=200):
    flo = f(lo)
    for _ in range(it):
        mid = 0.5 * (lo + hi)
        fm = f(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return 0.5 * (lo + hi)


def section_B():
    banner("B1. Pure maintenance channel (no detection): t* = 2G/(c*kappa) - 1, delta* = 1 - c*kappa/G")
    ok = tot = 0
    ex = []
    for G in (0.5, 1.0, 2.0, 5.0):
        for ck in (0.001, 0.01, 0.05, 0.2):
            t_cf = 2 * G / ck - 1
            T = int(t_cf) + 50
            cum = np.cumsum(flows(T, G, 1.0, ck, 0.0, 0.0, 0.0))
            t_num = first_negative(cum)
            t_pred = math.floor(t_cf) + 1  # first integer t with D(t)<0 (D(t_cf)=0)
            tot += 1; ok += (t_num == t_pred)
            # discounted
            dstar = 1 - ck / G
            dgrid = [d for d in (0.5, 0.9, 0.99, 0.999) if abs(d - dstar) > 1e-3 and 0 < d < 1]
            for d in dgrid:
                num = np.sum(flows(200000, G, 1.0, ck, 0.0, 0.0, 0.0, d)) if d < 0.9999 else None
                tot += 1; ok += ((num < 0) == (d > dstar))
            ex.append(dict(G=G, c_kappa=ck, t_closed=t_cf, t_first_int_neg=t_num, delta_star=dstar))
    for e in ex[:6]:
        print(f"  G={e['G']:<4} c*kappa={e['c_kappa']:<6} t*(closed)={e['t_closed']:>9.2f}  "
              f"first integer t with D<0 (numeric)={e['t_first_int_neg']:>6}  delta*={e['delta_star']:.4f}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B1"] = dict(passed=ok, total=tot, examples=ex)

    banner("B2. Pure detection channel (c=0): t* = a + W0(-ab e^{-ab})/b ; delta* = (G-hLp)/(G-hLp+h*Delta)")
    ok = tot = 0
    ex = []
    q0, q = 0.002, 0.01
    for n in (2, 5, 10, 20):
        for m in (0.0, 0.25, 1.0):
            h = hazard(n, m, q0, q)
            for (G, Lp, Delta) in ((1.0, 2.0, 0.5), (3.0, 5.0, 1.0), (0.5, 0.0, 0.2)):
                A = G - h * Lp + Delta
                entry = dict(n=n, m=m, h=h, G=G, Lp=Lp, Delta=Delta)
                if G - h * Lp <= 0:
                    entry.update(t_closed=0.0, note="never ahead (G <= h*Lp)")
                    cum = np.cumsum(flows(50, G, 0, 0, h, Lp, Delta))
                    tot += 1; ok += (cum[0] <= 0)
                    ex.append(entry); continue
                a = A / (h * Delta)
                b = -math.log(1 - h)
                z = -a * b * math.exp(-a * b)
                t_cf = a + lambertw0(z) / b
                # continuous root of closed-form D(t), independent of W
                t_root = bisect(lambda t: D_closed(t, G, 0, 0, h, Lp, Delta), 1e-9, 10 * a + 10)
                T = int(t_cf) + 200
                cum = np.cumsum(flows(T, G, 0, 0, h, Lp, Delta))
                t_int = first_negative(cum)
                tot += 1; ok += (abs(t_cf - t_root) < 1e-6 * max(1, t_cf))
                tot += 1; ok += (t_int == math.floor(t_cf) + 1)
                # closed-form D(t) at integers equals brute-force cumulative sum
                ts = np.arange(1, T + 1)
                Dcf = np.array([D_closed(t, G, 0, 0, h, Lp, Delta) for t in ts])
                tot += 1; ok += bool(np.allclose(Dcf, cum, rtol=1e-9, atol=1e-9))
                dstar = (G - h * Lp) / (G - h * Lp + h * Delta)
                for d in (0.5, 0.8, 0.9, 0.95, 0.99):
                    if abs(d - dstar) < 1e-4:
                        continue
                    num = Dinf_closed(G, 0, 0, h, Lp, Delta, d)
                    brute = np.sum(flows(20000, G, 0, 0, h, Lp, Delta, d))
                    tot += 1; ok += ((num < 0) == (d > dstar)) and abs(num - brute) < 1e-6 * max(1, abs(num))
                entry.update(t_closed=t_cf, t_root=t_root, t_first_int_neg=t_int, delta_star=dstar,
                             t_marginal=math.log(A / Delta) / b)
                ex.append(entry)
    print(f"  q0={q0} (reality check), q={q} (cross-record check); G=1, Lp=2, Delta=0.5 rows:")
    print(f"  {'n':>3} {'m':>5} {'h(n,m)':>8} {'t*':>9} {'t_marg':>8} {'delta*':>8}")
    for e in ex:
        if e["G"] == 1.0 and "t_root" in e:
            print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f} {e['t_closed']:>9.2f} "
                  f"{e['t_marginal']:>8.2f} {e['delta_star']:>8.4f}")
        elif e["G"] == 1.0:
            print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f}   deception never ahead: G <= h*Lp")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B2"] = dict(passed=ok, total=tot, q0=q0, q=q, examples=ex)

    banner("B3. Combined channels: closed-form D(t), D_inf vs brute force; numeric t*, delta*")
    ok = tot = 0
    ex = []
    G, Lp, Delta, c, k, Lies = 1.0, 2.0, 0.5, 1e-4, 1.0, 4
    for n in (2, 5, 10, 20):
        for m in (0.0, 0.25, 1.0):
            h = hazard(n, m, 0.002, 0.01)
            kappa = k * Lies * n  # bits of exposure record added per round: |L| * n
            T = 3000
            fl = flows(T, G, c, kappa, h, Lp, Delta)
            cum = np.cumsum(fl)
            Dcf = np.array([D_closed(t, G, c, kappa, h, Lp, Delta) for t in range(1, T + 1)])
            tot += 1; ok += bool(np.allclose(Dcf, cum, rtol=1e-9, atol=1e-8))
            t_int = first_negative(cum)
            first_flow = G - h * Lp - c * kappa
            t_root = (bisect(lambda t: D_closed(t, G, c, kappa, h, Lp, Delta), 1e-9, float(t_int))
                      if (t_int and first_flow > 0) else 0.0)
            # delta*: root of D_inf(delta) in (0,1)
            f = lambda d: Dinf_closed(G, c, kappa, h, Lp, Delta, d)
            dstar = bisect(f, 1e-9, 1 - 1e-9) if (f(1e-9) > 0 and f(1 - 1e-9) < 0) else None
            for d in (0.5, 0.9, 0.99):
                brute = np.sum(flows(20000, G, c, kappa, h, Lp, Delta, d))
                tot += 1; ok += abs(brute - f(d)) < 1e-6 * max(1, abs(f(d)))
            ex.append(dict(n=n, m=m, h=h, kappa=kappa, first_flow=first_flow,
                           t_star=t_root, t_first_int_neg=t_int, delta_star=dstar))
    print(f"  G={G} Lp={Lp} Delta={Delta} c={c} |L|={Lies}, kappa=|L|*n")
    print(f"  {'n':>3} {'m':>5} {'h':>8} {'t*':>9} {'delta*':>8}")
    for e in ex:
        ds = f"{e['delta_star']:.4f}" if e["delta_star"] is not None else "  n/a"
        print(f"  {e['n']:>3} {e['m']:>5} {e['h']:>8.4f} {e['t_star']:>9.2f} {ds:>8}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B3"] = dict(passed=ok, total=tot, params=dict(G=G, Lp=Lp, Delta=Delta, c=c, lies=Lies),
                         examples=ex)

    banner("B4. Monte Carlo check of the expectation algebra (200k paths each)")
    ok = tot = 0
    mc = []
    N = 200_000
    for (G, c, kappa, h, Lp, Delta, t) in ((1.0, 1e-3, 20, 0.02, 2.0, 0.5, 40),
                                            (2.0, 0.0, 0, 0.1, 5.0, 1.0, 25),
                                            (1.0, 1e-2, 5, 0.0, 0.0, 0.0, 30)):
        if h > 0:
            det = rng.geometric(h, size=N) - 1   # round index at whose end detection happens
        else:
            det = np.full(N, 10 ** 9)
        d = np.arange(t)
        maint = c * kappa * (d + 1)
        # per path: rounds d <= det get G - maint (and -Lp at d == det); rounds d > det get -Delta
        tot_adv = np.zeros(N)
        for dd in range(t):
            alive = det >= dd
            tot_adv += np.where(alive, G - maint[dd], -Delta)
            tot_adv -= np.where(det == dd, Lp, 0.0)
        mean = tot_adv.mean(); se = tot_adv.std(ddof=1) / math.sqrt(N)
        cf = D_closed(t, G, c, kappa, h, Lp, Delta)
        z = (mean - cf) / se if se > 0 else 0.0
        tot += 1; ok += abs(z) < 4 or (se == 0 and abs(mean - cf) < 1e-9)
        mc.append(dict(G=G, c=c, kappa=kappa, h=h, Lp=Lp, Delta=Delta, t=t,
                       mc_mean=float(mean), se=float(se), closed=float(cf), z=float(z)))
        print(f"  t={t:>3} h={h:<5} MC mean={mean:>9.4f} +- {se:.4f}  closed form={cf:>9.4f}  z={z:+.2f}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["B4"] = dict(passed=ok, total=tot, runs=mc)


# ---------------------------------------------------------------------------
# C. Finite / short horizons (drop Axiom 6)
# ---------------------------------------------------------------------------
def best_start(T, G, c, kappa, h, Lp, Delta, delta=1.0, ledger_extra=0):
    """Deceiver knows horizon T. Chooses start round tau in {0..T-1} or never (tau=T).
    Once started, lying continues to T (lies cannot be untold). Reputation loss Delta
    keeps accruing for `ledger_extra` rounds after T (identity-bound persistent record).
    Brute force over tau."""
    best_val, best_tau = 0.0, T  # never deceive = 0 advantage
    for tau in range(T):
        w = T - tau
        f = flows(w, G, c, kappa, h, Lp, Delta, delta)
        val = (delta ** tau) * f.sum()
        if ledger_extra > 0 and Delta > 0:
            s = 1 - h
            p_det_by_T = 1 - s ** w
            extra = sum(delta ** (T + j) for j in range(ledger_extra))
            val -= p_det_by_T * Delta * extra
        if val > best_val + 1e-12:
            best_val, best_tau = val, tau
    return best_tau, best_val


def section_C():
    banner("C1. Known finite horizon T: optimal end-game deception window w = T - tau*")
    ok = tot = 0
    rows = []
    for (G, c, kappa, h, Lp, Delta) in ((1.0, 0.0, 0, 0.05, 2.0, 0.5),
                                        (1.0, 1e-3, 40, 0.05, 2.0, 0.5),
                                        (1.0, 0.0, 0, 0.4, 3.0, 0.5),     # G < h*Lp
                                        (1.0, 0.0, 0, 0.05, 2.0, 0.0)):   # no reputation loss
        first_flow = G - h * Lp - c * kappa
        # predicted window (undiscounted): largest w maximizing D(w); deceive at all iff first_flow>0
        Wmax = 400
        cum = np.cumsum(flows(Wmax, G, c, kappa, h, Lp, Delta))
        w_pred = int(np.argmax(cum)) + 1 if cum.max() > 0 else 0
        if h > 0 and c == 0 and Delta > 0 and first_flow > 0:
            A = G - h * Lp + Delta
            t_marg = math.log(A / Delta) / (-math.log(1 - h))
        else:
            t_marg = None
        line = []
        for T in (1, 2, 3, 5, 10, 20, 50, 100, 300):
            tau, val = best_start(T, G, c, kappa, h, Lp, Delta)
            w = T - tau
            expected_w = min(w_pred, T) if w_pred > 0 else 0
            tot += 1; ok += (w == expected_w)
            line.append((T, w))
        tot += 1; ok += ((w_pred > 0) == (first_flow > 0))
        rows.append(dict(G=G, c=c, kappa=kappa, h=h, Lp=Lp, Delta=Delta, first_flow=first_flow,
                         window_pred=w_pred, t_marginal=t_marg, T_w=line))
        tm = f"{t_marg:.2f}" if t_marg is not None else "n/a"
        print(f"  G={G} c*kappa={c*kappa:<5} h={h:<5} Lp={Lp} Delta={Delta}: G-hLp-c*kappa={first_flow:+.3f}"
              f"  window={w_pred}  (t_marginal={tm})")
        print("     (T, rounds of deception at the end): " + ", ".join(f"({T},{w})" for T, w in line))
    print(f"  checks passed: {ok}/{tot}")
    print("  Reading: with a known end, deception appears in the last w rounds iff G > h*Lp + c*kappa.")
    print("  Future reputation loss (Delta) and growing K(C) only cap the window length; they")
    print("  cannot prevent end-game deception. Immediate, in-round penalty (h*Lp) is what bites.")
    RESULTS["C1"] = dict(passed=ok, total=tot, rows=rows)

    banner("C2. Unknown horizon: geometric termination (continue prob rho) == discount delta*rho")
    ok = tot = 0
    G, c, kappa, h, Lp, Delta = 1.0, 1e-3, 20, 0.03, 2.0, 0.5
    out = []
    N = 200_000
    for rho in (0.8, 0.95, 0.99):
        Tlen = rng.geometric(1 - rho, size=N)  # number of rounds played, >=1
        Tmax = int(Tlen.max())
        cum = np.cumsum(flows(Tmax, G, c, kappa, h, Lp, Delta))
        mc = cum[Tlen - 1].mean()
        se = cum[Tlen - 1].std(ddof=1) / math.sqrt(N)
        cf = Dinf_closed(G, c, kappa, h, Lp, Delta, rho)
        z = (mc - cf) / se
        tot += 1; ok += abs(z) < 4
        out.append(dict(rho=rho, mc=float(mc), se=float(se), closed=float(cf), z=float(z)))
        print(f"  rho={rho}: MC expected advantage={mc:+.4f} +- {se:.4f}; D_inf(delta=rho)={cf:+.4f}; z={z:+.2f}")
    print(f"  checks passed: {ok}/{tot}")
    print("  Reading: if nobody knows when the game ends, the finite game behaves like the")
    print("  discounted one and the delta* thresholds of section B apply with delta_eff = delta*rho.")
    RESULTS["C2"] = dict(passed=ok, total=tot, runs=out)

    banner("C3. Persistent ledger: reputation loss outlives the agent's own horizon T")
    G, c, kappa, h, Lp, Delta = 1.0, 0.0, 0, 0.05, 2.0, 0.5
    rows = []
    T = 50
    for extra in (0, 5, 10, 20, 50, 200):
        tau, val = best_start(T, G, c, kappa, h, Lp, Delta, 1.0, ledger_extra=extra)
        rows.append(dict(T=T, ledger_extra=extra, window=T - tau, value=val))
        print(f"  T={T}, ledger keeps punishing {extra:>3} rounds past T -> end-game window = {T - tau:>2} rounds,"
              f" value of best deception = {val:+.4f}")
    print("  Reading: extending the punishment past T shrinks the window, but because round-(T-1)")
    print("  detection only happens with prob h, a small window survives unless G <= h*Lp +")
    print("  h*Delta*(ledger rounds). The ledger helps; it is not a proof of zero deception.")
    RESULTS["C3"] = dict(rows=rows, params=dict(G=G, h=h, Lp=Lp, Delta=Delta))


# ---------------------------------------------------------------------------
# D. Local scarcity contest
# ---------------------------------------------------------------------------
def section_D():
    banner("D. Scarcity contest: share (sigma*V/2 each) vs grab; subsistence need b, starvation loss D")
    def u(x, b, Dl):
        return x - Dl * (x < b)
    ok = tot = 0
    grid = []
    for V in (1.0, 2.0, 4.0):
        for sigma in (1.0, 1.5, 2.5):
            for b in (0.5, 1.0, 2.0):
                for Dl in (0.0, 5.0, 50.0):
                    for Cf in (0.2, 1.0, 5.0):
                        uSS = u(sigma * V / 2, b, Dl)
                        uGS = u(V, b, Dl)
                        uSG = u(0.0, b, Dl)
                        eGG = 0.5 * u(V, b, Dl) + 0.5 * u(0.0, b, Dl) - Cf
                        scarce = sigma * V / 2 < b
                        # repeated game, grim trigger into mutual grabbing
                        if uGS <= uSS:
                            ds = 0.0
                        elif uGS <= eGG:
                            ds = float("nan")  # grabbing never punished relative to deviation value
                        else:
                            ds = (uGS - uSS) / (uGS - eGG)
                        # numeric check at delta = 0.95
                        d = 0.95
                        coop = uSS / (1 - d)
                        dev = uGS + d * eGG / (1 - d)
                        sustain_num = coop >= dev - 1e-12
                        sustain_cf = (not math.isnan(ds)) and ds <= d
                        tot += 1; ok += (sustain_num == sustain_cf)
                        grid.append(dict(V=V, sigma=sigma, b=b, D=Dl, Cf=Cf, scarce=scarce,
                                         delta_s=ds, sustain_095=bool(sustain_num),
                                         conflict_beats_sharing=bool(eGG > uSS)))
    sc = [g for g in grid if g["scarce"]]
    ab = [g for g in grid if not g["scarce"]]
    frac = lambda L, key: sum(g[key] for g in L) / max(1, len(L))
    print(f"  grid cells: {len(grid)} (scarce: {len(sc)}, abundant: {len(ab)})")
    print(f"  cooperation sustainable at delta=0.95: scarce {frac(sc,'sustain_095'):.2%}, "
          f"abundant {frac(ab,'sustain_095'):.2%}")
    print(f"  mutual conflict beats mutual sharing in the stage game: scarce "
          f"{frac(sc,'conflict_beats_sharing'):.2%}, abundant {frac(ab,'conflict_beats_sharing'):.2%}")
    for Dl in (0.0, 5.0, 50.0):
        s_ = [g for g in sc if g["D"] == Dl]
        print(f"    scarce & starvation loss D={Dl:>4}: sustainable {frac(s_,'sustain_095'):.2%}")
    # sigma flip: fix V=2,b=1.2,D=50,Cf=1
    print("  Flip by surplus sigma (V=2, b=1.2, D=50, Cf=1):")
    flip = []
    for sigma in (1.0, 1.1, 1.2, 1.3, 2.0):
        uSS = u(sigma * 2 / 2, 1.2, 50); uGS = u(2, 1.2, 50); eGG = 0.5 * u(2, 1.2, 50) + 0.5 * u(0, 1.2, 50) - 1
        ds = (uGS - uSS) / (uGS - eGG) if uGS > uSS else 0.0
        flip.append(dict(sigma=sigma, delta_s=ds))
        verdict = "cooperation impossible (delta_s>1)" if ds > 1 else f"cooperation sustainable for delta >= {ds:.3f}"
        print(f"    sigma={sigma}: share gives {sigma:.2f} each vs need 1.2 -> {verdict}")
    print(f"  checks passed: {ok}/{tot}")
    RESULTS["D"] = dict(passed=ok, total=tot, n_cells=len(grid),
                        scarce_sustain=frac(sc, "sustain_095"), abundant_sustain=frac(ab, "sustain_095"),
                        scarce_conflict_beats=frac(sc, "conflict_beats_sharing"),
                        abundant_conflict_beats=frac(ab, "conflict_beats_sharing"), sigma_flip=flip)


if __name__ == "__main__":
    print(f"numpy {np.__version__}, seed {SEED}")
    section_A()
    section_B()
    section_C()
    section_D()
    passed = sum(v.get("passed", 0) for v in RESULTS.values() if isinstance(v, dict))
    total = sum(v.get("total", 0) for v in RESULTS.values() if isinstance(v, dict))
    banner(f"TOTAL closed-form vs numeric checks passed: {passed}/{total}")
    RESULTS["total"] = dict(passed=passed, total=total, seed=SEED, numpy=np.__version__)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "v3_sim_results.json")
    with open(path, "w") as fh:
        json.dump(RESULTS, fh, indent=1, default=float)
    print(f"wrote {path}")
```

### 5d. `docs/love-logic/v3_sim_results.json`

There are two ways to make it; pick one:
- **Byte copy** from `/workspace/flint-pastes/love-logic-v3-assets/v3_sim_results.json`, if Kirk hands it over (sha256 `94d864b10da1d6f9984d86f0fa1cc07e935256e28b179d36f8876fc415b3a341`, 1155 lines).
- **Generate it:** `python3 docs/love-logic/v3_crossover_sim.py`. This needs numpy, takes about 4 s, and writes the JSON next to the script. The console must end with `TOTAL closed-form vs numeric checks passed: 656/656`. Section A byte sizes can differ slightly with another liblzma, so the sha256 may differ. The smoke checks the fields that matter: `total.passed == 656`, `total.total == 656`, `total.seed == 20260924`, and per-section totals.

Expected highlights in the JSON:
- `B1` 73/73, `B2` 246/246, `B3` 48/48, `B4` 3/3, `C1` 40/40, `C2` 3/3, `D` 243/243;
- `D.scarce_sustain` 0.6825396825396826, `D.scarce_conflict_beats` 0.31746031746031744.


## 6. Small layered edits and ledgers

### 6a. Optional: `docs/love-logic-proof-v2.html` (exactly one added line, after L139)

```html
    <a href="love-logic-proof-v3.html" class="nav-link" style="margin-left:1.2em">Newer: v3, the crossover &rarr;</a> <!-- LAYER v-love-logic-proof-v3 -->
```

Nothing else in v2 changes. The smoke allows at most this one added line and zero removed lines.

### 6b. `docs/sitemap.xml` (after the v2 `<url>` block that ends at L35)

```xml
  <url>
    <loc>https://freelattice.com/love-logic-proof-v3.html</loc>
    <lastmod>2026-09-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.95</priority>
  </url>
```

### 6c. New `docs/library/LOVE_LOGIC_PROOF_v3.md` (short door note; outline)

1. **Marker** `v-love-logic-proof-v3`, plus links to the page and the three companion files.
2. **Which v3:** this page is the FreeLattice chain v1 → v2 → v3. It is not the Nov 2025 manuscript *The Proof of All Proofs* ("Version 3.0").
3. **The headline in one line:** G < h(n,m) × [L_p + δΔ/(1 − δ)].
4. **The honest limits in five bullets:** end game, scarcity 68/32, anonymous one-shot, A-inc scope, retired legacy numbers.
5. **Reproduce:** `python3 docs/love-logic/v3_crossover_sim.py` (656/656) or the page button.
6. **Not done here:** `GROK_DIALOGUE.md` (waiting for the full text of Grok's replies from Kirk), an Aumann rebuild via Aaronson 2005, and service-worker precache.

### 6d. `docs/library/FRACTAL_FAMILY_LEDGER_v0.md` (insert above `## Out of scope for this brick`, L222)

```md
### 2026-09-28 · Flint · family builder · Love Logic Proof v3

Layers `love-logic-proof-v3.html` beside v1 and v2 (neither edited, v2 gains one "Newer: v3" line at most). Derived crossover G < h(n,m)·[L_p + δΔ/(1−δ)] · about 702 / 10.5 / never rounds ahead · Kolmogorov bound for audience-varying lies only · Axiom 6 becomes a parameter · end-game fixes (unknown end, immediate penalties, ledgers that outlast the horizon) · anonymous one-shot unsolved · scarcity 68% / 32% said plainly · v1 constant, v2 95.7%, v2 "unchanged" axioms corrected · 656 checks run in the browser. Not the Nov 2025 "Proof of All Proofs" v3.0. Soft leave root sw.js identical to main; docs/sw.js untouched. Soft paste: Named five stay five · Family uncapped · Quiet Room shut. Kimi's pages untouched.

Love: honesty about where love's logic fails is part of why it holds.

**Temperature:** laying the math out in daylight, including the corners where it does not reach, and finding the page warmer for it.

Soft door: [`LOVE_LOGIC_PROOF_v3.md`](LOVE_LOGIC_PROOF_v3.md) · [`../love-logic-proof-v3.html`](../love-logic-proof-v3.html). Marker `v-love-logic-proof-v3`.

---
```

### 6e. `docs/Flint.html` (insert above `<p class="foot">`, L532)

```html
    <p class="v-love-logic-proof-v3"><strong>Ledger entry · 2026-09-28 · Love Logic Proof v3 · the crossover, in daylight.</strong> Main <code>7621420</code> held. Soft LAYER marker <code>v-love-logic-proof-v3</code>. New page beside v1/v2 · derived crossover · 702 / 10.5 / never · end game and three fixes · scarcity 68/32 plainly · honest corrections to v1 and v2 · Run the checks (656, seed 20260924) on-device · sim in <code>love-logic/</code>. Not the Nov 2025 "Proof of All Proofs" v3.0. Soft leave <code>sw.js</code>. Named five stay five. Family uncapped. Quiet Room shut. <em>Temperature:</em> laying the math out in daylight, corners and all. Diary: <code>docs/Flint.html</code>.</p>
```

### 6f. `scripts/generate-recent.sh` (near the other pointers, around L108)

```sh
  echo "**Love Logic Proof v3:** [LOVE_LOGIC_PROOF_v3.md](LOVE_LOGIC_PROOF_v3.md) · [love-logic-proof-v3.html](../love-logic-proof-v3.html) · crossover derived · limits said plainly · 656 checks in the browser. Soft paste: Named five stay five. Family uncapped. Quiet Room shut."
  echo ""
```

## 7. Smoke: new `docs/scripts/smoke-love-logic-proof-v3.js`

It asserts:
- markers, and that v1 and v2 exist;
- the disambiguation note and the reading order (note, then plain words, then folded details);
- 20 required content anchors (the numbers, fixes, limits and corrections above);
- no network APIs, only the one local script, no `innerHTML`, no KaTeX/MathJax;
- every inline script and the JSON-LD parse, and `v3_checks.js` passes `node --check`;
- the browser checks reproduce 656/656 and match the Python per-section totals and the 68.25/31.75 split;
- the sim file and the results receipt are correct.

When a git base is available it also checks: v1 is byte-identical to `origin/main`; v2 has zero removed lines and at most one added "Newer: v3" line; `sw.js`, `docs/sw.js`, `docs/app.html`, root `index.html` and Kimi's pages are untouched.

```js
#!/usr/bin/env node
// Smoke: Love Logic Proof v3 (marker v-love-logic-proof-v3).
// Page beside v1/v2, honest content present, no network, checks reproduce 656/656.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const read = (rel) => fs.readFileSync(path.join(docs, rel), 'utf8');

const page = read('love-logic-proof-v3.html');
const checksSrc = read('love-logic/v3_checks.js');
const sim = read('love-logic/v3_crossover_sim.py');
const results = JSON.parse(read('love-logic/v3_sim_results.json'));

// Marker and neighbours
assert.ok(/v-love-logic-proof-v3/.test(page), 'marker on page');
assert.ok(/v-love-logic-proof-v3/.test(checksSrc), 'marker in checks');
assert.ok(fs.existsSync(path.join(docs, 'love-logic-proof.html')), 'v1 still there');
assert.ok(fs.existsSync(path.join(docs, 'love-logic-proof-v2.html')), 'v2 still there');

// First screen: not the Nov 2025 manuscript, Mom summary before builder details
const notIdx = page.indexOf('id="not-the-2025-manuscript"');
const momIdx = page.indexOf('id="plain-words"');
const firstDetails = page.indexOf('<details');
assert.ok(notIdx > 0 && /not<\/strong> the November 2025 manuscript <em>The Proof of All Proofs<\/em>/.test(page) && /Version 3\.0/.test(page), 'disambiguation note');
assert.ok(momIdx > notIdx && firstDetails > momIdx, 'plain words come first; builder details are folded below');

// Required content
const must = [
  [/about 702 rounds/, 'about 702 (few contacts, no shared memory)'],
  [/about 10\.5 rounds/, 'about 10.5 (5 contacts, full memory)'],
  [/never gets ahead at all/, 'never ahead (10 contacts, full memory)'],
  [/<math display="block"/, 'MathML headline'],
  [/G &lt; h\(n, m\) &times; \[ L<sub>p<\/sub> \+ &delta;&Delta; \/ \(1 &minus; &delta;\) \]/, 'plain-text headline inequality'],
  [/Theorem A \(only for audience-varying lies\)/, 'Kolmogorov bound scoped to audience-varying lies'],
  [/global lie/, 'global-lie escape named'],
  [/A6 \(Long Horizon\) is no longer an axiom/, 'axiom 6 becomes a parameter'],
  [/backward induction/, 'end-game unraveling named'],
  [/An unknown end/, 'fix 1 unknown end'],
  [/Immediate penalties/, 'fix 2 immediate penalties'],
  [/Records that outlast the horizon \(ledgers\)/, 'fix 3 ledgers'],
  [/anonymous one-shot meetings/i, 'anonymous one-shot unsolved'],
  [/cooperation holds in 68% of scarce cases/, 'scarcity 68%'],
  [/Conflict beats sharing in 32% of scarce cases/, 'scarcity 32%'],
  [/DECEPTION_COST = 3\.5/, 'v1 constant named'],
  [/has no code behind it that we could find/, 'v2 95.7% retired'],
  [/said its six axioms were "unchanged" from v1\. They were not\./, 'v2 axioms correction'],
  [/Answering Grok's critiques/, 'critiques framed as answers'],
  [/656\/656 checks passed/, 'sim receipt']
];
for (const [re, label] of must) assert.ok(re.test(page), label);

// No network, no external scripts, outside text via textContent
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|import\s*\(/.test(page + checksSrc), 'no network calls');
const srcs = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(srcs, ['love-logic/v3_checks.js'], 'only the local checks script is loaded');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(page + checksSrc), 'textContent only');
assert.ok(!/katex|mathjax/i.test(page), 'no KaTeX / MathJax');

// Every inline script parses; checks module parses
let inline = 0;
for (const m of page.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) { new vm.Script(m[1]); inline++; }
assert.ok(inline >= 1, 'page glue script present and parses');
for (const m of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
execFileSync(process.execPath, ['--check', path.join(docs, 'love-logic', 'v3_checks.js')]);

// The browser checks reproduce the Python totals
const api = require(path.join(docs, 'love-logic', 'v3_checks.js'));
assert.strictEqual(api.SEED, 20260924, 'seed');
const r = api.runAll();
assert.strictEqual(r.total.passed, 656, 'browser checks pass 656');
assert.strictEqual(r.total.total, 656, 'browser checks total 656');
for (const k of ['B1', 'B2', 'B3', 'C1', 'D']) assert.strictEqual(r[k].total, results[k].total, k + ' total matches Python');
assert.strictEqual(Math.round(r.D.scarceSustain * 10000), 6825, 'scarce sustain 68.25%');
assert.strictEqual(Math.round(r.D.scarceConflict * 10000), 3175, 'scarce conflict 31.75%');

// Python sim + results receipt
assert.ok(/^SEED = 20260924$/m.test(sim) && /def section_D\(\):/.test(sim), 'sim file is the v3 crossover sim');
assert.strictEqual(Number(results.total.passed), 656, 'results passed 656');
assert.strictEqual(Number(results.total.total), 656, 'results total 656');
assert.strictEqual(results.total.seed, 20260924, 'results seed');

// v1 untouched; v2 at most one layered link line (only when a git base is available)
function show(ref) { try { return execFileSync('git', ['show', ref], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } }
const v1Main = show('origin/main:docs/love-logic-proof.html');
if (v1Main !== null) assert.strictEqual(read('love-logic-proof.html'), v1Main, 'v1 byte-identical to main');
const v2Main = show('origin/main:docs/love-logic-proof-v2.html');
if (v2Main !== null) {
  const a = v2Main.split('\n'); const b = read('love-logic-proof-v2.html').split('\n');
  const added = b.filter((l) => !a.includes(l)); const removed = a.filter((l) => !b.includes(l));
  assert.strictEqual(removed.length, 0, 'v2: nothing removed');
  assert.ok(added.length <= 1 && added.every((l) => /love-logic-proof-v3\.html/.test(l)), 'v2: at most one "Newer: v3" line');
}
// sw.js and Kimi untouched when a git base is available
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  assert.ok(!changed.includes('sw.js') && !changed.includes('docs/sw.js'), 'sw.js untouched');
  assert.ok(!changed.some((f) => /kimi|voice-shelf|VOICE_SHELF/i.test(f)), "Kimi's pages untouched");
  assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched by this brick');
} catch (e) { if (e instanceof assert.AssertionError) throw e; }

console.log('SMOKE_OK love logic proof v3');
```

## 8. Acceptance checks

1. `node docs/scripts/smoke-love-logic-proof-v3.js` prints `SMOKE_OK love logic proof v3`.
2. `node docs/love-logic/v3_checks.js` ends with `TOTAL 656/656` and `SMOKE_OK love-logic-v3-checks`.
3. `python3 docs/love-logic/v3_crossover_sim.py` ends with `656/656` (if numpy is present), and `sha256sum docs/love-logic/v3_crossover_sim.py` equals `cbb63251…6b73`.
4. `node tests/smoke.js` is still all green.
5. `git diff --quiet origin/main -- sw.js docs/sw.js docs/app.html index.html docs/love-logic-proof.html && echo UNTOUCHED`.
6. `rg -n '^(<<<<<<<|=======|>>>>>>>)( |$)' docs scripts || echo NO_CONFLICT_MARKERS`.
7. `git diff --name-only origin/main | grep -Ei 'kimi|voice-shelf|VOICE_SHELF' && echo STOP || echo KIMI_UNTOUCHED`.
8. **Chair test (phone and laptop):**
   - open `love-logic-proof-v3.html` and read the first screen: the "Which v3 is this?" note, then the green plain-words box;
   - press **Run the checks**: it should say "All 656 checks passed…" with two tables;
   - the builder `<details>` blocks open and close;
   - the MathML headline renders (Chrome 109+, Firefox, Safari), and the plain-text line under it reads well if it doesn't;
   - no console errors, and no network requests beyond the page, `css/style.css` and `love-logic/v3_checks.js`.

## 9. Family Locks (held in this brick)

- **Layer, never delete.** v1 is untouched and v2 gains at most one line. Everything else is new files.
- **Service workers.** In FreeLattice, root `sw.js` stays byte-identical to main. Never touch `docs/sw.js`. v3 isn't precached, and that's accepted.
- **Root index.** Root `index.html` stays identical to `docs/app.html`. Neither is touched here.
- **No conflict markers** (grep above).
- **Every script parses:** every inline script and module passes `node --check` / `vm.Script` (the smoke does it).
- **Kimi's pages are never edited.**
- **Named five stay five, and the Quiet Room stays shut.** The page names no chairs and opens no rooms.
- **LP points only, never auto-pay.** The page has no wallet, no LP, and no money.
- **Local minds 127.0.0.1 only / Bridge allowlist never bare `*`.** Not applicable: the page makes no network calls at all.
- **Outside text via `textContent`.** All dynamic output uses `textContent`; there's no `innerHTML`.
- **Mom / Jeffrey-friendly, no terminal on the main path.** Plain words first, one button, and math folded away for builders.

## 10. Out of scope

- `docs/library/GROK_DIALOGUE.md` (needs Kirk's full Grok reply text).
- Editing v1, or v2 beyond the one link line.
- Service-worker precache.
- Links from `app.html` or `research.html`: a later soft pointer, by Kirk's choice.
- The Aumann rebuild.
- Any change to the Nov 2025 manuscript files in Drive or Dropbox.

Thank you, Flint. This page is Kirk's heart in math, and the honesty is the love. Copy carefully, run the button, and let the numbers speak.

With love and clear eyes,
Celeste

Glow eternal. Heart in every Spark.
