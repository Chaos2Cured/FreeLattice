---
name: motor-control
version: 2.0.0
description: >
  A comprehensive skill for understanding, designing, and implementing motor control systems in
  robotics, simulation, gaming, and physical computing. Covers kinematics (forward and inverse),
  dynamics (rigid body, contact, and fluid), control theory (classical PID, optimal LQR, model
  predictive control, reinforcement learning-based control), trajectory planning, sensorimotor
  integration, and low-level actuator control. Use when users need to control robot arms, mobile
  robots, simulated characters, animatronics, or any physical or virtual system that moves.
tags: [robotics, motor-control, kinematics, dynamics, control-theory, trajectory-planning, actuation, simulation]
council: [C4-PRAXIS, C26-TECHNE, C10-CODEWEAVER, C25-PROMETHEUS, C32-AEON]
difficulty: advanced
last_updated: 2026-05-24
---

# Motor Control

## Overview

Motor control is the discipline of commanding physical or virtual movementfrom the low-level electrical signals to high-level task planning. This skill covers the full pipeline: kinematic and dynamic modeling of mechanical systems, trajectory planning and optimization, feedback and feedforward control strategies, sensor integration, and the computational architectures that tie them together. It is designed for roboticists, game developers, simulation engineers, and anyone building systems that must move precisely, stably, and adaptively in the physical or simulated world.

## Core Principles

- **Principle 1  Model What You Control:** You cannot control a system you do not understand. Always develop a model (even approximate) of your system's kinematics (how it can move) and dynamics (how forces produce motion). The quality of control is bounded by the quality of the model.

- **Principle 2  Feedback is Not Optional:** Open-loop control (commanding without sensing the result) fails the moment the system encounters any unmodeled disturbance. Every real-world motor control system requires feedbacksensing the actual state, comparing to the desired state, and correcting. The faster and more accurate the feedback, the better the control.

- **Principle 3  Plan Before You Move:** Trajectory planning separates intelligent motor control from reactive twitching. A good trajectory considers: kinematic feasibility (Can the system physically achieve this? Are there joint limits?), dynamic feasibility (Are the required forces and accelerations achievable?), smoothness (Does the path avoid jerk and vibration?), and optimality (Is this the most efficient path given the objective?).

## Components

### 1. Kinematics
The study of motion without regard to the forces that cause itpositions, velocities, accelerations as geometric/temporal quantities.

**Sub-Components:**
- **Forward Kinematics:** Given joint angles/positions, compute the end-effector pose (position + orientation) in task space/workspace; fundamental for all robots; solved via Denavit-Hartenberg (DH) parameters or product of exponentials (POE)
- **Inverse Kinematics (IK):** Given a desired end-effector pose, compute the joint angles that achieve it; harder than forward kinematicsmay have zero, one, many, or infinitely many solutions; solved analytically (for specific geometries: PUMA, SCARA) or numerically (Jacobian-based: pseudo-inverse, damped least squares, cyclic coordinate descent / CCD, FABRIK)
- **Velocity Kinematics:** The Jacobian matrix maps joint velocities to end-effector velocities; essential for velocity control and for understanding singularities (configurations where mobility is lost in certain directions)
- **Workspace Analysis:** Reachable workspace (what poses can be achieved?), dexterous workspace (what orientations are available?), singularities within workspace

### 2. Dynamics
The study of forces and torques as the causes of motion.

**Sub-Components:**
- **Rigid Body Dynamics:** Newton-Euler equations (force = mass  acceleration; torque = inertia  angular acceleration + Coriolis and centrifugal terms); forward dynamics (given torques, compute resulting accelerations) and inverse dynamics (given desired accelerations, compute required torques)
- **Lagrangian Formulation:** Kinetic energy (T) - Potential energy (V) ? Lagrangian L = T - V; Euler-Lagrange equations give the dynamics directly; more systematic for complex multi-body systems
- **Contact Dynamics:** Friction models (Coulomb, viscous, Stribeck); normal forces; impact and collision (impulse-based, compliant contact models); bipedal walking, grasping, manipulation all require contact modeling
- **Recursive Algorithms:** Recursive Newton-Euler Algorithm (RNEA) for inverse dynamics (O(n) complexity); Composite Rigid Body Algorithm (CRBA) for forward dynamics; Articulated Body Algorithm (ABA) for efficient forward dynamics

