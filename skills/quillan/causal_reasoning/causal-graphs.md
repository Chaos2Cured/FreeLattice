---
title: Causal Graphs
parent: causal_reasoning
section: 4
---

# Causal Graphs

## Overview
Causal graphs — specifically directed acyclic graphs (DAGs) — are the primary tool for representing and communicating causal assumptions. This sub-skill covers graph construction, interpretation of graphical criteria for causal identification, and the key concepts of d-separation, colliders, mediators, and confounders.

## Core Concepts
- **DAG Construction**: Each node is a variable; each directed edge represents a direct causal relationship. Edges must not form cycles (hence acyclic). Nodes with no incoming edges are exogenous; nodes with outgoing edges are endogenous.
- **d-Separation**: A graphical criterion for determining conditional independence. Two sets of nodes X and Y are d-separated by Z if all paths between X and Y are blocked by Z. Paths are blocked by (a) conditioning on a collider, or (b) not conditioning on a non-collider on the path.
- **Confounders, Mediators, Colliders**: Confounders (common causes of treatment and outcome) create spurious association. Mediators (intermediate variables on the causal path) convey indirect effects. Colliders (common effects of two variables) can create selection bias when conditioned on.
- **Markov Equivalence**: Different DAGs can imply the same conditional independence relationships. Directional ambiguity is resolved through experimental data, temporal information, or domain knowledge.

## Application
Always encode causal assumptions in a DAG before analysis. Use DAGs to identify which variables to control for and which to avoid controlling for (colliders). Share DAGs to communicate assumptions transparently.

## Related Skills
causal-inference, intervention-analysis, correlation-vs-causation

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-discovery.md]]
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
