---
title: Data Association
parent: advanced-sensory-fusion
section: 2
---

# Data Association

## Overview
Data association determines which measurements from different sensors correspond to the same real-world entity. It is a critical step in multi-sensor fusion, as incorrect associations lead to fused estimates that combine unrelated observations. This sub-skill covers nearest-neighbor methods, probabilistic association techniques, and joint compatibility approaches for complex multi-target scenarios.

## Core Concepts
- **Nearest Neighbor**: Assignment based on spatial or temporal proximity using distance metrics
- **Probabilistic Association**: Using Mahalanobis distance and chi-squared gating tests
- **Joint Compatibility**: Simultaneous consideration of all measurement pairings (JCBB)
- **Track-to-Track**: Association at the object-track level rather than raw measurements
- **Hungarian Algorithm**: Optimal assignment for one-to-one matching problems

## Application
For low-density environments, nearest-neighbor with Mahalanobis gating is typically sufficient. For dense, multi-target scenarios with crossing trajectories, use joint probabilistic data association (JPDA) or multiple hypothesis tracking (MHT). Always maintain uncertainty bounds on associations.

## Related Skills
sensor-calibration, state-estimation, uncertainty-propagation

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[advanced_sensory_fusion.md]]
- [[fusion-architectures.md]]
- [[multi-modal-alignment.md]]
- [[sensor-calibration.md]]
- [[sensor-filtering.md]]
- [[SKILL.md]]
- [[state-estimation.md]]
- [[uncertainty-propagation.md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[Quillan Knowledge files/1-Quillan_architecture_flowchart.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
