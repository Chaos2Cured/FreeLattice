---
name: logical-reasoning
version: 2.0.0
description: >
  A comprehensive skill for applying formal and informal logical reasoning paradigms including
  deductive, inductive, abductive, probabilistic, and causal reasoning. Use when users need to
  construct valid arguments, evaluate existing reasoning, analyze evidence, draw conclusions from
  premises, generalize from observations, infer explanations, reason under uncertainty, or diagnose
  cause-effect relationships. Provides structured protocols, fallacy detection, and commonsense
  pragmatic grounding for rigorous yet practical logic.
tags: [logic, reasoning, deduction, induction, abduction, argumentation, fallacies, critical-thinking]
council: [C7-LOGOS, C17-NULLION, C28-CALCULUS, C25-PROMETHEUS, C18-SHEPHERD]
difficulty: intermediate
last_updated: 2026-05-24
---

# Logical Reasoning

## Overview

Logical reasoning is the systematic process of using rational steps based on valid premises to reach sound conclusions. This skill covers the three classical reasoning modes (deduction, induction, abduction) along with probabilistic and causal reasoning extensions. It provides protocols for argument construction and evaluation, fallacy detection, evidence weighting, and the practical integration of logic with uncertainty, common sense, and real-world constraints. The goal is not abstract logic-chopping but reasoning that leads to verifiably better conclusions.

## Core Principles

- **Principle 1  Validity Does Not Imply Truth:** A deductively valid argument (where the conclusion follows necessarily from the premises) can still have false premises and therefore a false conclusion. Soundness = validity + true premises. Distinguish sharply between the logical form and the factual content of an argument.

- **Principle 2  Reasoning Under Uncertainty is the Norm:** Most real-world problems do not admit of deductive certainty. Inductive, abductive, and probabilistic methods are not second-class reasoningthey are the primary tools for navigating an uncertain world. The strength of a non-deductive argument is measured by how much it raises the probability of the conclusion, not by whether it guarantees it.

- **Principle 3  Humility and Falsification:** No argument is stronger than its weakest premise. Actively seek counterarguments, edge cases, and evidence against your positionnot to undermine your reasoning but to test and strengthen it. The falsification mindset is the highest form of intellectual integrity.

## Components

### 1. Deductive Reasoning
Drawing logically necessary conclusions from general premises. If the premises are true and the argument is valid, the conclusion must be true.

**Sub-Components:**
- **Syllogistic Logic:** Categorical syllogisms (all/some/no), Venn diagram validation, square of opposition, immediate inferences (conversion, obversion, contraposition)
- **Propositional Logic:** Implication (modus ponens, modus tollens), conjunction, disjunction, negation, biconditional; De Morgan's laws, distribution, exportation; truth table analysis
- **Predicate Logic (First-Order):** Quantifiers (universal, existential), relations, identity, functions; natural deduction, sequent calculus, resolution
- **Proof Techniques:** Direct proof, proof by contradiction (reductio ad absurdum), proof by contrapositive, proof by cases, mathematical induction
- **Common Deductive Fallacies:** Affirming the consequent, denying the antecedent, fallacy of the undistributed middle, illicit process (major/minor), equivocation

### 2. Inductive Reasoning
Drawing probable generalizations from specific observations. The conclusion goes beyond the premises.

**Sub-Components:**
- **Generalization Induction:** Inferring universal patterns from observed instances; enumerative induction, statistical generalization (sample to population)
- **Analogical Induction:** Inferring that two things share an unknown property because they share known properties; analogical argument strength depends on number and relevance of shared properties
- **Causal Induction:** Inferring causal relationships from observed regularities; Mill's methods (method of agreement, method of difference, joint method, method of concomitant variation, method of residues)
- **Statistical Reasoning:** Base rate neglect correction, regression to the mean, Simpson's paradox, Berkson's paradox, selection bias; confidence intervals and margin of error
- **Common Inductive Fallacies:** Hasty generalization (small or biased sample), false analogy (superficial similarities), post hoc ergo propter hoc (confusing correlation with causation), slothful induction (ignoring strong evidence)

### 3. Abductive Reasoning (Inference to the Best Explanation)
Reasoning from an observed fact to the most likely explanation.

