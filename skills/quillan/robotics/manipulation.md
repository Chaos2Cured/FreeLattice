---
title: Manipulation
parent: robotics
section: 5
---

# Manipulation

## Overview
Manipulation is the ability to physically interact with objectsgrasping, moving, assembling, and using tools. C26-TECHNE provides engineering foundations while C20-ARTIFEX contributes tool integration.

## Core Concepts
- **Grasp Planning**: Computing stable grasp configurations based on object geometry, surface properties, and gripper kinematics. Considers force closure (resisting arbitrary forces) and form closure (geometric constraint).
- **Force Control vs Position Control**: Position control assumes the environment is known and stiff; force control is essential when interacting with unknown or compliant objects. Impedance control unifies both.
- **Compliant Motion**: Robots must adjust motion based on contact forcespush until contact, slide along surfaces, assembly tasks with tight tolerances. Requires force/torque sensing and admittance or impedance control.

## Application
Develop manipulation capabilities by: (1) analyzing object geometry and grasp options, (2) planning pre-grasp and post-grasp trajectories, (3) implementing force/torque sensing for contact detection, (4) designing grasp strategies for object classes, (5) testing with varied object properties in simulation before physical deployment.

## Related Skills
- kinematics, control-systems, robot-perception

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/20-Multidomain AI Applications.md|20-Multidomain AI Applications]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
