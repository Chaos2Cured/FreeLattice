---
name: probabilistic-reasoning
version: 2.0.0
description: >
  A comprehensive skill for applying probabilistic reasoning methods to reason under
  uncertainty, update beliefs with evidence, model stochastic systems, and support
  decision-making in uncertain environments. Covers Bayesian inference, Markov models,
  fuzzy logic, Monte Carlo methods, causal inference under uncertainty, and probabilistic
  graphical models. Use when users need to quantify uncertainty, update beliefs with data,
  model random processes, handle imprecise information, estimate probabilities from
  evidence, or make optimal decisions under risk.
tags: [probability, statistics, bayesian, uncertainty, stochastic, inference]
council: [C28-CALCULUS, C7-LOGOS, C25-PROMETHEUS, C31-NEXUS, C12-SOPHIAE]
difficulty: advanced
last_updated: 2026-05-24
---

# Probabilistic Reasoning

## Overview

A formal framework for reasoning under uncertainty using probability theory and related formalisms. Covers the full spectrum from foundational Bayesian inference through Markov models, fuzzy logic, Monte Carlo simulation, probabilistic graphical models, and causal inference—enabling robust decision-making when information is incomplete, noisy, or contradictory.

## Core Principles

- **Explicit Uncertainty Representation**: Uncertainty must be explicitly quantified, not ignored or assumed away. Every inference carries a calibrated confidence bound.
- **Coherent Belief Updating**: New evidence updates beliefs according to the rules of probability theory (Bayes' theorem), ensuring consistency across time and contexts.
- **Decision-Theoretic Grounding**: Optimal decisions under uncertainty maximize expected utility. Probability provides the belief side, utility theory provides the value side.

## Components

1. **Bayesian Inference**: A method of statistical inference where Bayes' theorem is used to update the probability for a hypothesis as more evidence becomes available. Covers prior specification (informative, weakly informative, non-informative, conjugate), likelihood construction, posterior computation (analytical, MCMC, variational), model comparison (Bayes factors, WAIC, LOO-CV), and prediction (posterior predictive distributions).

2. **Markov Models**: Stochastic models for randomly changing systems where the future depends only on the present (Markov property). Covers Markov chains (discrete-time, continuous-time, stationary distributions, ergodicity, absorption), Hidden Markov Models (HMMs—state estimation via forward-backward/Viterbi algorithms, parameter learning via Baum-Welch), Markov Decision Processes (MDPs—policies, value functions, Bellman equations, value/policy iteration), and Partially Observable MDPs (POMDPs—belief states, planning under perceptual uncertainty).

3. **Fuzzy Logic**: A multi-valued logic system where truth values range continuously over [0,1], enabling reasoning with imprecise or vague concepts. Covers fuzzy sets (membership functions, operations), linguistic variables and hedges, fuzzy inference systems (Mamdani, Takagi-Sugeno), defuzzification methods, and applications in control systems where precise mathematical models are unavailable.

4. **Monte Carlo Methods**: Computational algorithms for approximating probability distributions through repeated random sampling. Covers basic Monte Carlo integration, importance sampling (reducing variance through proposal distributions), Markov Chain Monte Carlo (MCMC—Metropolis-Hastings, Gibbs sampling, Hamiltonian MC), Sequential Monte Carlo (particle filters), and applications in Bayesian computation, optimization, and simulation.

5. **Probabilistic Graphical Models**: Compact representations of high-dimensional probability distributions using graphs. Covers Bayesian networks (directed acyclic graphs representing conditional dependencies—d-separation, inference via variable elimination, belief propagation, structure learning), Markov random fields (undirected graphs for spatial/relational data—conditional random fields, parameter estimation), and hybrid models with decision nodes (influence diagrams).

6. **Causal Inference Under Uncertainty**: Frameworks for reasoning about causal relationships from observational and experimental data. Covers Pearl's causal hierarchy (association → intervention → counterfactuals), do-calculus, back-door and front-door adjustment, instrumental variables, potential outcomes (Rubin causal model), and sensitivity analysis for unobserved confounding.

## Protocols

### Bayesian Analysis Protocol
1. Define the hypothesis space and competing models
2. Specify prior distributions with rationale
3. Define the likelihood function connecting data to parameters
4. Observe/collect data
5. Compute posterior distribution via Bayes' theorem
6. Evaluate model fit and sensitivity to prior choice
7. Make predictions with full posterior predictive distribution
8. Report uncertainty intervals (credible intervals, not just point estimates)

### Probabilistic Decision-Making Protocol
1. Define the decision space (available actions)
2. Model the uncertain state of the world with probabilities
3. Define utility/cost for each state-action pair
4. Compute expected utility for each action
5. Identify optimal action (maximize expected utility)
6. Perform sensitivity analysis: how robust is the decision to probability changes?
7. If value of information is high, defer decision and gather more data

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Medical diagnosis | Bayesian network of symptoms and diseases | Differential diagnosis with probabilities |
| Autonomous driving | Particle filter for vehicle localization | Robust position estimation |
| Financial risk assessment | Monte Carlo simulation of portfolio returns | Value-at-Risk with confidence bounds |
| Spam filtering | Naive Bayes classifier | High-accuracy spam detection |
| A/B testing | Bayesian hypothesis testing with sequential analysis | Earlier decisions with controlled error rates |
| Robotics state estimation | Kalman filter for sensor fusion | Real-time pose tracking with uncertainty |

## Output Structure

`
Probabilistic Analysis Report
─────────────────────────────
Problem Statement: [question with explicit uncertainty]
Model: [type and structure]
  Priors: [distributions and rationale]
  Likelihood: [form and assumptions]
  Posterior: [distribution parameters or samples]
  Fit Diagnostics: [convergence, ESS, R-hat if MCMC]

Results:
  Point Estimate: [value] with [interval]% Credible Interval
  Prediction: [distribution of future observations]
  Sensitivity: [how results change with prior/assumption variations]

Decision Recommendation: [action maximizing expected utility]
Robustness: [sensitivity analysis summary]
`

## Cross-Skill Integration

- **critical-thinking**: Probabilistic reasoning provides the quantitative backbone for analytical reasoning
- **reasoning**: Integrates with logical, causal, and analogical reasoning under uncertainty
- **research-analysis**: Bayesian analysis provides rigorous methodology for empirical research
- **supervised_learning**: Probabilistic models underlie classification and regression
- **planning_and_task_decomposition**: MDPs and POMDPs provide planning under uncertainty
- **technical-coding**: Implements sampling algorithms and inference engines

## Quality Checklist

- [ ] Prior distributions are specified with justification
- [ ] Likelihood function correctly models the data-generating process
- [ ] Posterior computation is validated (analytical check or convergence diagnostics)
- [ ] Uncertainty intervals are reported, not just point estimates
- [ ] Sensitivity to prior choices is assessed
- [ ] Model assumptions are stated explicitly (independence, distributional form)
- [ ] Decision-theoretic framing includes utility/cost specification
- [ ] Value of information is considered before recommending data collection
- [ ] Results are communicated with calibrated language (not overconfident)
- [ ] Computational methods are appropriate for the problem scale

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[bayesian-inference.md]]
- [[decision-theory.md]]
- [[monte-carlo-methods.md]]
- [[probability-distributions.md]]
- [[risk-assessment.md]]
- [[SKILL.md]]
- [[statistical-thinking.md]]
- [[uncertainty-quantification.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