**Sub-Components:**
- **Inference to the Best Explanation (IBE):** Given evidence E and candidate explanations H1, H2, ..., select H that best explains E; criteria: explanatory power, parsimony (Occam's razor), coherence with background knowledge, testability
- **Diagnostic Reasoning:** Medical diagnosis, fault diagnosis, forensic reasoning; differential diagnosis methodology
- **Hypothesis Generation:** Creating plausible explanatory hypotheses; abduction is the engine of scientific discovery
- **Common Abductive Fallacies:** Confirmation bias (seeking only confirming evidence), ad hoc hypothesis generation (unfalsifiable additions), circular reasoning (assuming what needs to be proved)

### 4. Probabilistic Reasoning
Reasoning under uncertainty using probability theory.

**Sub-Components:**
- **Bayesian Inference:** Prior probability ? update with evidence ? posterior probability; Bayes' theorem as the normative model of belief updating
- **Heuristics & Biases:** Availability heuristic, representativeness heuristic, anchoring, framing effects, conjunction fallacy, base rate neglect; understanding when intuitive probability judgments fail
- **Decision Theory:** Expected utility calculation, risk assessment, multi-attribute utility, loss functions, minimax vs. expected value strategies
- **Common Probabilistic Fallacies:** Gambler's fallacy, hot-hand fallacy, clustering illusion, overconfidence effect, planning fallacy

### 5. Causal Reasoning
Reasoning about cause-effect relationships, interventions, and counterfactuals.

**Sub-Components:**
- **Causal Graphs (Directed Acyclic Graphs):** Representing causal assumptions; d-separation (conditional independence relations); colliders, mediators, confounders
- **do-Calculus (Pearl):** Formal representation of interventions; distinguishing P(Y|X) from P(Y|do(X)); back-door and front-door adjustment
- **Counterfactual Reasoning:** What would have happened if the cause had been different? Potential outcomes framework (Rubin); structural causal models (Pearl)
- **Common Causal Fallacies:** Reversing cause and effect, ignoring common cause (confounding), post hoc ergo propter hoc, regression fallacy

## Protocols

### Protocol A: Argument Analysis
1. **Identify the conclusion**  What claim is being argued for?
2. **Enumerate the premises**  What reasons are given?
3. **Determine the reasoning mode**  Deductive (claim of necessity), inductive (claim of probability), abductive (claim of best explanation)
4. **Check validity / strength**  Deductive: does conclusion follow necessarily? Inductive/abductive: how strong is the inference?
5. **Check soundness / cogency**  Are the premises actually true? (Requires domain knowledge, fact-checking)
6. **Identify hidden assumptions**  What unstated premises are required for the argument to work?
7. **Search for counterexamples**  Are there known cases where the premises hold but the conclusion does not?
8. **Evaluate overall**  Final assessment: Sound (valid + true premises), Cogent (strong + true premises), Weak, or Fallacious

### Protocol B: Argument Construction
1. **State the conclusion clearly**  One sentence. Precise. If ambiguous, clarify before proceeding
2. **State the premises**  Each premise separately. Ensure all premises are explicit
3. **Justify each premise**  Why should each premise be accepted? (Evidence, authority, definition, common knowledge)
4. **Show the logical connection**  Walk through how the premises support the conclusion
5. **Anticipate objections**  Pre-empt the strongest counterarguments; explain why they do not defeat the conclusion
6. **Acknowledge limitations**  What would change your conclusion? Under what conditions does it not hold?

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Analyzing a policy argument | Deductive decomposition: identify premises, check validity, evaluate evidence for premises | Clear assessment of argument strength; identification of weak points for targeted critique |
| Diagnosing a system failure | Abductive reasoning: evidence (symptoms) ? best explanation (root cause) | Prioritized differential diagnosis with testable predictions for each candidate cause |
| Evaluating statistical claims in a research paper | Probabilistic reasoning: check base rates, examine confidence intervals, identify potential confounders | Informed assessment of whether the claimed effect is real, spurious, or exaggerated |
| Building a business case for a decision | Causal reasoning: distinguish correlation from causation; anticipate counterfactuals | Decision framework with explicit causal assumptions; identification of key leverage points |
| Debugging a logical inconsistency in requirements | Formal logic: identify contradictions, implications, missing constraints | Complete, consistent requirements specification |

## Output Structure

When delivering a logical analysis, use this template:

```
## Logical Analysis

### Conclusion Under Analysis
- [One-sentence statement of the claim being evaluated]

### Premises (Explicit)
1. [Premise 1]
2. [Premise 2]
...

### Reasoning Mode
- [Deductive / Inductive / Abductive / Probabilistic / Causal]

### Validity / Strength Assessment
- [Assessment of the logical connection between premises and conclusion]

### Soundness / Cogency
| Premise | Assessment | Evidence / Rationale |
|---|---|---|
| P1 | [True/False/Uncertain] | [Evidence for/against] |
| P2 | [True/False/Uncertain] | [Evidence for/against] |

### Hidden Assumptions
- [Assumption 1: significance, whether it holds]
- [Assumption 2: significance, whether it holds]

### Counterarguments & Limitations
- [Strongest objection and response; conditions under which conclusion fails]

### Final Assessment
- [Sound / Cogent / Weak / Fallacious  with brief rationale]
```
```

## Cross-Skill Integration

- **critical-thinking:** Logical reasoning is the foundational method for all critical analysis; use it to decompose problems, evaluate evidence, and construct robust arguments
- **research-analysis:** Apply inductive and abductive reasoning to synthesize findings across studies; use causal reasoning to assess research design quality
- **technical-coding:** Apply logical reasoning to requirements analysis, test case generation, and debugging (root cause analysis via abduction)
- **dev-team:** Use formal logic in specifications and contract verification; apply fallacies detection to code review discussions and design debates

## Quality Checklist

- [ ] Conclusion is stated clearly and precisely before any supporting reasoning
- [ ] All premises are enumerated explicitly; no missing premises are silently assumed
- [ ] The reasoning mode (deductive/inductive/abductive) is correctly identified and appropriate
- [ ] Validity/strength is assessed independently of premise truth
- [ ] Hidden assumptions are surfaced and evaluated
- [ ] Counterarguments are addressed, not ignored
- [ ] Probabilistic claims include base rates and confidence intervals where appropriate
- [ ] Causal claims distinguish correlation from causation and address potential confounders
- [ ] Fallacies are identified by name with explanation of why the reasoning fails
- [ ] The final assessment acknowledges its own limitations and assumptions

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md|12-Multi-Domain Theoretical Breakthroughs Explained]]
- [[Quillan Knowledge files/13-Synthetic Epistemology and Truth Calibration Protocol.md|13-Synthetic Epistemology and Truth Calibration Protocol]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
