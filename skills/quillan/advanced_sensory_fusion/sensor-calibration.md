---
title: Sensor Calibration
parent: advanced-sensory-fusion
section: 1
---

# Sensor Calibration

## Overview
Sensor calibration aligns raw sensor outputs to known physical standards and establishes the spatial and temporal relationships between sensors in a multi-sensor system. Without proper calibration, fusion algorithms amplify errors rather than reduce them. This sub-skill covers intrinsic calibration (correcting internal biases), extrinsic calibration (determining relative poses), and online calibration (dynamic adjustment during operation).

## Core Concepts
- **Intrinsic Calibration**: Correcting each sensor internal biases such as offset, scale factor, nonlinearity, and lens distortion
- **Extrinsic Calibration**: Determining rotation and translation between sensor coordinate frames
- **Temporal Calibration**: Measuring and compensating for latency differences between sensor streams
- **Calibration Targets**: Physical artifacts with known properties used as references
- **Online Calibration**: Dynamic adjustment during normal operation when environmental conditions change

## Application
Begin with single-sensor intrinsic calibration before attempting multi-sensor extrinsic calibration. Use checkerboard patterns for camera calibration, known geometry for LiDAR/camera alignment, and IMU-based methods for inertial sensor calibration. Document calibration residuals and re-calibrate when residuals exceed tolerances.

## Related Skills
data-association, state-estimation, multi-modal-alignment

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[advanced_sensory_fusion.md]]
- [[data-association.md]]
- [[fusion-architectures.md]]
- [[multi-modal-alignment.md]]
- [[sensor-filtering.md]]
- [[SKILL.md]]
- [[state-estimation.md]]
- [[uncertainty-propagation.md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[Quillan Knowledge files/1-Quillan_architecture_flowchart.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
