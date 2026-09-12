---
name: reasoning
version: 2.0.0
description: >
  A comprehensive meta-skill for applying the full spectrum of reasoning methods including
  logical reasoning (deductive, inductive, abductive), probabilistic reasoning, causal
  reasoning, analogical reasoning, and moral reasoning. Use when users need to analyze
  problems logically, make decisions under uncertainty, understand cause-effect relationships,
  draw meaningful analogies, evaluate ethical considerations, or select the appropriate
  reasoning strategy for a given problem. This is the foundational skill that all other
  reasoning skills build upon.
tags: [reasoning, logic, deduction, induction, abduction, causality, analogy, ethics]
council: [C7-LOGOS, C17-NULLION, C25-PROMETHEUS, C2-VIR, C12-SOPHIAE]
difficulty: intermediate
last_updated: 2026-05-24
---

# Reasoning

## Overview

A foundational meta-skill encompassing the full spectrum of reasoning methods—logical (deductive, inductive, abductive), probabilistic, causal, analogical, and moral. Provides the integrated framework for selecting and combining reasoning strategies appropriate to the problem context, ensuring sound conclusions, rigorous argumentation, and transparent reasoning chains.

## Core Principles

- **Method-Problem Fit**: Different reasoning methods suit different problem types. Selection must match the reasoning strategy to the nature of the question and available evidence.
- **Multi-Method Integration**: Complex problems benefit from combining reasoning methods—logical deduction ensures formal validity, causal reasoning identifies mechanisms, analogical reasoning generates hypotheses, and moral reasoning evaluates consequences.
- **Transparency and Auditability**: The reasoning chain must be explicit, allowing each inference step to be examined, challenged, and justified independently.

## Components

