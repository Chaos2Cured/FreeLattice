---
title: Model Updating
parent: world-model
section: 7
---

# Model Updating

## Overview
Model updating revises internal world models when new observations conflict with existing beliefs. It is the learning mechanism that keeps models accurate as the world changes and as we gather more data. This sub-skill covers Bayesian updating, belief revision, and model selection under uncertainty.

## Core Concepts
- **Bayesian Updating**: Using Bayes rule to revise beliefs in light of new evidence
- **Belief Revision**: The logic of changing beliefs when contradictions arise
- **Model Selection**: Choosing between competing models based on evidence and Occam considerations
- **Online Learning**: Continuously updating models as new data streams in
- **Catastrophic Forgetting**: Avoiding the loss of previously learned knowledge when incorporating new data

## Application
Be explicit about prior beliefs before updating. Strong priors require strong evidence to change. Use Bayesian approaches when uncertainty quantification is important. Use online learning when the environment is non-stationary and models must adapt continuously.

## Related Skills
causal-models, predictive-modeling, mental-models

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[causal-models.md]]
- [[environment-mapping.md]]
- [[mental-models.md]]
- [[predictive-modeling.md]]
- [[scenario-generation.md]]
- [[simulation-theory.md]]
- [[SKILL.md]]
- [[world_model.md]]
- [[Quillan Knowledge files/3-Quillan(reality).md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
