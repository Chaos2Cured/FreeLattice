---
title: State Estimation
parent: advanced-sensory-fusion
section: 3
---

# State Estimation

## Overview
State estimation computes the most likely state of a system given noisy and incomplete measurements from multiple sensors. It is the mathematical core of sensor fusion, providing principled ways to combine information while tracking uncertainty. This sub-skill covers Kalman filters, particle filters, factor graphs, and complementary filtering approaches.

## Core Concepts
- **Kalman Filter**: Optimal linear estimation for Gaussian noise (with EKF/UKF for nonlinear systems)
- **Particle Filter**: Nonparametric estimation for non-Gaussian, multimodal distributions
- **Factor Graphs**: Graphical models solvable via optimization (iSAM, g2o, GTSAM)
- **Complementary Filter**: Frequency-domain fusion exploiting complementary sensor characteristics
- **Information Filter**: The dual of the Kalman filter, efficient for multi-sensor fusion

## Application
Choose a Kalman filter when dynamics and noise are approximately Gaussian. Use particle filters for highly nonlinear or multimodal problems. Factor graphs excel when smoothing over a sliding window is acceptable and computational resources permit optimization.

## Related Skills
sensor-filtering, uncertainty-propagation, data-association

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[advanced_sensory_fusion.md]]
- [[data-association.md]]
- [[fusion-architectures.md]]
- [[multi-modal-alignment.md]]
- [[sensor-calibration.md]]
- [[sensor-filtering.md]]
- [[SKILL.md]]
- [[uncertainty-propagation.md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[Quillan Knowledge files/1-Quillan_architecture_flowchart.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