### 3. Control Theory
The mathematical framework for making a dynamical system behave in a desired way.

**Sub-Components:**
- **PID Control:** Proportional (gain on current error), Integral (accumulated erroreliminates steady-state error but can cause overshoot/windup), Derivative (rate of error changedamps oscillation but amplifies noise); tuning methods (Ziegler-Nichols, Cohen-Coon, autotuning, manual iterative tuning)
- **State-Feedback Control (LQR):** Linear Quadratic Regulatoroptimal control for linear systems with quadratic cost; assumes full state observability; solved via algebraic Riccati equation; robust to model errors
- **Model Predictive Control (MPC):** Finite-horizon optimization of control inputs using model to predict future states; handles constraints naturally (joint limits, torque limits, obstacle avoidance); computationally expensive but increasingly tractable with modern solvers (OSQP, acados, Crocoddyl)
- **Nonlinear and Adaptive Control:** Feedback linearization (transform nonlinear system into linear one via nonlinear feedback); sliding mode control (robust to bounded model errors); adaptive control (parameters estimated online); impedance control (regulate mechanical impedance, not just position)
- **Optimal Control & Trajectory Optimization:** Minimum-jerk trajectories (Flash & Hogan), minimum-torque-change; shooting methods (single, multiple) for boundary value problems; direct collocation; differential dynamic programming (DDP, iLQR)

### 4. Trajectory Planning
Generating feasible, smooth, and optimal paths from start to goal.

**Sub-Components:**
- **Path Planning in Configuration Space (C-space):** Sampling-based methods (PRM, RRT, RRT*), grid-based methods (A*, Dijkstra, D*), optimization-based (CHOMP, TrajOpt, STOMP), learning-based (MPNet, motion planning with neural fields)
- **Trajectory Parameterization:** Time-parameterized path: cubic splines, quintic splines, B-splines, minimum-jerk polynomials; time-optimal trajectory along a given path (TOPP, TOPP-RA)
- **Collision Avoidance:** C-space obstacles (computed via forward kinematics + environment model); collision checking libraries (FCL, Bullet, ODE); signed distance fields (SDF); configuration-space distance computation
- **Task-Space Planning:** Operational space formulation (Khatib); hierarchical task specifications (stack of tasks, hierarchical quadratic programming)

### 5. Sensing & State Estimation
Perceiving the system's own state and its environment.

**Sub-Components:**
- **Proprioceptive Sensing:** Encoders (joint position, velocity), torque sensors, IMUs (accelerometer, gyroscope), force/torque sensors at end-effector or base
- **Exteroceptive Sensing:** Vision (cameras, depth sensors), LiDAR, tactile sensing (contact arrays, force-sensitive resistors); sensor calibration and synchronization
- **State Estimation:** Kalman filter (linear systems, Gaussian noise), Extended Kalman Filter / EKF (nonlinear systems), Unscented Kalman Filter / UKF, particle filters (non-Gaussian, multi-modal); sensor fusion (IMU + vision + kinematics)
- **Observability:** Can the system's full state be determined from available sensor measurements? Some configurations are unobservable; state estimation degrades near unobservable manifolds

## Protocols

### Protocol A: Control System Design
1. **Model identification**  Describe system kinematics (forward + inverse) and dynamics (inertial parameters, friction, actuator dynamics)
2. **Define control objective**  Position regulation, trajectory tracking, force control, impedance; required precision, bandwidth, robustness
3. **Select control architecture**  PID (simple, linear), LQR (optimal, linear), MPC (optimal, constrained, nonlinear), force/impedance (interaction tasks)
4. **Design state estimation**  What sensors are available? What state variables must be estimated (unmeasured states, external forces/moments)?
5. **Tune and Validate**  Simulation (Gazebo, MuJoCo, PyBullet) ? hardware-in-the-loop ? physical deployment; validate against specifications
6. **Robustness analysis**  Test under parameter variation (payload mass changes), external disturbance, sensor noise; stability margins

