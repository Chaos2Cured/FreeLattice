---
name: world-model
version: 2.0.0
description: >
  A comprehensive skill for creating and maintaining dynamic internal representations of the
  world including state estimation, predictive modeling, causal inference, and scenario
  simulation. Use when users need to simulate future events, predict action consequences,
  estimate hidden environmental states, understand causal relationships in complex systems,
  or build systems capable of model-based reasoning and planning.
tags: [simulation, predictive-modeling, causal-inference, state-estimation, planning, system-dynamics]
council: [C32-AEON, C4-PRAXIS, C25-PROMETHEUS, C5-ECHO, C7-LOGOS]
difficulty: advanced
last_updated: 2026-05-24
---

# World Model

## Overview

A dynamic, internal representation of the world that enables an agent to simulate future events, predict action consequences, estimate hidden states from partial observations, and reason about causal relationships. World models are the foundation of model-based planning, counterfactual reasoning, and intelligent decision-making under uncertainty.

## Core Principles

- **Models Are Simplifications:** Every world model is wrong in some details — the test is whether it is useful for the decisions it supports, not whether it is perfectly accurate.
- **Prediction Enables Planning:** The ability to simulate consequences of actions before taking them is what separates reactive systems from truly intelligent agents.
- **Uncertainty Is Structural:** State estimates must always include confidence bounds — decisions made at 60% confidence differ fundamentally from those at 95%.

## Components

- **State Estimation:** The process of estimating the current state of the world from incomplete, noisy sensory input. Key techniques include Kalman filters, particle filters, Bayesian inference, and learned latent state encoders. Handles sensor fusion, missing data imputation, and belief state tracking.

- **Predictive Modeling:** The ability to forecast future states of the world given current state and potential actions. Key techniques include recurrent neural networks, Gaussian processes, system identification, and learned forward models. Supports both short-term (next step) and long-term (trajectory) prediction.

- **Causal Inference:** The ability to understand causal relationships between events, actions, and outcomes. Key techniques include do-calculus, structural causal models, instrumental variables, and counterfactual reasoning. Distinguishes correlation from causation and supports intervention planning.

- **Scenario Simulation:** The ability to run "what-if" simulations exploring alternative action sequences, external events, or policy choices. Includes Monte Carlo tree search, rollouts, counterfactual simulation, and stress testing under distribution shift.

- **Model-Based Planning:** The use of world models to select optimal actions through simulated deliberation. Includes tree search (MCTS), trajectory optimization (iLQR, CEM), and learned value functions operating on the model's predicted states.

## Protocols

1. **Scope Definition:** Define the relevant state space, time horizon, action space, and success criteria for the model
2. **Representation Selection:** Choose between symbolic, geometric, probabilistic, or neural representations based on domain characteristics
3. **State Estimation:** Design the observability model — what is directly sensed, what must be inferred, and how uncertainty propagates
4. **Dynamics Learning:** Build or specify the transition function that maps (state, action) → next-state distribution
5. **Causal Structure Discovery:** Identify which variables are causally related versus merely correlated
6. **Validation:** Test predictions against real outcomes; identify systematic failure modes; quantify prediction horizon limits
7. **Integration:** Connect the world model to planning, decision-making, or control systems with appropriate abstraction boundaries

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Autonomous navigation | Learn forward model of vehicle dynamics from sensor data | Ability to plan collision-free trajectories in novel environments |
| Economic policy simulation | Build causal model of fiscal policy effects on employment, inflation | Evidence-based policy recommendations with quantified uncertainty |
| Game-playing AI | Learn transition model of game state from self-play replay buffer | MCTS-based planning that exceeds human performance |
| Predictive maintenance | Model equipment degradation from sensor telemetry | Early failure prediction with 90%+ accuracy before visible symptoms |
| Climate impact assessment | Run counterfactual scenarios for intervention strategies | Quantified expected outcomes with confidence intervals |

## Output Structure

`
MODEL SCOPE:
  State space definition
  Action space
  Time horizon and granularity
  Observability assumptions

REPRESENTATION:
  Model architecture / formalism
  Key parameters and learning approach
  Uncertainty representation

STATE ESTIMATION:
  Current belief state
  Confidence bounds
  Key uncertainties

PREDICTIVE PERFORMANCE:
  Horizon-specific accuracy metrics
  Systematic failure modes identified
  Distribution shift sensitivity

CAUSAL DIAGRAM:
  Identified causal relationships
  Confirmed vs. assumed edges
  Intervention predictions

SIMULATION RESULTS (if applicable):
  Scenario A → predicted outcome ± uncertainty
  Scenario B → predicted outcome ± uncertainty
  Counterfactual analyses
`

## Cross-Skill Integration

- **critical-thinking:** Apply adversarial checks to model assumptions — what would have to be true for the model to be wrong?
- **research-analysis:** Use deep research to gather domain knowledge for model structure and parameter ranges
- **technical-coding:** Implement world model components as deployable APIs or simulation services
- **probabilistic-reasoning:** Quantify and communicate uncertainty throughout the modeling pipeline
- **planning-and-task-decomposition:** Use the world model to decompose complex goals into achievable action sequences

## Quality Checklist

- [ ] State space, action space, and observability model clearly defined
- [ ] Uncertainty is quantified, not just point estimates
- [ ] Model validated on held-out data, not just training data
- [ ] Causal assumptions explicitly stated and testable
- [ ] Prediction horizon limits measured and communicated
- [ ] Failure modes and distribution shift boundaries documented
- [ ] Model is computationally feasible for its intended use case
- [ ] Integration surface (APIs, interfaces) cleanly separated from internal representation

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-models.md]]
- [[environment-mapping.md]]
- [[mental-models.md]]
- [[model-updating.md]]
- [[predictive-modeling.md]]
- [[scenario-generation.md]]
- [[simulation-theory.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/3-Quillan(reality).md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
