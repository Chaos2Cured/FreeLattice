---
title: Uncertainty Propagation
parent: advanced-sensory-fusion
section: 6
---

# Uncertainty Propagation

## Overview
Uncertainty propagation tracks how measurement errors, model inaccuracies, and numerical approximations combine through the fusion pipeline. It provides principled confidence bounds on fused estimates, enabling informed decision-making under uncertainty. This sub-skill covers covariance propagation, Monte Carlo methods, and analytical uncertainty bounding.

## Core Concepts
- **Covariance Propagation**: Linearized error propagation through the fusion algorithm (first-order Taylor expansion)
- **Monte Carlo Simulation**: Sampling-based uncertainty estimation for nonlinear transformations
- **Sigma-Point Methods**: Deterministic sampling for improved nonlinear uncertainty propagation (UKF)
- **Maximum Likelihood Estimation**: Finding the most likely state given measurement uncertainties
- **Cramr-Rao Lower Bound**: Theoretical lower bound on estimation variance for unbiased estimators

## Application
Always output uncertainty bounds alongside point estimates. Use first-order covariance propagation for well-behaved systems near linearity. Switch to Monte Carlo when nonlinearities are significant or distributions are non-Gaussian. Validate uncertainty estimates against empirical residuals.

## Related Skills
state-estimation, data-association, sensor-filtering

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md|12-Multi-Domain Theoretical Breakthroughs Explained]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