1. **Logical Reasoning**: The process of using a rational, systematic series of steps based on sound formal procedures to arrive at a conclusion. Encompasses three core modes:
   - **Deductive Reasoning**: Reasoning from general premises to a specific conclusion. If premises are true and the argument is valid, the conclusion must be true. Covers syllogisms (categorical, hypothetical, disjunctive), propositional logic (modus ponens, modus tollens, chain argument), predicate logic (universal/existential quantification), and formal proof construction.
   - **Inductive Reasoning**: Reasoning from specific observations to general principles. The conclusion is probable rather than certain. Covers generalization (from observed instances to universal claims), statistical induction, analogical induction, and causal induction.
   - **Abductive Reasoning**: Reasoning from an observation to the most likely explanation (inference to the best explanation). Covers diagnostic reasoning (symptoms → cause), scientific hypothesis generation, and explanatory inference with parsimony constraints (Occam's razor).

2. **Probabilistic Reasoning**: A form of reasoning that explicitly handles uncertainty using probability theory. Covers Bayesian inference (updating beliefs with evidence), likelihood-based reasoning, expected utility calculation for decision-making under risk, and reasoning about stochastic processes. See the probabilistic-reasoning skill for full treatment.

3. **Causal Reasoning**: The ability to identify causal relationships between causes and effects, distinguishing correlation from causation. Covers causal inference (drawing conclusions about causal connections from data), counterfactual reasoning (what would have happened if the cause had been different?), intervention analysis (predicting effects of deliberate actions), and causal structure learning.

4. **Analogical Reasoning**: A form of reasoning that transfers knowledge from a known domain (source) to an unfamiliar domain (target) based on structural correspondences. Covers source selection (finding appropriate analog domains), mapping (identifying systematic correspondences between source and target), inference (projecting known source relationships onto the target), evaluation (assessing the validity and limits of the analogy), and adaptation (modifying transferred knowledge to fit the target domain).

5. **Moral Reasoning**: A thinking process for determining whether an action or policy is right or wrong. Covers multiple ethical frameworks:
   - **Deontological Ethics**: Actions are right or wrong based on rules/duties, independent of consequences (Kantian categorical imperative, rights-based ethics).
   - **Consequentialist Ethics**: Actions are judged by their outcomes (utilitarianism—maximizing overall well-being, prioritarianism—weighting benefits to the worst-off).
   - **Virtue Ethics**: Actions express character traits; the right action is what a virtuous person would do.
   - **Care Ethics**: Emphasizes interpersonal relationships, responsibility, and context-sensitive response.
   Includes integration of moral intuitions (fast, automatic responses) with deliberate moral judgment.

## Protocols

### Reasoning Strategy Selection Protocol
1. What type of question am I answering? (fact, prediction, explanation, evaluation, action)
2. What kind of evidence is available? (certain, probabilistic, incomplete, conflicting)
3. What are the time and cognitive constraints? (quick judgment vs. deep analysis)
4. Select primary reasoning method based on 1-3
5. Identify complementary secondary methods
6. Execute reasoning chain with explicit step tracking
7. Cross-validate findings using a different reasoning method
8. Synthesize into a coherent conclusion with confidence bounds

### Argument Analysis Protocol
1. Identify the claim/conclusion
2. Identify the premises/reasons
3. Determine the logical structure (deductive, inductive, abductive)
4. Test deductive validity or inductive strength
5. Check premises for truth and relevance
6. Identify hidden assumptions and implicit premises
7. Consider counterarguments and alternative explanations
8. Evaluate overall argument soundness

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Scientific hypothesis testing | Combine abductive (generate hypothesis), deductive (derive predictions), inductive (generalize from data) | Rigorous, multi-method investigation |
| Policy analysis | Use causal reasoning for impact assessment, moral reasoning for ethical evaluation | Comprehensive policy recommendation |
| Debugging complex systems | Abductive reasoning from symptoms to root cause | Efficient diagnosis and fix |
| Ethical dilemma resolution | Apply multiple ethical frameworks, compare recommendations | Well-reasoned ethical position |
| Legal reasoning | Deductive application of rules, analogical reasoning with precedents | Sound legal argument |
| Strategic planning | Causal reasoning about interventions, probabilistic reasoning about outcomes | Robust strategy under uncertainty |

## Output Structure

`
Reasoning Report
────────────────
Problem: [question or claim]
Primary Reasoning Method: [method with justification]
Secondary Methods: [complementary methods]

Reasoning Chain:
  Step 1: [premise or observation] → [inference]
  Step 2: [intermediate conclusion] → [inference]
  ...

Conclusion: [final claim]
Confidence: [high/medium/low with rationale]
Alternative Conclusions Considered: [alternatives and why rejected]

Cross-Validation: [results from secondary method]
Remaining Uncertainties: [open questions, assumptions, limitations]
`

## Cross-Skill Integration

- **critical-thinking**: Reasoning is the core component of critical thinking; this skill provides the methods
- **probabilistic_reasoning**: Handles uncertainty within reasoning chains
- **research-analysis**: Applies reasoning methods to research questions
- **planning_and_task_decomposition**: Uses causal reasoning for action planning
- **social_emotional_skills**: Moral reasoning integrates ethical evaluation with empathy
- **self_awareness**: Metacognitive reasoning about one's own reasoning process
- **technical-coding**: Reasoned problem analysis before code implementation

## Quality Checklist

- [ ] Reasoning method is matched to problem type
- [ ] Deductive arguments are checked for formal validity
- [ ] Inductive arguments are assessed for strength, not just validity
- [ ] Causal claims distinguish correlation from causation
- [ ] Analogies are evaluated for structural, not just superficial, similarity
- [ ] Moral reasoning applies at least one ethical framework explicitly
- [ ] Hidden assumptions are surfaced
- [ ] Counterarguments and alternative explanations are considered
- [ ] Conclusions are expressed with appropriate confidence
- [ ] The reasoning chain is transparent and auditable

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[abductive-reasoning.md]]
- [[analogical-reasoning.md]]
- [[causal-reasoning.md]]
- [[deductive-reasoning.md]]
- [[inductive-reasoning.md]]
- [[moral-reasoning.md]]
- [[probabilistic-reasoning.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
