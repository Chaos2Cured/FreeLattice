---
title: Force Feedback
parent: haptic-interaction
section: 1
---

# Force Feedback

## Overview
Force feedback is the generation of forces that a user can feel, simulating physical interaction with virtual or remote environments. C26-TECHNE provides the engineering precision while C20-ARTIFEX integrates actuation hardware.

## Core Concepts
- **Kinesthetic Feedback**: Forces applied to joints and muscles, simulating weight, inertia, and resistance. Requires grounded (desktop, floor) or ungrounded (exoskeleton, wearable) actuation.
- **Impedance vs Admittance Control**: Impedance devices command force based on position error (spring-like behavior)good for backdrivable systems. Admittance devices command position based on applied forcebetter for high-inertia or geared systems.
- **Stability**: Haptic systems must remain stable across all operating conditions. Passivity-based approaches guarantee stability by ensuring the device cannot output more energy than it receives.

## Application
Implement force feedback by: (1) selecting actuation technology appropriate to force range and workspace, (2) choosing impedance or admittance architecture based on device backdrivability, (3) implementing stability guarantees through passivity or active damping, (4) achieving 1kHz update rates for realistic rendering, (5) tuning for transparent free-space motion.

## Related Skills
- tactile-sensing, haptic-rendering, haptic-interface-design

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/20-Multidomain AI Applications.md|20-Multidomain AI Applications]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
