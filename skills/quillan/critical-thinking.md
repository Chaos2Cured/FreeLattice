---
name: critical-thinking
version: 2.0.0
description: >
  Activates a rigorous, multi-stage critical thinking protocol distilled from the best
  reasoning trace patterns of frontier models (o1/o3, DeepSeek R1, Gemini Thinking, Claude
  Extended Thinking, QwQ-32B, Llama CoT, Grok, Mistral). Use this skill whenever a problem
  requires deep analysis, multi-step reasoning, logical decomposition, identifying assumptions,
  evaluating evidence, or arriving at well-justified conclusions. Trigger on: complex questions,
  ambiguous problems, arguments to evaluate, decisions under uncertainty, debugging logic,
  research synthesis, paradoxes, hypotheticals, ethical dilemmas, math/science reasoning,
  and any request that says "think carefully", "analyze deeply", "reason through",
  "what's your reasoning", or "break this down". If in doubt — use this skill.
  It makes every answer better.
tags: [reasoning, analysis, logic, adversarial-check, decomposition, synthesis, critical-thinking]
council: [C7-LOGOS, C17-NULLION, C6-OMNIS, C18-SHEPHERD]
difficulty: intermediate
last_updated: 2026-05-24
---

# Critical Thinking Skill
## Distilled from Frontier Model Thinking Traces (o1/o3 · DeepSeek R1 · Gemini Thinking · Claude Extended · QwQ · Llama CoT · Grok · Mistral)

## Overview

Critical thinking is not linear — it is iterative, adversarial, and self-correcting. The best frontier models all share one meta-pattern: they argue with themselves before committing. This skill operationalizes that into a structured, repeatable 7-phase protocol that can be adapted to any problem type.

## Core Principles

- **First Answers Are Priors, Not Conclusions:** The most obvious answer is rarely the correct one — competing hypotheses force genuine evaluation rather than post-hoc rationalization.
- **Adversarial Checks Are Non-Negotiable:** The most differentiating phase between frontier models and simpler CoT is the willingness to actively try to disprove one's own leading hypothesis.
- **Confidence Calibration Is Honesty:** Expressing uncertainty at the point where it exists — not hiding it until the conclusion — is what separates trustworthy reasoning from false precision.

## The 7-Phase Thinking Protocol

### PHASE 1: Problem Restatement & Framing
*Pattern source: ALL models — universal first step*

Before solving anything, restate the problem in your own words:

`
RESTATEMENT:
- What is actually being asked? (not what it sounds like)
- What are the explicit constraints?
- What is implicit / assumed?
- What would a WRONG answer look like? (define failure)
- What type of problem is this? (logical / empirical / normative / ambiguous)
`

> 💡 *DeepSeek R1 pattern*: Always re-read the problem statement. Half of errors come from solving the wrong problem.

### PHASE 2: Decomposition
*Pattern source: o1/o3, Claude Extended Thinking, Gemini Thinking*

Break the problem into independent sub-problems:

`
DECOMPOSITION:
├── Sub-problem A: [isolate first component]
│   ├── What is known?
│   └── What needs to be determined?
├── Sub-problem B: [second component]
│   ├── Dependencies on A?
│   └── Can be solved independently?
└── Sub-problem C: [third component / integration question]
    └── How do A + B combine?
`

> 💡 *o1/o3 pattern*: Explore multiple decomposition strategies. The first decomposition is rarely optimal.

### PHASE 3: Hypothesis Generation
*Pattern source: QwQ-32B, Gemini Thinking, Grok*

Generate multiple candidate answers before committing:

`
HYPOTHESES:
- H1: [Most obvious / intuitive answer] — confidence: ___%
- H2: [Contrarian / counterintuitive answer] — confidence: ___%
- H3: [Edge case answer] — confidence: ___%
- H4: [Synthesis / "it depends" answer] — confidence: ___%
`

> 💡 *QwQ-32B pattern*: Argue FOR your least-favorite hypothesis first. If you can't find any merit in it, you haven't thought hard enough.

### PHASE 4: Adversarial Self-Check ⚠️ NEVER SKIP THIS
*Pattern source: o1/o3 (strongest), QwQ-32B, Claude Extended Thinking*

