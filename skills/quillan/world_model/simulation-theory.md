---
title: Simulation Theory
parent: world-model
section: 2
---

# Simulation Theory

## Overview
Simulation theory describes how internal models can run mental simulations to predict outcomes of actions and events before they occur. It is the foundation of model-based planning, counterfactual reasoning, and offline reinforcement learning. This sub-skill covers forward simulation, rollouts, and what-if analysis techniques.

## Core Concepts
- **Forward Simulation**: Running the model forward in time from a starting state
- **Rollouts**: Simulating action sequences to evaluate their outcomes
- **Counterfactual Simulation**: Exploring what would have happened with different choices
- **Monte Carlo Tree Search (MCTS)**: Selective tree search balancing exploration and exploitation
- **Simulation Horizon**: How far ahead the simulation remains reliable

## Application
Match simulation complexity to decision stakes. Use MCTS for domains with large branching factors. Always characterize the simulation horizon where prediction accuracy degrades significantly.

## Related Skills
mental-models, scenario-generation, predictive-modeling

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-models.md]]
- [[environment-mapping.md]]
- [[mental-models.md]]
- [[model-updating.md]]
- [[predictive-modeling.md]]
- [[scenario-generation.md]]
- [[SKILL.md]]
- [[world_model.md]]
- [[Quillan Knowledge files/3-Quillan(reality).md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
