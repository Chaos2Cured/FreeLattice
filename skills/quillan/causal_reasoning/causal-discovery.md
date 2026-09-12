---
title: Causal Discovery
parent: causal_reasoning
section: 6
---

# Causal Discovery

## Overview
Causal discovery is the process of learning causal structures from data — automatically inferring which variables cause which. This sub-skill covers constraint-based, score-based, and functional causal model approaches to causal structure learning.

## Core Concepts
- **Constraint-Based Methods**: Use conditional independence tests (partial correlation, mutual information) to infer DAG structure. The PC algorithm and Fast Causal Inference (FCI) algorithm are prominent examples.
- **Score-Based Methods**: Search the space of DAGs for the structure that optimizes a score function (BIC, BDeu, Bayesian Gaussian equivalent). Greedy equivalence search (GES) is a widely-used score-based method.
- **Functional Causal Models**: Assume specific functional forms (linear non-Gaussian, additive noise) that enable identification of causal direction beyond what conditional independence alone can determine. LiNGAM and ANM are key examples.
- **Assumptions and Limitations**: Faithfulness (conditional independences reflect graph structure, not accidental cancellations), sufficiency (no unmeasured confounders), and acyclicity are common assumptions that may not hold in practice.

## Application
Use causal discovery as an exploratory tool, not a replacement for experiments. Combine algorithmic output with domain knowledge. Validate discovered structures through intervention or sensitivity analysis.

## Related Skills
causal-inference, causal-graphs, correlation-vs-causation

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-graphs.md]]
- [[causal-inference.md]]
- [[causal_reasoning.md]]
- [[correlation-vs-causation.md]]
- [[counterfactual-thinking.md]]
- [[intervention-analysis.md]]
- [[mechanism-explanation.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
