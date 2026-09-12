---
title: Uncertainty Quantification
parent: probabilistic_reasoning
section: 2
---

# Uncertainty Quantification

## Overview
Uncertainty quantification (UQ) is the systematic characterization of uncertainty in models, predictions, and decisions. This sub-skill covers aleatoric (irreducible) and epistemic (reducible) uncertainty, uncertainty propagation, and calibration assessment.

## Core Concepts
- **Aleatoric vs. Epistemic Uncertainty**: Aleatoric uncertainty arises from inherent randomness (irreducible); epistemic uncertainty arises from incomplete knowledge (reducible through more data or better models).
- **Confidence and Credible Intervals**: Frequentist confidence intervals (coverage guarantees across repeated sampling) vs. Bayesian credible intervals (probabilistic statements about the parameter given the data).
- **Prediction Intervals**: Interval estimates for future observations that account for both parameter uncertainty and observation noise. Wider than confidence intervals for parameters.
- **Calibration**: The degree to which predicted probabilities match observed frequencies. A well-calibrated model that predicts 70% probability should be correct 70% of the time.

## Application
Always distinguish between aleatoric and epistemic uncertainty. Report interval estimates not just point estimates. Assess calibration of probabilistic predictions. Use uncertainty to guide decisions about whether to act or gather more information.

## Related Skills
bayesian-inference, probability-distributions, decision-theory

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[bayesian-inference.md]]
- [[decision-theory.md]]
- [[monte-carlo-methods.md]]
- [[probabilistic_reasoning.md]]
- [[probability-distributions.md]]
- [[risk-assessment.md]]
- [[SKILL.md]]
- [[statistical-thinking.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
