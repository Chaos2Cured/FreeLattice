---
title: Proprioception
parent: motor-control
section: 7
---

# Proprioception

## Overview
Proprioception is the sense of the body's own position and movement in space. For robotic systems, this means estimating joint positions, velocities, and forces from internal sensors. C30-TESSERACT provides real-time state processing.

## Core Concepts
- **Joint State Estimation**: Encoders measure joint position; differentiation gives velocity (noisy). Observers (Kalman filters, complementary filters) fuse encoder data with models and other sensors for clean state estimates.
- **Force/Torque Sensing**: Direct sensing (strain gauges, load cells) or indirect (motor current ? torque estimation). Force sensing is essential for interaction tasks and impedance control.
- **Kinematic Chain Awareness**: The proprioceptive system must maintain awareness of the entire kinematic chainnot just individual joints. Forward kinematics uses joint states to compute end-effector pose.

## Application
Implement proprioception by: (1) calibrating joint encoders and resolving ambiguity, (2) implementing state observers for velocity and acceleration estimation, (3) integrating force/torque sensing where interaction tasks require it, (4) computing forward kinematics from joint states in real time, (5) detecting and recovering from sensor faults.

## Related Skills
- feedback-control, coordination-patterns, motor-learning

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/20-Multidomain AI Applications.md|20-Multidomain AI Applications]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