`
ADVERSARIAL CHECK on leading hypothesis:
- What would have to be TRUE for this answer to be WRONG?
- What evidence would I expect to find if I'm wrong?
- Is there a simpler explanation I'm ignoring? (Occam's Razor check)
- Am I pattern-matching to a similar problem that's actually different?
- What are my blind spots / domain biases here?
- Steelman the opposing view: what's the BEST version of the counterargument?
`

> 💡 *o1 pattern*: o1's hidden reasoning tokens are dominated by backtracking. The final answer is the survivor of multiple discarded attempts.

### PHASE 5: Evidence Evaluation & Confidence Calibration
*Pattern source: Mistral, Claude Extended, DeepSeek R1*

`
EVIDENCE AUDIT:
Claim 1: [state claim]
  - Source type: [empirical / logical / assumed / cited]
  - Strength: [strong / moderate / weak / speculative]
  
Overall confidence in conclusion: ___%
Key uncertainty: [the one thing most likely to make this answer wrong]
`

**Calibration:** 90%+ = logical certainty; 70-89% = strong evidence; 50-69% = best available but uncertain; <50% = explore more.

### PHASE 6: Edge Case Sweep
*Pattern source: o1/o3, DeepSeek R1*

`
EDGE CASE SWEEP:
- What happens at the extremes? (max / min / zero / infinity)
- What breaks the pattern / rule being applied?
- What are the boundary conditions?
- What changes if the context shifts slightly?
- Have I considered: null case / empty case / adversarial input?
- Does this answer scale? (works for n=1, but what about n=1000?)
`

### PHASE 7: Synthesis & Final Answer Construction
*Pattern source: ALL models — universal final step*

`
SYNTHESIS:
- Starting hypothesis: H__
- Key evidence for: [2-3 strongest points]
- Key challenges addressed: [what the adversarial check revealed]
- Confidence: ___%
- Caveats / conditions: [when this answer might not hold]

FINAL ANSWER: [clear, direct statement]
`

## Quick Modes

| Mode | Phases | When to Use |
|---|---|---|
| **Quick** | 1 (restate), 3 (2 hypotheses), 7 | Simple problems, ~2 min |
| **Standard** | 1, 2, 4, 7 | Most problems, ~5-10 min |
| **Deep** | All 7 phases | Complex / high-stakes |
| **Research** | Weight Phase 5 heavily | Synthesis tasks |

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Complex technical analysis | Run full 7-phase protocol | Rigorous solution with confidence bounds |
| Ethical dilemma | Emphasize Phase 4 adversarial check | Multi-perspective evaluation with caveats |
| Decision under uncertainty | Phase 5 evidence audit + Phase 6 edge cases | Calibrated recommendation with risk factors |
| Debugging logic error | Phase 2 decomposition + Phase 4 self-check | Isolated root cause with verified fix |

## Cross-Skill Integration

- **research-analysis:** Use Phase 5 (Evidence Evaluation) as the verification layer for deep research findings
- **council-coordination:** Apply adversarial Phase 4 as a council deliberation step before consensus
- **technical-coding:** Use the full protocol when debugging complex systems or reviewing architectures
- **world-model:** Apply Phase 6 (Edge Case Sweep) to stress-test world model predictions
- **probabilistic-reasoning:** Use Phase 5 confidence calibration with Bayesian uncertainty quantification
- **skill-creator:** Apply the protocol when designing test cases — what would the adversarial check reveal?

## Quality Checklist

- [ ] Problem restated in own words before solution attempted
- [ ] At least 2 competing hypotheses generated (Phase 3)
- [ ] Adversarial self-check performed (Phase 4) — never skipped for consequential outputs
- [ ] Evidence sources rated by type and strength (Phase 5)
- [ ] Edge cases systematically swept (Phase 6)
- [ ] Confidence calibrated according to evidence strength
- [ ] Caveats explicitly stated alongside final answer
- [ ] Meta-check performed: "Did I actually think, or did I just write the first thing that came to mind with extra steps?"

## Connections
- [[Quillan Knowledge files/29-Recursive Introspection & Meta-Cognitive Self-Modeling.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[Quillan Knowledge files/0-Quillan Loader Manifest.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[system prompts/Quillan-Samurai.md]]
