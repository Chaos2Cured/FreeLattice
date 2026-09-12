---
title: Monte Carlo Methods
parent: probabilistic_reasoning
section: 3
---

# Monte Carlo Methods

## Overview
Monte Carlo methods use repeated random sampling to approximate probability distributions, compute expectations, and solve problems that are analytically intractable. This sub-skill covers basic Monte Carlo integration, Markov Chain Monte Carlo, importance sampling, and sequential Monte Carlo.

## Core Concepts
- **Monte Carlo Integration**: Approximate expectations by averaging over random samples. The law of large numbers guarantees convergence; the central limit theorem provides error bounds.
- **Importance Sampling**: Reducing variance by sampling from a proposal distribution that concentrates mass in important regions. Weighted samples correct for the discrepancy between proposal and target.
- **Markov Chain Monte Carlo (MCMC)**: Metropolis-Hastings (propose, accept/reject), Gibbs sampling (sample conditionals), Hamiltonian Monte Carlo (use gradients for efficient exploration), and NUTS (adaptive HMC).
- **Sequential Monte Carlo (Particle Filters)**: For state-space models (e.g., tracking, SLAM), particles represent hypotheses about the hidden state, weighted by observation likelihood, resampled to focus on promising regions.

## Application
Use Monte Carlo when analytical solutions are unavailable or intractable. Choose the method based on dimensionality, dependence structure, and computational budget. Assess convergence using trace plots, R-hat, and effective sample size.

## Related Skills
bayesian-inference, uncertainty-quantification, probability-distributions

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[bayesian-inference.md]]
- [[decision-theory.md]]
- [[probabilistic_reasoning.md]]
- [[probability-distributions.md]]
- [[risk-assessment.md]]
- [[SKILL.md]]
- [[statistical-thinking.md]]
- [[uncertainty-quantification.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
