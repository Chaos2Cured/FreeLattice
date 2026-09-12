---
title: Teleoperation
parent: haptic-interaction
section: 6
---

# Teleoperation

## Overview
Teleoperation extends human manipulation capability to remote or inaccessible environments through haptic feedback. C20-ARTIFEX provides the tool bridge while C13-WARDEN ensures safety across the teleoperation link.

## Core Concepts
- **Bilateral Teleoperation**: Position commands sent from master to slave; forces sensed at slave returned to master. The ideal teleoperator makes the slave feel like a natural extension of the master.
- **Stability vs Transparency**: High transparency (faithful force reflection) can destabilize the teleoperation system, especially with communication delay. Passivity-based approaches guarantee stability at the cost of reduced transparency.
- **Communication Delay**: Time delay destabilizes bilateral teleoperation. Wave variables, time-domain passivity, and model-mediated teleoperation (rendering local model of the remote environment) mitigate delay effects.

## Application
Implement teleoperation by: (1) setting up master-slave kinematics mapping, (2) implementing bilateral control (position-force or position-position architecture), (3) addressing communication delay with appropriate compensation, (4) verifying stability across expected delay ranges, (5) including safety limits and emergency stop independent of the communication link.

## Related Skills
- force-feedback, haptic-rendering, haptic-interface-design

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[force-feedback.md]]
- [[haptic-communication.md]]
- [[haptic-interface-design.md]]
- [[haptic-rendering.md]]
- [[haptic_interaction.md]]
- [[SKILL.md]]
- [[tactile-sensing.md]]
- [[vibrotactile-feedback.md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[Quillan Knowledge files/1-Quillan_architecture_flowchart.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