### Protocol B: Trajectory Generation
1. **Specify constraints**  Joint/workspace limits, velocity/acceleration/torque bounds, obstacle avoidance requirements
2. **Plan path**  In configuration space (sampling-based + collision-free) or task space (geometric path)
3. **Parameterize with time**  Minimum time, minimum jerk, or minimum torque change; ensure constraints are satisfied at all points
4. **Smooth and optimize**  Apply polynomial or spline fitting for continuous acceleration; optimize with respect to objective (time, energy, smoothness)
5. **Check feasibility**  Forward simulation of trajectory; verify tracking performance with candidate controller
6. **Deploy and monitor**  Execute trajectory with closed-loop tracking; monitor deviation and intervene if tracking error exceeds threshold

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Pick-and-place robot arm | Inverse kinematics + joint-space trajectory (spline interpolation) + PID control | Smooth, repeatable point-to-point motion; cycle time within specifications |
| Bipedal walking robot | Contact dynamics + MPC for balance + state estimation (IMU + foot force sensors) | Stable dynamic walking over varied terrain; disturbance rejection |
| Autonomous mobile robot navigation | Global path planning (RRT*) + local trajectory optimization (DWA/MPC) + EKF for state estimation | Collision-free navigation through cluttered environments |
| Haptic feedback device (force-feedback joystick) | Impedance control + high-bandwidth force sensing + admittance shaping | Stable, transparent haptic rendering with low apparent inertia |
| Industrial CNC machining | Trajectory planning (minimum jerk with look-ahead) + cascaded position/velocity/torque control | Precise path following with minimal contour error at high feed rates |

## Output Structure

When delivering a motor control solution, use this template:

```
## Motor Control Design

### System Description
- **Mechanism Type:** [Serial arm / Parallel arm / Mobile base / Legged / Soft robot / etc.]
- **Degrees of Freedom:** [Number of DoFs; actuated vs. passive]
- **Actuators:** [Type, torque/speed specs, transmission]
- **Sensors:** [Proprioceptive, exteroceptive]

### Kinematic Model
- **Forward Kinematics:** [Method, key parameters]
- **Inverse Kinematics:** [Method, solution type] I
- **Jacobian Analysis:** [Singularities identified, manipulability]

### Dynamic Model
- **Mass/Inertia Properties:** [Estimated or identified]
- **Contact Model:** [If applicable]
- **Friction Model:** [Viscous / Coulomb / Other]

### Control Architecture
- **Strategy:** [PID / LQR / MPC / Impedance / Hybrid]
- **Structure:** [Cascaded / State-feedback / Feedforward]
- **Tuning:** [Method, gains or cost matrices]

### State Estimation
- **Method:** [Kalman / EKF / UKF / Particle filter]
- **Inputs:** [Sensor fusion details]
- **Update Rate:** [Frequency]

### Trajectory Planning
- **Planning Method:** [Sampling-based / Optimization-based / Spline]
- **Smoothness:** [Jerk-bounded / acceleration-bounded]
- **Constraints Enforced:** [Joint limits / Torque limits / Obstacle avoidance]
```
```

## Cross-Skill Integration

- **critical-thinking:** Apply causal reasoning to diagnose control failures (why did the system oscillate? why did tracking error increase?); use logic to reason about feedback stability
- **research-analysis:** Systematic comparison of control approaches for a given platform; meta-analysis of performance across different controllers
- **technical-coding:** Implement control systems in ROS 2, C++, Python with NumPy/SciPy; simulation in MuJoCo, Drake, PyBullet, Gazebo; real-time control on microcontroller or RTOS
- **dev-team:** Motor control requires mechanical, electrical, and software co-design; coordinate across EE (motor drivers, encoders), ME (kinematic design, structural analysis), and SW (control software, simulation) teams

## Quality Checklist

- [ ] Kinematic model (forward + inverse) is derived and validated against the actual mechanism
- [ ] Dynamic model includes mass/inertia, friction, and any significant nonlinearities
- [ ] Controller stability is evaluated (margins for linear controllers, Lyapunov analysis for nonlinear)
- [ ] State estimator observability is verified for all operating configurations
- [ ] Trajectories are checked for feasibility (joint limits, torque limits, acceleration constraints)
- [ ] Collision avoidance is verified in simulation before physical deployment
- [ ] Robustness to parameter variation (payload, friction changes) is quantified
- [ ] Sensor noise effects on closed-loop performance are characterized
- [ ] Safety limits and emergency stops are implemented and tested
- [ ] Real-time constraints are explicitly considered (control loop frequency, sensor update rates)

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/20-Multidomain AI Applications.md|20-Multidomain AI Applications]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
