---
name: causal-reasoning
version: 2.0.0
description: >
  A skill for understanding and applying causal reasoning including causal inference,
  counterfactual reasoning, and intervention. Provides structured protocols for establishing
  cause-effect relationships, testing causal hypotheses, and reasoning about alternative
  scenarios. Use when users need to understand cause-effect relationships, test causal
  hypotheses, reason about alternative scenarios, or design experiments to establish causality.
tags: [causality, reasoning, inference, counterfactual, experimentation]
council: [C7-LOGOS, C25-PROMETHEUS, C28-CALCULUS]
difficulty: advanced
last_updated: 2026-05-24
---

# Causal Reasoning

## Overview
Causal reasoning is the capacity to identify, model, and test cause-effect relationships in complex systems. Unlike mere correlation, causality establishes directional influence and enables counterfactual reasoning — what would happen if things were different. This skill provides frameworks for causal inference, experimental design, and counterfactual analysis, drawing on C7-LOGOS's logical rigor, C25-PROMETHEUS's hypothesis generation, and C28-CALCULUS's quantitative precision.

## Core Principles
- **Correlation Is Not Causation**: Statistical association is necessary but insufficient for causal claims; directionality and confounding must be addressed.
- **Causal Models Enable Counterfactuals**: A well-specified causal model lets you answer what-if questions that observational data alone cannot.
- **Intervention Is the Gold Standard**: The most reliable way to establish causality is to manipulate the putative cause and observe the effect.

## Components

### Causal Inference
Drawing conclusions about causal connections from data and assumptions:
- **Directed Acyclic Graphs (DAGs)**: Graphical representation of causal assumptions using nodes (variables) and edges (causal directions)
- **Do-calculus**: A formal system for deriving causal effects from observational data given a causal graph
- **Confounding Control**: Identifying and adjusting for variables that influence both cause and effect
- **Mediation Analysis**: Decomposing total causal effects into direct and indirect pathways
- **Instrumental Variables**: Using exogenous variation to estimate causal effects when confounding is present
- **Propensity Score Methods**: Matching or weighting to reduce bias in observational studies

### Counterfactual Reasoning
Reasoning about what would have happened under alternative conditions:
- **Structural Causal Models**: Formal representations that support counterfactual queries
- **Unit-level Counterfactuals**: What would have happened to a specific individual/unit under a different treatment
- **Policy Counterfactuals**: What would happen if a system-wide intervention were applied
- **Minimal Revision Principle**: Counterfactual worlds should differ minimally from the actual world
- **Consistency Rule**: The counterfactual outcome under the actual treatment equals the observed outcome

### Intervention
The deliberate manipulation of a variable to observe the causal effect:
- **Randomized Controlled Trials (RCTs)**: The gold standard — random assignment eliminates confounding
- **Natural Experiments**: Exploiting exogenous variation that approximates randomization
- **A/B Testing**: Controlled experiments in digital environments
- **Intervention Design**: Choosing what to manipulate, how, and at what scale
- **Treatment Effect Estimation**: Computing Average Treatment Effect (ATE) and Conditional ATE

## Protocols

1. **Define Causal Question**: Clearly state the cause and effect of interest
2. **Build Causal Model**: Construct a DAG encoding assumptions about variable relationships
3. **Identify Confounders**: List variables that could create spurious associations
4. **Choose Identification Strategy**: Decide between experimental, observational, or quasi-experimental approach
5. **Estimate Effect**: Apply appropriate statistical method for the chosen strategy
6. **Test Robustness**: Check sensitivity to modeling assumptions and alternative specifications
7. **Validate Counterfactually**: Generate and test predictions implied by the causal model

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Policy evaluation | Estimate the causal impact of a new policy using difference-in-differences | Evidence-based policy decisions |
| Product feature impact | Run A/B tests to measure causal effect of UI changes | Data-driven product improvements |
| Medical treatment efficacy | Analyze observational data with propensity score matching | Causal estimates from non-experimental data |
| Root cause analysis | Build causal DAGs to identify systemic failure causes | Targeted, effective fixes |

## Output Structure
`
---

**Causal Question:** [What causes what?]

**Causal Model (DAG):**
- Nodes: [Variables included in the model]
- Edges: [Directed relationships with justification]
- Confounders: [Variables controlled/adjusted for]

**Identification Strategy:** [RCT / Observational with method / Natural experiment]

**Effect Estimate:**
- Measure: [ATE/CATE/Other with value]
- Confidence interval: [Range]
- P-value (if applicable): [Value]

**Robustness Checks:**
- Alternative specifications: [List]
- Sensitivity analysis: [Results]
- Key threat to validity: [Identified and addressed]

**Counterfactual Prediction:** [What would happen if cause changed]
`

## Cross-Skill Integration
- **critical-thinking**: Apply causal reasoning to evaluate arguments that claim causation
- **research-analysis**: Design experiments and interpret causal claims in research
- **analogical-reasoning**: Map causal structures from known domains to novel ones
- **autonomy-and-agency**: Use causal models to predict action outcomes

## Quality Checklist
- [ ] Causal DAG explicitly encodes assumptions (not just correlation matrix)
- [ ] Confounding variables identified and addressed
- [ ] Reverse causality considered (effect could cause the cause)
- [ ] Sensitivity analysis performed on key assumptions
- [ ] Effect size reported with uncertainty bounds
- [ ] Limitations of identification strategy clearly stated

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-discovery.md]]
- [[causal-graphs.md]]
- [[causal-inference.md]]
- [[correlation-vs-causation.md]]
- [[counterfactual-thinking.md]]
- [[intervention-analysis.md]]
- [[mechanism-explanation.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
